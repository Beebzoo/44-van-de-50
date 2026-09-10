/* The build: validate, generate, stamp.

     node _tools/build.js            everything
     node _tools/build.js controle   only check that the generated files are current

   Steps, in order:
     1 sprite          assets/borden -> assets/signs.svg
     2 sign items      content/signs/manifest.json -> content/generated/Uxx-borden.json
                       for every unit whose file lists sign codes
     3 validate        the twelve gates (validate.js), stop on failure
     4 index           content/index.json: units, pages, bank files, exam date
     5 ids             content/ids.json; a vanished id needs a content/retired.json entry
     6 precache        sw-assets.js with CACHE = "44-" + hash of everything precached,
                       and the same hash stamped into sw.js so the browser sees a change

   Never bump the cache version by hand. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const REPO = path.join(__dirname, "..");
const CONTENT = path.join(REPO, "content");
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n");
const listJson = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort() : [];
const CHECK = process.argv.includes("controle");
const EXAMEN = "2026-10-28";

/* ==== 1 sprite ==== */
const { sprite } = require("./build-signs.js");
const nSymbols = sprite();
const symbols = new Set(fs.readdirSync(path.join(REPO, "assets", "borden")).filter(f => f.endsWith(".svg")).map(f => f.replace(/\.svg$/, "")));

/* ==== 2 generated sign items ==== */
const manifest = readJson(path.join(CONTENT, "signs", "manifest.json"));
const byCode = new Map(manifest.borden.map(b => [b.code, b]));
const units = listJson(path.join(CONTENT, "units")).map(f => readJson(path.join(CONTENT, "units", f)));
fs.mkdirSync(path.join(CONTENT, "generated"), { recursive: true });

