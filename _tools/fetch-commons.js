/* Fetch the sign SVGs that the NDW set lacks from Wikimedia Commons.

     node _tools/fetch-commons.js <outdir>

   NDW has no K1 to K13, no L4 to L7, L10 to L12, no L51, no C22e family,
   no onderborden. Commons has them under a handful of naming prefixes,
   most tagged PD-NL-verkeersbord (Dutch legislation is public domain,
   Auteurswet art. 11), the rest CC0, CC BY or CC BY-SA; licences.json in
   the output folder records the tag per file and assets/borden/LICENTIES.md
   is generated from it. Requests are paced and retried because Commons
   answers 429 after a burst. Safe to re-run: files on disk are skipped. */
"use strict";
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2];
if (!OUT) { console.error("gebruik: node _tools/fetch-commons.js <outdir>"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const WANTED = [
  ...Array.from({ length: 14 }, (_, i) => "K" + (i + 1)),
  "L4", "L5", "L6", "L7", "L10", "L11", "L12", "L51", "L52",
  "C22e", "C22e1", "C22e4", "C22e5", "C22e6", "C22e7", "C22e8", "C22e9", "C22e10", "C22f",
  "E8a", "E8b", "E8c", "H1a", "H2a",
  "OB1", "OB9", "OB13", "OB14", "OB51", "OB59", "OB60", "OB61", "OB62", "OB63", "OB64", "OB65", "OB66", "OB504", "OB705",
  /* NDW draws these without their number (QGIS adds it as a label); the
     Commons files carry a value, which is what a learner needs to see */
  "A1", "A2", "A3", "A4", "A5", "C17", "C18", "C19", "C20", "C21", "E10", "E11",
];
/* files whose Commons name does not follow prefix plus code */
const ALIAS = { C22e: "Nederlands_verkeersbord_C22e_2026.svg" };
const PREFIXES = ["Nederlands verkeersbord ", "NL verkeersbord ", "Netherlands traffic sign ", "NL-"];
const UA = "44-van-de-50 study app (contact: github.com/Beebzoo/44-van-de-50)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* every request backs off and retries on 429, up to six times */
async function get(url, asJson) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return asJson ? res.json() : Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 || attempt >= 6) throw new Error(url + " -> " + res.status);
    const wait = 20000 * (attempt + 1);
    console.log("  429, wachten " + wait / 1000 + "s");
    await sleep(wait);
  }
}
const api = params => get("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params }), true);

(async () => {
  /* 1. list every file under the prefixes, cached on disk so a re-run
     does not hammer the listing endpoint */
  const listFile = path.join(OUT, "listing.json");
  let files;
  if (fs.existsSync(listFile)) files = new Map(Object.entries(JSON.parse(fs.readFileSync(listFile, "utf8"))));
  else {
    files = new Map();
    for (const prefix of PREFIXES) {
      let cont = {};
      do {
        const j = await api({ action: "query", list: "allimages", aiprefix: prefix, ailimit: "500", aiprop: "url", ...cont });
        for (const f of j.query.allimages) if (f.name.toLowerCase().endsWith(".svg")) files.set(f.name, f.url);
        cont = j.continue || null;
        await sleep(1500);
      } while (cont);
    }
    fs.writeFileSync(listFile, JSON.stringify(Object.fromEntries(files), null, 1));
  }
  console.log(files.size + " svg-bestanden onder de prefixen");

  /* 2. match each wanted code to exactly one file: the name after the
     prefix must equal the code, so K1 does not match K14 */
  const norm = s => s.replace(/_/g, " ").replace(/\.svg$/i, "").toLowerCase();
  const found = {};
  for (const [code, name] of Object.entries(ALIAS)) if (files.has(name)) found[code] = { name, url: files.get(name) };
  for (const code of WANTED) {
    if (found[code]) continue;
    for (const [name, url] of files) {
      const n = norm(name);
      const hit = PREFIXES.some(p => n === (p + code).toLowerCase() || n === (p + "nl " + code).toLowerCase());
      if (hit) { found[code] = { name, url }; break; }
    }
  }
  const missing = WANTED.filter(c => !found[c]);
  console.log(Object.keys(found).length + " gevonden, ontbreekt: " + (missing.join(", ") || "niets"));

  /* 3. download, slowly */
  for (const [code, f] of Object.entries(found)) {
    const dest = path.join(OUT, code + ".svg");
    if (fs.existsSync(dest)) continue;
    try {
      fs.writeFileSync(dest, await get(f.url, false));
      console.log("  " + code.padEnd(8) + f.name);
    } catch (e) { console.log("  " + code + " mislukt: " + e.message); }
    await sleep(2000);
  }

  /* 4. licence tags, one batched query per 40 titles */
  const licFile = path.join(OUT, "licences.json");
  const licences = fs.existsSync(licFile) ? JSON.parse(fs.readFileSync(licFile, "utf8")) : {};
  const codes = Object.keys(found).filter(c => !licences[c]);
  for (let i = 0; i < codes.length; i += 40) {
    const slice = codes.slice(i, i + 40);
    const j = await api({ action: "query", titles: slice.map(c => "File:" + found[c].name).join("|"), prop: "imageinfo", iiprop: "extmetadata", iiextmetadatafilter: "LicenseShortName|Artist" });
    for (const page of Object.values(j.query.pages)) {
      const code = slice.find(c => "File:" + found[c].name.replace(/_/g, " ") === page.title);
      const md = (page.imageinfo && page.imageinfo[0].extmetadata) || {};
      if (code) licences[code] = { file: found[code].name, licence: md.LicenseShortName ? md.LicenseShortName.value : "?", artist: md.Artist ? md.Artist.value.replace(/<[^>]+>/g, "") : "?" };
    }
    await sleep(1500);
  }
  fs.writeFileSync(licFile, JSON.stringify(licences, null, 2));
  const have = fs.readdirSync(OUT).filter(f => f.endsWith(".svg")).length;
  console.log("klaar: " + have + " svg-bestanden in " + OUT + ", " + Object.keys(licences).length + " licenties bekend");
})().catch(e => { console.error(e); process.exit(1); });
