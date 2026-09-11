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
     5b english        js/taal.js against every t("...") in js/, and the reading
                       overlays in content/units-en/ against the Dutch pages
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
/* Gereserveerd bij het CBR op 11 september 2026: dinsdag 13 oktober, Roermond.
   Stond eerder op 28 oktober toen er nog niets vastlag. Wijzigen kan nog, maar
   dan verhuist deze datum mee, want de aftelling en het examenklaar-lampje
   hangen eraan. In Instellingen kun je hem per apparaat overschrijven. */
const EXAMEN = "2026-10-13";

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
const clean = s => s.replace(/[\u2012\u2013\u2014\u2015]/g, ",").replace(/!/g, ".").replace(/km\/h/gi, "km/u");
const shortMeaning = b => { const m = clean(b.betekenis).replace(/\s+/g, " ").trim(); return m.length > 110 ? m.slice(0, 107).replace(/[,;: ]+\S*$/, "") + "..." : m; };

function signItems(unit) {
  const codes = unit.borden.filter(c => byCode.has(c) && symbols.has(c));
  const page = unit.paginas.find(p => p.body.some(b => b.type === "borden")) || unit.paginas[unit.paginas.length - 1];
  /* A sign item belongs to the reading page that actually shows that sign, not
     to the first page that happens to have a borden block. The sampler takes
     one question per reading page before it fills by weight, so hanging three
     hundred sign items on one page would make a quiz cover one family and let
     the rest turn up by chance. */
  const pageOf = code => unit.paginas.find(p => p.body.some(b => b.type === "borden" && (b.codes || []).includes(code))) || page;
  const out = [];
  /* two items per sign, numbered from where that sign stands in unit.borden,
     so a sign keeps its id when the generator learns to make more items */
  const idVoor = (code, variant) => unit.id + "-Q" + (900 + unit.borden.indexOf(code) * 2 + variant);
  for (const code of codes) {
    const b = byCode.get(code);
    const rnd = seeded(unit.id + code);
    const family = manifest.borden.filter(x => x.familie === b.familie && x.code !== code && symbols.has(x.code) && !x.zonderCode).map(x => x.code);
    const near = (b.nearMiss || []).filter(c => symbols.has(c) && c !== code);
    /* The anchor comes from the meaning, but half the signs in chapter 14 mean
       one word: "Maximumsnelheid.", "Voorrangsweg.", "Erf.". Those are shorter
       than the six words the validator wants, so the whole A family and the
       whole G family used to generate nothing at all. The description of the
       sign stands in the same table row on the same page, so it anchors just as
       well and it is what you actually look at. */
    let anker = anchorOf(b.betekenis);
    if (anker.split(" ").length < 6) anker = anchorOf(b.omschrijving || "");
    if (anker.split(" ").length < 6) continue;
    const bron = [{ boek: b.bron.boek, anker }];
    /* hotspot: click the sign that means X */
    /* a lookalike that means exactly the same thing is not a wrong answer but
       a second right one, so it never belongs in the grid or in the options */
    const anderBetekenis = c => shortMeaning(byCode.get(c)) !== shortMeaning(b);
    const others = pick(near.concat(pick(family.filter(c => !near.includes(c)), 6, rnd)), 5, rnd).filter(anderBetekenis).slice(0, 5);
    /* the gate wants exactly four or six, so a family that only yields four
       lookalikes becomes a grid of four instead of a rejected grid of five */
    const nOthers = others.length >= 5 ? 5 : 3;
    const grid = others.length >= 3 ? pick([code].concat(others.slice(0, nOthers)), nOthers + 1, rnd) : [];
    if (grid.length >= 4) {
      out.push({
        id: idVoor(code, 0), unit: unit.id, pagina: pageOf(code).id,
        type: "hotspot", soort: "kennis",
        stam: "Tik op het bord dat dit betekent: " + shortMeaning(b),
        media: { borden: grid },
        opties: grid.map(c => c === code
          ? { id: c, tekst: c, feedback: "Goed. Dit is " + c + ", en dat bord betekent: " + shortMeaning(b), fouttype: null }
          : { id: c, tekst: c, feedback: "Fout. Dit is " + c + ": " + shortMeaning(byCode.get(c)) + " Het gevraagde bord is " + code + ".", fouttype: "niet_geweten" }),
        correct: [code],
        uitleg: { regel: code + " betekent: " + shortMeaning(b), waarom: "Het bord is te herkennen aan de vorm en de kleur: " + clean(b.omschrijving).toLowerCase() + ".", valkuil: near.length ? "Verwar het niet met " + near.join(", ") + ", die er op lijken maar iets anders betekenen." : "Let op de details van de tekening; de familie " + b.familie + " heeft meer borden die er op lijken." },
        bronnen: bron, cbr_onderwerp: "verkeerstekens_en_aanwijzingen", moeilijkheid: 1, tier: unit.tier, tags: ["bord-" + code.toLowerCase(), "borden-" + b.familie.toLowerCase()], gegenereerd: true, versie: 1, status: "gecheckt",
      });
    }
    /* reverse meerkeuze: what does this sign mean */
    /* Afleiders moeten van elkaar verschillen en van het goede antwoord, in
       tekst en niet in code: D4 en D5 hebben dezelfde betekenis, en twee keer
       dezelfde zin in een rijtje van vier is een vraag met twee goede
       antwoorden. */
    const gezien = new Set([shortMeaning(b)]);
    const distractors = [];
    for (const c of pick(near.concat(pick(family.filter(c => !near.includes(c)), 6, rnd)), 9, rnd)) {
      const m = shortMeaning(byCode.get(c));
      if (gezien.has(m)) continue;
      gezien.add(m);
      distractors.push(c);
      if (distractors.length === 3) break;
    }
    if (distractors.length >= 2) {
      const opts = pick([code].concat(distractors.slice(0, 3)), 4, rnd);
      out.push({
        id: idVoor(code, 1), unit: unit.id, pagina: pageOf(code).id,
        type: "meerkeuze", soort: "kennis",
        stam: "Wat betekent dit bord?",
        media: { bord: code },
        opties: opts.map(c => c === code
          ? { id: c, tekst: shortMeaning(b), feedback: "Goed. Dit is " + code + ": " + clean(b.omschrijving).toLowerCase() + ", en dat betekent " + shortMeaning(b).replace(/[.]$/, "") + ".", fouttype: null }
          : { id: c, tekst: shortMeaning(byCode.get(c)), feedback: "Fout. Dat is de betekenis van " + c + ", " + clean(byCode.get(c).omschrijving).toLowerCase() + ". Dit bord is " + code + ".", fouttype: "niet_geweten" }),
        correct: [code],
        uitleg: { regel: code + " betekent: " + shortMeaning(b), waarom: "Kijk naar de vorm en de kleur: " + clean(b.omschrijving).toLowerCase() + ".", valkuil: near.length ? "Deze borden lijken erop: " + near.join(", ") + ". Zoek het verschil in de tekening." : "Meer borden in familie " + b.familie + " lijken hierop." },
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
    /* alleen de blokken die echt een Engelse vragenoverlay hebben, anders haalt
       de app vijftien bestanden op die er niet zijn en staat de console vol 404 */
    const vragenEn = fs.existsSync(path.join(CONTENT, "bank-en", u.id + ".json"));
    return { id: u.id, slug: u.slug, titel: u.titel, volgorde: u.volgorde, week: u.week, tier: u.tier, bestand: "content/units/" + u.id + ".json", bank, aantalVragen: n, vragenEn, paginas: u.paginas.map(p => ({ id: p.id, anker: p.anker, titel: p.titel })) };
  }),
};

/* ==== 5 ids: never renumber, retire instead ==== */
const ids = [];
/* only hand-written questions belong in the ledger: it exists to catch one
   silently disappearing. A generated sign item comes and goes with the
   manifest and the generator, and that is not the same event. */
for (const f of Object.values(bankFiles)) for (const q of readJson(path.join(REPO, f)).vragen) ids.push(q.id);
ids.sort();
const idsFile = path.join(CONTENT, "ids.json");
const retiredFile = path.join(CONTENT, "retired.json");
const retired = fs.existsSync(retiredFile) ? readJson(retiredFile) : [];
/* Generated sign ids used to sit in the ledger too. They are derived and not
   authored, and they left the ledger when the generator started numbering them
   after the sign instead of after their place in the row. An id that is no
   longer tracked cannot go missing, so it does not belong in this comparison.
   Hand-written questions run from Q001 to Q899, so this never hides one. */
const GEGENEREERD = /-Q9\d{2,3}$/;
if (fs.existsSync(idsFile)) {
  const before = readJson(idsFile).filter(id => !GEGENEREERD.test(id));
  const now = new Set(ids);
  const gone = before.filter(id => !now.has(id) && !retired.some(r => r.id === id));
  if (gone.length) { console.error("build gestopt: deze vraag-ids zijn verdwenen zonder retired-vermelding: " + gone.join(", ")); process.exit(1); }
}

/* ==== 5b the English side ====

   Two things can rot without anyone noticing. A new Dutch sentence in the
   code that nobody added to the dictionary would silently stay Dutch for an
   English reader, and a reading overlay can drift out of step with the page
   it translates once the Dutch is edited. Neither stops the build: the app
   falls back to Dutch in both cases, which is ugly but never broken. They
   are printed, so they get fixed. */
const engelsWaarschuwingen = [];
{
  /* every key the dictionary knows */
  const taalSrc = fs.readFileSync(path.join(REPO, "js", "taal.js"), "utf8");
  const bekend = new Set();
  const dict = taalSrc.slice(taalSrc.indexOf("const EN = {"), taalSrc.indexOf("export function t("));
  for (const m of dict.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)) bekend.add(m[1].replace(/\\"/g, '"'));

  /* every string that goes through t() in the app */
  const gevraagd = new Map();
  for (const f of fs.readdirSync(path.join(REPO, "js")).filter(x => x.endsWith(".js") && x !== "taal.js")) {
    const src = fs.readFileSync(path.join(REPO, "js", f), "utf8");
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) gevraagd.set(m[1].replace(/\\"/g, '"'), f);
  }
  const mist = [...gevraagd.keys()].filter(k => !bekend.has(k));
  if (mist.length) engelsWaarschuwingen.push(mist.length + " zinnen zonder Engelse vertaling in js/taal.js: " + mist.slice(0, 8).map(x => '"' + x.slice(0, 42) + '"').join(", ") + (mist.length > 8 ? " en " + (mist.length - 8) + " meer" : ""));

  /* the reading overlays */
  const enDir = path.join(CONTENT, "units-en");
  const VERTAALBAAR = ["tekst", "vraag", "antwoord", "uitleg", "kop", "rijen", "items", "titel"];
  const getallen = str => (String(str).match(/\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(",", ".")).sort();
  const codes = str => (String(str).match(/\[[A-L][0-9]{1,2}[a-z]?\]/g) || []).sort();
  const plat = b => VERTAALBAAR.map(k => b[k] === undefined ? "" : Array.isArray(b[k]) ? JSON.stringify(b[k]) : String(b[k])).join(" ");
  let vertaaldePaginas = 0, totaalPaginas = 0;
  for (const u of units) {
    totaalPaginas += u.paginas.length;
    const f = path.join(enDir, u.id + ".json");
    if (!fs.existsSync(f)) { engelsWaarschuwingen.push(u.id + " heeft geen Engelse leespagina's"); continue; }
    const ov = readJson(f);
    for (const pg of u.paginas) {
      const po = ov.paginas && ov.paginas[pg.id];
      if (!po || !po.body || !po.body.length) { engelsWaarschuwingen.push(pg.id + " is niet vertaald"); continue; }
      if (po.body.length !== pg.body.length) { engelsWaarschuwingen.push(pg.id + " heeft " + po.body.length + " blokken tegen " + pg.body.length + " in het Nederlands"); continue; }
      vertaaldePaginas++;
      for (let i = 0; i < pg.body.length; i++) {
        const nlB = pg.body[i], enB = po.body[i] || {};
        for (const k of Object.keys(enB)) {
          if (!VERTAALBAAR.includes(k)) { engelsWaarschuwingen.push(pg.id + " blok " + (i + 1) + ": veld " + k + " hoort niet in een vertaling"); continue; }
          if (nlB[k] === undefined) engelsWaarschuwingen.push(pg.id + " blok " + (i + 1) + ": veld " + k + " bestaat niet in het Nederlands");
        }
        const a = getallen(plat(nlB)), b = getallen(plat(enB));
        if (b.length && a.join(",") !== b.join(",")) engelsWaarschuwingen.push(pg.id + " blok " + (i + 1) + ": andere getallen (" + a.join(" ") + " tegen " + b.join(" ") + ")");
        const ca = codes(plat(nlB)), cb = codes(plat(enB));
        if (plat(enB) && ca.join(",") !== cb.join(",")) engelsWaarschuwingen.push(pg.id + " blok " + (i + 1) + ": andere bordcodes (" + ca.join(" ") + " tegen " + cb.join(" ") + ")");
      }
    }
  }
  /* de vragenoverlay: zelfde gedachte, maar op id in plaats van op volgorde */
  const bankEnDir = path.join(CONTENT, "bank-en");
  const VRAAGVELDEN = ["stam", "opties", "uitleg"];
  const UITLEGVELDEN = ["regel", "waarom", "valkuil", "onthoud"];
  let vertaaldeVragen = 0, totaalVragen = 0;
  for (const u of units) {
    const bankFile = path.join(CONTENT, "bank", u.id + ".json");
    if (!fs.existsSync(bankFile)) continue;
    const vragen = readJson(bankFile).vragen.filter(q => !q.gegenereerd);
    totaalVragen += vragen.length;
    const f = path.join(bankEnDir, u.id + ".json");
    if (!fs.existsSync(f)) continue;
    const ov = readJson(f).vragen || {};
    const opId = new Map(vragen.map(q => [q.id, q]));
    for (const [id, v] of Object.entries(ov)) {
      const q = opId.get(id);
      if (!q) { engelsWaarschuwingen.push(id + " staat in bank-en maar niet in de Nederlandse bank"); continue; }
      for (const k of Object.keys(v)) if (!VRAAGVELDEN.includes(k)) engelsWaarschuwingen.push(id + ": veld " + k + " hoort niet in een vraagvertaling");
      for (const k of Object.keys(v.uitleg || {})) {
        if (!UITLEGVELDEN.includes(k)) engelsWaarschuwingen.push(id + ": uitleg-veld " + k + " bestaat niet");
        else if (q.uitleg[k] === undefined) engelsWaarschuwingen.push(id + ": uitleg-veld " + k + " bestaat niet in het Nederlands");
      }
      for (const oid of Object.keys(v.opties || {})) if (!(q.opties || []).some(o => o.id === oid)) engelsWaarschuwingen.push(id + ": optie " + oid + " bestaat niet in het Nederlands");
      const nlTekst = [q.stam, ...(q.opties || []).map(o => o.tekst + " " + o.feedback), q.uitleg.regel, q.uitleg.waarom, q.uitleg.valkuil, q.uitleg.onthoud].filter(Boolean).join(" ");
      const enTekst = [v.stam, ...Object.values(v.opties || {}).map(o => (o.tekst || "") + " " + (o.feedback || "")), ...UITLEGVELDEN.map(k => (v.uitleg || {})[k])].filter(Boolean).join(" ");
      const ga = getallen(nlTekst), gb = getallen(enTekst);
      if (gb.length && ga.join(",") !== gb.join(",")) engelsWaarschuwingen.push(id + ": andere getallen (" + ga.join(" ") + " tegen " + gb.join(" ") + ")");
      const ca = codes(nlTekst), cb = codes(enTekst);
      if (ca.join(",") !== cb.join(",")) engelsWaarschuwingen.push(id + ": andere bordcodes (" + ca.join(" ") + " tegen " + cb.join(" ") + ")");
      if (v.stam && Object.keys(v.opties || {}).length === (q.opties || []).length && UITLEGVELDEN.every(k => q.uitleg[k] === undefined || (v.uitleg || {})[k])) vertaaldeVragen++;
    }
  }

  console.log("Engels: " + vertaaldePaginas + " van de " + totaalPaginas + " leespagina's vertaald, " + vertaaldeVragen + " van de " + totaalVragen + " geschreven vragen vertaald, " + engelsWaarschuwingen.length + " opmerkingen");
  for (const w of engelsWaarschuwingen.slice(0, 12)) console.log("  " + w);
  if (engelsWaarschuwingen.length > 12) console.log("  en nog " + (engelsWaarschuwingen.length - 12));
}

/* ==== 6 precache list and content hash ==== */
const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const rel = p => path.relative(REPO, p).split(path.sep).join("/");
const precache = [
  "index.html", "app.css", "manifest.webmanifest",
  ...fs.readdirSync(path.join(REPO, "js")).filter(f => f.endsWith(".js")).map(f => "js/" + f),
  ...fs.readdirSync(path.join(REPO, "assets", "fonts")).filter(f => f.endsWith(".woff2")).map(f => "assets/fonts/" + f),
  "assets/signs.svg", "assets/dashboard.svg",
  "content/index.json", "content/signs/manifest.json",
  ...units.map(u => "content/units/" + u.id + ".json"),
  ...units.map(u => "content/units-en/" + u.id + ".json").filter(f => fs.existsSync(path.join(REPO, f))),
  ...units.map(u => "content/bank-en/" + u.id + ".json").filter(f => fs.existsSync(path.join(REPO, f))),
  ...Object.values(bankFiles), ...Object.values(generatedFiles),
  ...(fs.existsSync(path.join(CONTENT, "scenes")) ? walk(path.join(CONTENT, "scenes")).map(rel) : []),
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png", "icons/icon-maskable-512.png",
  "preview.html",
].filter((f, i, a) => a.indexOf(f) === i);
const hash = crypto.createHash("sha256");
for (const f of precache) { if (f === "content/index.json") continue; hash.update(f); hash.update(fs.readFileSync(path.join(REPO, f))); }
/* De index zelf draagt de versie, dus die kan niet in zijn eigen hash. De rest
   van de index wel, en dat was eerder alleen units en scenes. Daardoor bleef de
   cacheversie staan toen de examendatum veranderde, en een geinstalleerde app
   telde vrolijk af naar de oude datum. gegenereerd is de bouwdatum en blijft er
   bewust buiten, anders krijg je elke dag een nieuwe versie zonder reden. */
const { versie: _v, gegenereerd: _g, ...indexVoorHash } = index;
hash.update(JSON.stringify(indexVoorHash));
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