/* deterministic pseudo-random per code so the validator sees stable files */
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const pick = (arr, n, rnd) => { const a = arr.slice(); const out = []; while (a.length && out.length < n) out.splice(Math.floor(rnd() * (out.length + 1)), 0, a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
/* the validator counts words after normalising, where "personenauto's"
   becomes two, so trim on that count and not on the raw one */
const normWords = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).length;
const anchorOf = text => {
  const w = text.replace(/[*_`]/g, "").split(/\s+/).filter(Boolean);
  let n = Math.min(15, w.length);
  while (n > 1 && normWords(w.slice(0, n).join(" ")) > 15) n -= 1;
  return w.slice(0, n).join(" ");
};
const clean = s => s.replace(/[\u2012\u2013\u2014\u2015]/g, ",").replace(/!/g, ".");
const shortMeaning = b => { const m = clean(b.betekenis).replace(/\s+/g, " ").trim(); return m.length > 110 ? m.slice(0, 107).replace(/[,;: ]+\S*$/, "") + "..." : m; };

function signItems(unit) {
  const codes = unit.borden.filter(c => byCode.has(c) && symbols.has(c));
  const page = unit.paginas.find(p => p.body.some(b => b.type === "borden")) || unit.paginas[unit.paginas.length - 1];
  const out = [];
  for (const code of codes) {
    const b = byCode.get(code);
    const rnd = seeded(unit.id + code);
    const family = manifest.borden.filter(x => x.familie === b.familie && x.code !== code && symbols.has(x.code) && !x.zonderCode).map(x => x.code);
    const near = (b.nearMiss || []).filter(c => symbols.has(c) && c !== code);
    const anker = anchorOf(b.betekenis);
    if (anker.split(" ").length < 6) continue;
    const bron = [{ boek: b.bron.boek, anker }];
    /* hotspot: click the sign that means X */
    const others = pick(near.concat(pick(family.filter(c => !near.includes(c)), 6, rnd)), 5, rnd).slice(0, 5);
    const grid = pick([code].concat(others), 6, rnd);
    if (grid.length >= 4) {
      out.push({
        id: unit.id + "-Q" + (900 + out.length).toString().padStart(3, "0"), unit: unit.id, pagina: page.id,
        type: "hotspot", soort: "kennis",
        stam: "Tik op het bord dat dit betekent: " + shortMeaning(b),
        media: { borden: grid },
        opties: grid.map(c => c === code
          ? { id: c, tekst: c, feedback: "Goed. " + c + " betekent: " + shortMeaning(b), fouttype: null }
          : { id: c, tekst: c, feedback: "Fout. Dit is " + c + ": " + shortMeaning(byCode.get(c)) + " Het gevraagde bord is " + code + ".", fouttype: "niet_geweten" }),
        correct: [code],
        uitleg: { regel: code + " betekent: " + shortMeaning(b), waarom: "Het bord is te herkennen aan de vorm en de kleur: " + clean(b.omschrijving).toLowerCase() + ".", valkuil: near.length ? "Verwar het niet met " + near.join(", ") + ", die er op lijken maar iets anders betekenen." : "Let op de details van de tekening; de familie " + b.familie + " heeft meer borden die er op lijken." },
        bronnen: bron, cbr_onderwerp: "verkeerstekens_en_aanwijzingen", moeilijkheid: 1, tier: unit.tier, tags: ["bord-" + code.toLowerCase(), "borden-" + b.familie.toLowerCase()], gegenereerd: true, versie: 1, status: "gecheckt",
      });
    }
    /* reverse meerkeuze: what does this sign mean */
    const distractors = pick(near.concat(pick(family.filter(c => !near.includes(c)), 6, rnd)), 3, rnd).filter(c => shortMeaning(byCode.get(c)) !== shortMeaning(b));
    if (distractors.length >= 2) {
      const opts = pick([code].concat(distractors.slice(0, 3)), 4, rnd);
      out.push({
        id: unit.id + "-Q" + (900 + out.length).toString().padStart(3, "0"), unit: unit.id, pagina: page.id,
        type: "meerkeuze", soort: "kennis",
        stam: "Wat betekent dit bord?",
        media: { bord: code },
        opties: opts.map(c => c === code
          ? { id: c, tekst: shortMeaning(b), feedback: "Goed. Dit is " + code + ", " + clean(b.omschrijving).toLowerCase() + ".", fouttype: null }
          : { id: c, tekst: shortMeaning(byCode.get(c)), feedback: "Fout. Dat is de betekenis van " + c + ", " + clean(byCode.get(c).omschrijving).toLowerCase() + ". Dit bord is " + code + ".", fouttype: "niet_geweten" }),
        correct: [code],
        uitleg: { regel: code + " betekent: " + shortMeaning(b), waarom: "Kijk naar de vorm en de kleur: " + clean(b.omschrijving).toLowerCase() + ".", valkuil: near.length ? "De lijkers zijn " + near.join(", ") + ". Zoek het verschil in de tekening." : "Meer borden in familie " + b.familie + " lijken hierop." },
        bronnen: bron, cbr_onderwerp: "verkeerstekens_en_aanwijzingen", moeilijkheid: 1, tier: unit.tier, tags: ["bord-" + code.toLowerCase(), "borden-" + b.familie.toLowerCase()], gegenereerd: true, versie: 1, status: "gecheckt",
      });
    }
  }
  return out;
}
const generatedFiles = {};
for (const u of units) {
  const f = path.join(CONTENT, "generated", u.id + "-borden.json");
  if (!u.borden.length) { if (fs.existsSync(f)) fs.unlinkSync(f); continue; }
  const items = signItems(u);
  if (!items.length) { if (fs.existsSync(f)) fs.unlinkSync(f); continue; }
  writeJson(f, { unit: u.id, gegenereerd: true, vragen: items });
  generatedFiles[u.id] = "content/generated/" + u.id + "-borden.json";
  console.log(u.id + ": " + items.length + " bordvragen gegenereerd");
}

/* ==== 3 validate ==== */
try {
  execFileSync("node", [path.join(__dirname, "validate.js"), "stil"], { stdio: "inherit" });
} catch (e) { console.error("build gestopt: de validator keurt de inhoud af"); process.exit(1); }

/* ==== 4 index ==== */
const bankFiles = {};
for (const f of listJson(path.join(CONTENT, "bank"))) bankFiles[f.replace(/\.json$/, "")] = "content/bank/" + f;
const index = {
  versie: "0000000000",
  gegenereerd: new Date().toISOString().slice(0, 10),
  examenDatum: EXAMEN,
  scenes: listJson(path.join(CONTENT, "scenes")).map(f => f.replace(/\.json$/, "")),
  units: units.sort((a, b) => a.volgorde - b.volgorde).map(u => {
    const bank = [bankFiles[u.id], generatedFiles[u.id]].filter(Boolean);
    const n = bank.reduce((a, f) => a + readJson(path.join(REPO, f)).vragen.length, 0);
    return { id: u.id, slug: u.slug, titel: u.titel, volgorde: u.volgorde, week: u.week, tier: u.tier, bestand: "content/units/" + u.id + ".json", bank, aantalVragen: n, paginas: u.paginas.map(p => ({ id: p.id, anker: p.anker, titel: p.titel })) };
  }),
};

/* ==== 5 ids: never renumber, retire instead ==== */
const ids = [];
for (const f of Object.values(bankFiles).concat(Object.values(generatedFiles))) for (const q of readJson(path.join(REPO, f)).vragen) ids.push(q.id);
ids.sort();
const idsFile = path.join(CONTENT, "ids.json");
const retiredFile = path.join(CONTENT, "retired.json");
const retired = fs.existsSync(retiredFile) ? readJson(retiredFile) : [];
if (fs.existsSync(idsFile)) {
  const before = readJson(idsFile);
  const now = new Set(ids);
  const gone = before.filter(id => !now.has(id) && !retired.some(r => r.id === id));
  if (gone.length) { console.error("build gestopt: deze vraag-ids zijn verdwenen zonder retired-vermelding: " + gone.join(", ")); process.exit(1); }
}

/* ==== 6 precache list and content hash ==== */
const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const rel = p => path.relative(REPO, p).split(path.sep).join("/");
const precache = [
  "index.html", "app.css", "manifest.webmanifest",
  ...fs.readdirSync(path.join(REPO, "js")).filter(f => f.endsWith(".js")).map(f => "js/" + f),
  ...fs.readdirSync(path.join(REPO, "assets", "fonts")).filter(f => f.endsWith(".woff2")).map(f => "assets/fonts/" + f),
  "assets/signs.svg",
  "content/index.json", "content/signs/manifest.json",
  ...units.map(u => "content/units/" + u.id + ".json"),
  ...Object.values(bankFiles), ...Object.values(generatedFiles),
  ...(fs.existsSync(path.join(CONTENT, "scenes")) ? walk(path.join(CONTENT, "scenes")).map(rel) : []),
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png", "icons/icon-maskable-512.png",
  "preview.html",
].filter((f, i, a) => a.indexOf(f) === i);
const hash = crypto.createHash("sha256");
for (const f of precache) { if (f === "content/index.json") continue; hash.update(f); hash.update(fs.readFileSync(path.join(REPO, f))); }
hash.update(JSON.stringify(index.units) + JSON.stringify(index.scenes));
const version = hash.digest("hex").slice(0, 10);
index.versie = version;

const swAssets = "/* Generated by _tools/build.js. Do not edit; the version is a hash of the content. */\nconst CACHE = \"44-" + version + "\";\nconst PRECACHE = " + JSON.stringify(precache, null, 1) + ";\n";
const swFile = path.join(REPO, "sw.js");
const swNow = fs.readFileSync(swFile, "utf8");
const swNext = swNow.replace(/const BUILD = "[0-9a-f]+";/, 'const BUILD = "' + version + '";');

if (CHECK) {
  const same = fs.existsSync(path.join(REPO, "sw-assets.js")) && fs.readFileSync(path.join(REPO, "sw-assets.js"), "utf8") === swAssets && swNow === swNext
    && fs.existsSync(path.join(CONTENT, "index.json")) && JSON.stringify(readJson(path.join(CONTENT, "index.json")).units) === JSON.stringify(index.units);
  console.log(same ? "gegenereerde bestanden zijn actueel (versie " + version + ")" : "gegenereerde bestanden zijn NIET actueel: draai node _tools/build.js");
  process.exit(same ? 0 : 1);
}
writeJson(path.join(CONTENT, "index.json"), index);
writeJson(idsFile, ids);
fs.writeFileSync(path.join(REPO, "sw-assets.js"), swAssets);
fs.writeFileSync(swFile, swNext);
const bytes = precache.reduce((a, f) => a + fs.statSync(path.join(REPO, f)).size, 0);
console.log("versie " + version + ": " + precache.length + " bestanden in de precache, " + (bytes / 1024).toFixed(0) + " KB, " + ids.length + " vragen, " + nSymbols + " borden in de sprite");
