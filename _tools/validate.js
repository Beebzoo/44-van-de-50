/* The content validator: twelve gates, a failure stops the merge.

     node _tools/validate.js                 whole bank plus units, scenes, manifest, registry
     node _tools/validate.js content/questions/U01/batch-01.json   one batch, against the bank
     node _tools/validate.js geen-bronnen    skip the gates that need the transcriptions

   The gates, from rapporten/04 section 4:
     1 schema validity and unique ids        7 numbers agree with the fact registry
     2 source refs exist, anchors verbatim   8 sign codes exist in the manifest
     3 correct answer count per type         9 scenes parse
     4 per-option feedback                  10 Dutch spelling and style
     5 no em or en dashes, anywhere         11 a waarom sentence that is not the rule again
     6 stem overlap                         12 bank-level quotas

   No dependencies. The schema checker below understands the subset of JSON
   Schema the three schema files use. Exit code 1 on any failure. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.join(__dirname, "..");
const CONTENT = path.join(REPO, "content");
const args = process.argv.slice(2);
const NO_SOURCES = args.includes("geen-bronnen");
const QUIET = args.includes("stil");
const batchArg = args.find(a => a.endsWith(".json"));

const fails = [], warns = [];
const fail = (where, msg) => fails.push(where + ": " + msg);
const warn = (where, msg) => warns.push(where + ": " + msg);
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const exists = f => fs.existsSync(f);
const listJson = dir => exists(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => path.join(dir, f)) : [];

/* ==== text helpers ==== */
const normalise = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = s => normalise(s).split(" ").filter(Boolean);
const DASHES = /[\u2012\u2013\u2014\u2015]|\u002d\u002d(?![a-z])/;
const STOP = new Set("de het een en of in op te aan bij van voor met dat die dit is zijn wordt worden je jij jouw jou niet ook als dan er om naar door over uit tot nog wel al maar want dus hier daar deze wat wie waar hoe mag moet kan kun mogen moeten kunnen ben bent heb hebt heeft hebben rijdt rij rijd rijden nadert nader gaat ga gaan doe doet komt kom komen".split(" "));
const tokens = s => words(s).filter(w => !STOP.has(w) && w.length > 1);
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; const u = A.size + B.size - i; return u ? i / u : 0; };

/* ==== a small JSON Schema checker ==== */
const SCHEMAS = {};
for (const f of listJson(path.join(CONTENT, "schema"))) SCHEMAS[path.basename(f)] = readJson(f);

function resolveRef(ref, root) {
  if (ref.startsWith("#/")) return ref.slice(2).split("/").reduce((o, k) => o[k], root);
  return SCHEMAS[ref];
}
function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}
function check(schema, value, root, where, out) {
  if (schema.$ref) {
    const target = resolveRef(schema.$ref, root);
    const nextRoot = schema.$ref.startsWith("#") ? root : target;
    return check(target, value, nextRoot, where, out);
  }
  if (schema.const !== undefined && value !== schema.const) return out.push(where + ": moet " + JSON.stringify(schema.const) + " zijn");
  if (schema.enum && !schema.enum.includes(value)) return out.push(where + ": " + JSON.stringify(value) + " niet in " + schema.enum.join("|"));
  if (schema.type) {
    const t = typeOf(value);
    const ok = Array.isArray(schema.type) ? schema.type.includes(t) || (t === "integer" && schema.type.includes("number")) : schema.type === t || (schema.type === "number" && t === "integer");
    if (!ok) return out.push(where + ": type " + t + ", verwacht " + schema.type);
  }
  if (schema.oneOf || schema.anyOf) {
    const alts = schema.oneOf || schema.anyOf;
    const errs = alts.map(a => { const e = []; check(a, value, root, where, e); return e; });
    const okCount = errs.filter(e => e.length === 0).length;
    if (okCount === 0) {
      const best = errs.slice().sort((a, b) => a.length - b.length)[0];
      out.push(where + ": past bij geen enkele variant (" + best.slice(0, 2).join("; ") + ")");
    } else if (schema.oneOf && okCount > 1) out.push(where + ": past bij meer dan een variant");
    return;
  }
  const t = typeOf(value);
  if (t === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) out.push(where + ": korter dan " + schema.minLength + " tekens");
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) out.push(where + ": " + JSON.stringify(value) + " past niet op " + schema.pattern);
  }
  if (t === "integer" || t === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) out.push(where + ": " + value + " onder minimum " + schema.minimum);
    if (schema.maximum !== undefined && value > schema.maximum) out.push(where + ": " + value + " boven maximum " + schema.maximum);
  }
  if (t === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(where + ": minder dan " + schema.minItems + " items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(where + ": meer dan " + schema.maxItems + " items");
    if (schema.items) value.forEach((v, i) => check(schema.items, v, root, where + "[" + i + "]", out));
  }
  if (t === "object") {
    for (const k of schema.required || []) if (!(k in value)) out.push(where + ": veld '" + k + "' ontbreekt");
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties && schema.properties[k]) check(schema.properties[k], v, root, where + "." + k, out);
      else if (schema.additionalProperties === false) out.push(where + ": onbekend veld '" + k + "'");
    }
  }
}
function validateSchema(name, value, where) {
  const errs = [];
  check(SCHEMAS[name], value, SCHEMAS[name], where, errs);
  for (const e of errs) fail("schema", e);
  return errs.length === 0;
}

/* ==== sources: page blocks and slide blocks ==== */
let SRC = null;
function loadSources() {
  if (NO_SOURCES) return null;
  const cfg = readJson(path.join(__dirname, "sources.json"));
  if (!exists(cfg.boek) || !exists(cfg.cursus)) { warn("bronnen", "transcripties niet gevonden, ankergates overgeslagen"); return null; }
  const book = fs.readFileSync(cfg.boek, "utf8").split("\n");
  const course = fs.readFileSync(cfg.cursus, "utf8").split("\n");

  /* Book: a marker is "### Pagina N" or "## Pagina N en M". A page's text is
     the union of every marker block that names it, each running to the next
     page marker or chapter header. Level-2 family headers inside chapter 14
     ("## C Geslotenverklaring") are not boundaries. */
  const pages = {};
  const markers = [];
  book.forEach((line, i) => {
    let m = line.match(/^###? Pagina (\d+)(?:\s*(?:en|t\/m|tot en met)\s*(\d+))?/);
    if (m) {
      const list = [parseInt(m[1], 10)];
      if (m[2]) for (let p = list[0] + 1; p <= parseInt(m[2], 10); p++) list.push(p);
      markers.push({ line: i, pages: list });
    } else if (/^# /.test(line)) markers.push({ line: i, pages: [] });
  });
  markers.forEach((mk, idx) => {
    if (!mk.pages.length) return;
    const end = idx + 1 < markers.length ? markers[idx + 1].line : book.length;
    const text = book.slice(mk.line, end).join("\n");
    for (const p of mk.pages) pages[p] = (pages[p] || "") + "\n" + text;
  });

  /* Course: "## Slide N" or "## Slide N t/m M" up to the next level-1 or
     level-2 header. "## NIET NODIG" blocks name skipped slides. */
  const slides = {}, skipped = new Set();
  const heads = [];
  course.forEach((line, i) => { if (/^#{1,2} /.test(line)) heads.push(i); });
  heads.forEach((start, idx) => {
    const line = course[start];
    const end = idx + 1 < heads.length ? heads[idx + 1] : course.length;
    const text = course.slice(start, end).join("\n");
    let m = line.match(/^## Slide (\d+)(?:\s*(?:t\/m|en|tot en met)\s*(\d+))?/);
    if (m) {
      const a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
      for (let s = a; s <= b; s++) slides[s] = (slides[s] || "") + "\n" + text;
    } else if (/^## NIET NODIG/.test(line)) {
      const nums = line.match(/\d+/g) || [];
      const range = line.match(/(\d+)\s*t\/m\s*(\d+)/);
      if (range) for (let s = +range[1]; s <= +range[2]; s++) skipped.add(s);
      else for (const n of nums) skipped.add(parseInt(n, 10));
    }
  });
  return { pages, slides, skipped };
}
function anchorOk(bron, where) {
  if (bron.afgeleid) return true;
  const n = words(bron.anker).length;
  if (n < 6 || n > 15) { fail(where, "anker heeft " + n + " woorden, moet 6 tot 15 zijn: " + JSON.stringify(bron.anker)); return false; }
  if (!SRC) return true;
  let block;
  if (bron.boek !== undefined) {
    block = SRC.pages[bron.boek];
    if (!block) { fail(where, "boek pagina " + bron.boek + " heeft geen paginablok in de transcriptie"); return false; }
  } else {
    if (SRC.skipped.has(bron.slide)) { fail(where, "slide " + bron.slide + " is een NIET NODIG slide"); return false; }
    block = SRC.slides[bron.slide];
    if (!block) { fail(where, "slide " + bron.slide + " niet gevonden in de transcriptie"); return false; }
  }
  const hay = " " + normalise(block) + " ";
  const needle = " " + normalise(bron.anker) + " ";
  if (!hay.includes(needle)) { fail(where, "anker niet gevonden in " + (bron.boek !== undefined ? "pagina " + bron.boek : "slide " + bron.slide) + ": " + JSON.stringify(bron.anker)); return false; }
  return true;
}
const asList = b => Array.isArray(b) ? b : [b];

/* ==== gate 5: dashes, everywhere ==== */
function gateDashes() {
  let files = [];
  try {
    files = execFileSync("git", ["-C", REPO, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (e) { /* no git here: walk the tree instead */ }
  if (!files.length) {
    const walk = (dir, out) => { for (const f of fs.readdirSync(dir)) { if (f === ".git" || f === "node_modules") continue; const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(path.relative(REPO, p)); } return out; };
    files = walk(REPO, []);
  }
  const SKIP = /\.(woff2|png|jpg|jpeg|webp|ico|pdf|ttf|otf)$|(^|\/)(OFL\.txt|LICENSE[^/]*)$/i;
  for (const rel of files) {
    if (SKIP.test(rel)) continue;
    const f = path.join(REPO, rel);
    if (!exists(f) || fs.statSync(f).isDirectory()) continue;
    const text = fs.readFileSync(f, "utf8");
    const lines = text.split("\n");
    /* SQL comments are double hyphens by syntax; only the typographic dashes count there */
    const test = /\.sql$/i.test(rel) ? /[\u2012\u2013\u2014\u2015]/ : DASHES;
    lines.forEach((l, i) => {
      /* markdown table separator rows are hyphens by syntax, not by prose */
      if (/^[\s|:\u002d]+$/.test(l)) return;
      if (test.test(l)) fail("streepjes", rel + ":" + (i + 1) + " bevat een em dash, en dash of dubbel streepje");
    });
  }
}

/* ==== the content ==== */
function loadBank() {
  const units = {}, bank = {}, batches = [];
  for (const f of listJson(path.join(CONTENT, "units"))) { const u = readJson(f); units[u.id] = { ...u, _file: path.relative(REPO, f) }; }
  for (const f of listJson(path.join(CONTENT, "bank"))) { const b = readJson(f); bank[path.basename(f, ".json")] = { ...b, _file: path.relative(REPO, f) }; }
  for (const f of listJson(path.join(CONTENT, "generated"))) { const b = readJson(f); bank[path.basename(f, ".json")] = { ...b, _file: path.relative(REPO, f) }; }
  if (batchArg) { const b = readJson(path.resolve(batchArg)); batches.push({ ...b, _file: path.relative(REPO, path.resolve(batchArg)) }); }
  return { units, bank, batches };
}

const MANIFEST = exists(path.join(CONTENT, "signs", "manifest.json")) ? readJson(path.join(CONTENT, "signs", "manifest.json")) : null;
const SIGNS = new Set(MANIFEST ? MANIFEST.borden.map(b => b.code) : []);
const REGISTRY = exists(path.join(CONTENT, "facts", "registry.json")) ? readJson(path.join(CONTENT, "facts", "registry.json")) : null;
const SCENES = {};
for (const f of listJson(path.join(CONTENT, "scenes"))) SCENES[path.basename(f, ".json")] = readJson(f);

const UNIT_MAP = {
  m: "m", meter: "m", meters: "m", cm: "cm", mm: "mm", km: "km", "km/u": "km/u", "km/h": "km/u", "m/s": "m/s",
  kg: "kg", kilo: "kg", ton: "ton", jaar: "jaar", seconde: "s", seconden: "s", sec: "s", s: "s", promille: "promille",
  "µg/l": "µg/l", "ug/l": "µg/l", "%": "%", procent: "%", uur: "uur", minuten: "min", min: "min", passagiers: "passagiers",
};
const NUM_RE = /(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s?(km\/u|km\/h|m\/s|meter|meters|cm|mm|km|kg|kilo|ton|jaar|seconden|seconde|sec|promille|µg\/l|ug\/l|%|procent|uur|minuten|passagiers|m)(?![a-z\/])/gi;
function numbersIn(text) {
  const out = [];
  let m;
  while ((m = NUM_RE.exec(text))) {
    const raw = m[1];
    const value = /^\d{1,3}(\.\d{3})+$/.test(raw) ? parseFloat(raw.replace(/\./g, "")) : parseFloat(raw.replace(",", "."));
    out.push({ value, unit: UNIT_MAP[m[2].toLowerCase()] || m[2].toLowerCase(), raw: m[0] });
  }
  return out;
}
const registryUnit = e => UNIT_MAP[(e || "").toLowerCase()] || (e || "").toLowerCase();

/* speed-pedelec is the course's own term and stays allowed */
const ENGLISH = /\b(the|and|with|your|correct|wrong|answer|question|because|should|must|road|sign|left|right|speed(?!-pedelec)|driver|traffic)\b/i;
const U_VORM = /(^|[^\/\w])(u|uw)\b(?!-)/i; /* the u in km/u and U-bocht are not the u-vorm */
let LEXICON = null;
function lexicon() {
  if (LEXICON) return LEXICON;
  LEXICON = new Set();
  const allow = path.join(__dirname, "woordenlijst.txt");
  if (exists(allow)) for (const w of fs.readFileSync(allow, "utf8").split(/\s+/)) if (w) LEXICON.add(w.toLowerCase());
  if (!NO_SOURCES) {
    try {
      const cfg = readJson(path.join(__dirname, "sources.json"));
      for (const f of [cfg.boek, cfg.cursus]) if (exists(f)) for (const w of fs.readFileSync(f, "utf8").toLowerCase().match(/[a-zà-ÿ]+(?:['-][a-zà-ÿ]+)*/g) || []) LEXICON.add(w);
    } catch (e) { /* no sources, lexicon stays small and spelling only warns */ }
  }
  return LEXICON;
}
function styleCheck(text, where) {
  if (typeof text !== "string") return;
  if (U_VORM.test(text)) fail(where, "u-vorm: " + JSON.stringify(text.slice(0, 60)));
  if (/km\/h/.test(text)) fail(where, "km/h, schrijf km/u");
  /* a point followed by exactly three digits is the Dutch thousands separator (3.500 kg), not a decimal */
  if (/\d\.\d{1,2}(?!\d)\s?(m|meter|km|kg|ton|promille|%|sec|uur)\b/.test(text)) fail(where, "decimale punt, gebruik een komma");
  if (/!/.test(text)) fail(where, "uitroepteken");
  const en = text.match(ENGLISH);
  if (en) fail(where, "Engels woord '" + en[1] + "'");
}
function spellCheck(text, where, unknown) {
  if (typeof text !== "string" || NO_SOURCES) return;
  const lex = lexicon();
  if (lex.size < 1000) return;
  for (const w of text.toLowerCase().replace(/\[[A-Za-z0-9-]+\]/g, " ").match(/[a-zà-ÿ]+(?:['-][a-zà-ÿ]+)*/g) || []) {
    if (w.length < 4 || lex.has(w)) continue;
    /* compound words: accept a word that splits into two known words */
    let compound = false;
    for (let i = 3; i <= w.length - 3 && !compound; i++) if (lex.has(w.slice(0, i)) && lex.has(w.slice(i))) compound = true;
    if (!compound) unknown.set(w, (unknown.get(w) || 0) + 1);
  }
}
const signRefs = text => (typeof text === "string" ? (text.match(/\[([A-Z]{1,2}[0-9]{1,3}[a-z]?[0-9]{0,2}(?:-[0-9]{2})?)\]/g) || []).map(m => m.slice(1, -1)) : []);
function checkSign(code, where) { if (SIGNS.size && !SIGNS.has(code)) fail(where, "bordcode " + code + " staat niet in signs/manifest.json"); }

/* ==== units ==== */
function validateUnit(u) {
  const where = u._file;
  if (!validateSchema("unit.json", stripPrivate(u), where)) return;
  const pageIds = new Set();
  for (const code of u.borden) checkSign(code, where + " borden");
  for (const p of u.paginas) {
    if (pageIds.has(p.id)) fail(where, "dubbele pagina-id " + p.id);
    pageIds.add(p.id);
    if (!p.id.startsWith(u.id + "-")) fail(where, "pagina " + p.id + " hoort niet bij " + u.id);
    let hasVoorbeeld = false;
    p.body.forEach((b, i) => {
      const w = where + " " + p.id + " blok " + i + " (" + b.type + ")";
      if (b.type === "voorbeeld" || b.type === "scene" || b.type === "borden" || b.type === "tabel") hasVoorbeeld = true;
      if (b.bron) for (const br of asList(b.bron)) anchorOk(br, w);
      if ((b.type === "regel" || b.type === "tabel" || b.type === "voorbeeld") && !b.bron) fail(w, "geen bron");
      if (b.type === "regel" || b.type === "tabel") { const refs = asList(b.bron).filter(x => !x.afgeleid); if (!refs.length) fail(w, "regel of tabel moet naar een pagina of slide verwijzen"); }
      for (const t of [b.tekst, b.vraag, b.antwoord, b.uitleg, ...(b.items || []), ...((b.rijen || []).flat()), ...(b.kop || [])]) {
        styleCheck(t, w);
        for (const c of signRefs(t)) checkSign(c, w);
      }
      if (b.type === "borden") for (const c of b.codes) checkSign(c, w);
      if (b.type === "scene" && !SCENES[b.ref]) fail(w, "scene " + b.ref + " bestaat niet");
    });
    if (!hasVoorbeeld) warn(where + " " + p.id, "geen voorbeeld, tabel, borden of scene op deze pagina");
  }
  return pageIds;
}
const stripPrivate = o => { const c = { ...o }; for (const k of Object.keys(c)) if (k.startsWith("_")) delete c[k]; return c; };

/* ==== questions ==== */
function validateQuestion(q, where, ctx) {
  if (!validateSchema("question.json", q, where)) return;
  if (ctx.ids.has(q.id)) fail(where, "dubbele vraag-id " + q.id);
  ctx.ids.add(q.id);
  if (!q.id.startsWith(q.unit + "-")) fail(where, "id " + q.id + " hoort niet bij unit " + q.unit);
  const unit = ctx.units[q.unit];
  if (!unit) fail(where, "unit " + q.unit + " bestaat niet");
  else if (!unit.paginas.some(p => p.id === q.pagina)) fail(where, "pagina " + q.pagina + " bestaat niet in " + q.unit);

  /* gate 3: answer counts per type */
  const ids = q.opties.map(o => o.id);
  const correct = Array.isArray(q.correct) ? q.correct : null;
  if (new Set(ids).size !== ids.length) fail(where, "dubbele optie-ids");
  if (correct) for (const c of correct) if (!ids.includes(c)) fail(where, "correct verwijst naar onbekende optie " + c);
  switch (q.type) {
    case "ja_nee":
      if (ids.join(",") !== "ja,nee") fail(where, "ja_nee heeft opties ja,nee in die volgorde");
      if (!correct || correct.length !== 1) fail(where, "ja_nee heeft precies een goed antwoord");
      break;
    case "meerkeuze":
      if (ids.length < 3 || ids.length > 4) fail(where, "meerkeuze heeft 3 of 4 opties");
      if (!correct || correct.length !== 1) fail(where, "meerkeuze heeft precies een goed antwoord");
      break;
    case "meervoudig":
      if (ids.length < 4 || ids.length > 6) fail(where, "meervoudig heeft 4 tot 6 opties");
      if (!correct || correct.length < 2 || correct.length > ids.length - 1) fail(where, "meervoudig heeft 2 tot n-1 goede antwoorden");
      break;
    case "invul":
      if (correct) fail(where, "invul heeft een correct-object met getal en eenheid");
      if (q.opties.length) fail(where, "invul heeft geen opties");
      break;
    case "hotspot":
      if (!q.media || !q.media.borden) fail(where, "hotspot heeft media.borden als raster");
      else {
        if (![4, 6].includes(q.media.borden.length)) fail(where, "hotspot raster heeft 4 of 6 borden");
        if (ids.length !== q.media.borden.length || !ids.every(i => q.media.borden.includes(i))) fail(where, "hotspot opties zijn precies de rasterborden");
      }
      if (!correct || correct.length !== 1) fail(where, "hotspot heeft precies een goed antwoord");
      break;
    case "volgorde":
      if (!correct || correct.length !== ids.length || ids.some(i => !correct.includes(i))) fail(where, "volgorde: correct is een permutatie van alle opties");
      break;
    case "reeks":
      if (!q.media || !q.media.reeks) fail(where, "reeks heeft media.reeks");
      if (!correct || correct.length !== 1) fail(where, "reeks heeft precies een goed antwoord");
      break;
  }

  /* gate 4: per-option feedback */
  if (q.type !== "volgorde" && q.type !== "invul") {
    for (const o of q.opties) {
      const w = where + " optie " + o.id;
      const isCorrect = correct && correct.includes(o.id);
      if (words(o.feedback).length < 8) fail(w, "feedback korter dan 8 woorden");
      if (isCorrect && !/^Goed\b/.test(o.feedback)) fail(w, "feedback van een goed antwoord begint met 'Goed'");
      if (!isCorrect && /^Goed\b/.test(o.feedback)) fail(w, "feedback van een fout antwoord begint niet met 'Goed'");
      if (!isCorrect && !o.fouttype) fail(w, "fout antwoord zonder fouttype");
      if (isCorrect && o.fouttype) fail(w, "goed antwoord met een fouttype");
    }
  }

  /* gate 2: sources */
  for (const br of q.bronnen) anchorOk(br, where);
  if (!q.bronnen.some(b => !b.afgeleid)) fail(where, "minstens een bron naar pagina of slide");

  /* gate 8: signs */
  const texts = [q.stam, q.uitleg.regel, q.uitleg.waarom, q.uitleg.valkuil, q.uitleg.onthoud, ...q.opties.flatMap(o => [o.tekst, o.feedback])].filter(Boolean);
  for (const t of texts) for (const c of signRefs(t)) checkSign(c, where);
  if (q.media && q.media.bord) checkSign(q.media.bord, where);
  if (q.media && q.media.borden) for (const c of q.media.borden) checkSign(c, where);
  if (q.type === "hotspot") for (const o of q.opties) checkSign(o.id, where);

  /* gate 9: scenes referenced exist */
  if (q.media && q.media.scene && !SCENES[q.media.scene]) fail(where, "scene " + q.media.scene + " bestaat niet");
  if (q.media && q.media.reeks) for (const s of q.media.reeks) if (!SCENES[s]) fail(where, "scene " + s + " bestaat niet");

  /* gate 10: style and spelling */
  for (const t of texts) { styleCheck(t, where); spellCheck(t, where, ctx.unknown); }

  /* gate 11: the waarom sentence */
  const waarom = normalise(q.uitleg.waarom), regel = normalise(q.uitleg.regel);
  if (words(q.uitleg.waarom).length < 6) fail(where, "waarom korter dan 6 woorden");
  if (waarom === regel || regel.includes(waarom) || waarom.includes(regel)) fail(where, "waarom herhaalt de regel");
  if (/^omdat de regel/i.test(q.uitleg.waarom)) fail(where, "waarom begint met 'Omdat de regel'");

  /* gate 7: numbers against the registry */
  if (REGISTRY) {
    const nums = [];
    for (const t of [q.stam, q.uitleg.regel, q.uitleg.waarom, q.uitleg.onthoud, ...q.opties.filter(o => correct && correct.includes(o.id)).map(o => o.tekst)].filter(Boolean)) nums.push(...numbersIn(t));
    if (!Array.isArray(q.correct)) nums.push({ value: q.correct.getal, unit: registryUnit(q.correct.eenheid), raw: "correct" });
    for (const n of nums) {
      const sameUnit = REGISTRY.feiten.filter(f => registryUnit(f.eenheid) === n.unit && typeof f.waarde === "number");
      const anyValue = sameUnit.some(f => f.waarde === n.value) || REGISTRY.feiten.some(f => typeof f.tekst === "string" && numbersIn(f.tekst).some(x => x.unit === n.unit && x.value === n.value));
      const tagged = sameUnit.filter(f => (f.tags || []).some(t => q.tags.includes(t)));
      if (tagged.length && !tagged.some(f => f.waarde === n.value) && !anyValue) fail(where, "getal " + n.raw + " wijkt af van het feitenregister voor tags " + q.tags.join(","));
      else if (!anyValue) warn(where, "getal " + n.raw + " staat niet in het feitenregister; voeg toe aan register");
    }
  }
  return q;
}

/* ==== gate 6 and 12: across the bank ==== */
function crossChecks(all, units) {
  const byUnit = {};
  for (const q of all) (byUnit[q.unit] = byUnit[q.unit] || []).push(q);
  const toks = new Map(all.map(q => [q.id, tokens(q.stam)]));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    /* generated sign items share a template stem on purpose */
    if (a.gegenereerd && b.gegenereerd) continue;
    const s = jaccard(toks.get(a.id), toks.get(b.id));
    if (s > 0.8) {
      if (a.unit === b.unit) fail("overlap", a.id + " en " + b.id + " lijken te veel op elkaar (" + s.toFixed(2) + ")");
      else warn("overlap", a.id + " en " + b.id + " lijken op elkaar (" + s.toFixed(2) + ")");
    }
  }
  let inzichtAll = 0;
  for (const [uid, qs] of Object.entries(byUnit)) {
    const u = units[uid];
    if (!u) continue;
    const hand = qs.filter(q => !q.gegenereerd);
    const inzicht = hand.filter(q => q.soort === "inzicht").length;
    inzichtAll += inzicht;
    const share = hand.length ? inzicht / hand.length : 0;
    const min = u.quiz.inzichtMinimum !== undefined ? u.quiz.inzichtMinimum : (u.quiz.soort === "borden" ? 0 : 0.5);
    const types = {};
    for (const q of qs) types[q.type] = (types[q.type] || 0) + 1;
    const reserve = qs.filter(q => q.reserve).length;
    const line = uid + ": " + qs.length + " vragen (" + hand.length + " geschreven, " + (qs.length - hand.length) + " gegenereerd), inzicht " + Math.round(share * 100) + "%, reserve " + reserve + ", types " + Object.entries(types).map(([k, v]) => k + " " + v).join(" ");
    if (!QUIET) console.log("  " + line);
    if (hand.length && share < min) {
      if (hand.length >= u.quiz.minimaalPool) fail("quota", uid + " inzichtaandeel " + Math.round(share * 100) + "% onder minimum " + Math.round(min * 100) + "%");
      else warn("quota", uid + " inzichtaandeel " + Math.round(share * 100) + "% onder minimum " + Math.round(min * 100) + "% (pool nog niet vol)");
    }
    if (u.quiz.gate && qs.filter(q => !q.reserve).length < u.quiz.lengte) warn("quota", uid + " heeft minder niet-reserve vragen dan de quizlengte " + u.quiz.lengte);
  }
  const handAll = all.filter(q => !q.gegenereerd).length;
  if (!QUIET && handAll) console.log("  bank: " + all.length + " vragen, " + Math.round(inzichtAll / handAll * 100) + "% inzicht van de geschreven vragen");
}

/* ==== main ==== */
function main() {
  SRC = loadSources();
  const { units, bank, batches } = loadBank();
  const ctx = { units, ids: new Set(), unknown: new Map() };

  /* signs manifest and fact registry get the dash and shape checks too */
  if (MANIFEST) {
    const seen = new Set();
    for (const b of MANIFEST.borden) {
      if (seen.has(b.code)) fail("manifest", "dubbele code " + b.code);
      seen.add(b.code);
      for (const n of b.nearMiss || []) if (!SIGNS.has(n)) fail("manifest", b.code + " nearMiss " + n + " bestaat niet");
      if (b.bron && b.bron.boek && SRC && !SRC.pages[b.bron.boek]) fail("manifest", b.code + " pagina " + b.bron.boek + " bestaat niet");
    }
  } else warn("manifest", "content/signs/manifest.json ontbreekt, bordcodes niet gecontroleerd");
  if (REGISTRY) {
    for (const f of REGISTRY.feiten) for (const br of f.bronnen || []) anchorOk(br, "register " + f.id);
  } else warn("register", "content/facts/registry.json ontbreekt, getallen niet gecontroleerd");

  for (const u of Object.values(units)) validateUnit(u);
  for (const [id, s] of Object.entries(SCENES)) {
    validateSchema("scene.json", s, "scene " + id);
    if (s.id !== id) fail("scene " + id, "id in bestand is " + s.id);
    const ego = (s.actoren || []).filter(a => a.id === "ego").length;
    if (ego !== 1) fail("scene " + id, "precies een actor met id ego");
    const SPECIAL = new Set(["rotonde", "uitrit", "fietspad"]);
    for (const a of s.actoren || []) {
      if (!SPECIAL.has(a.arm) && !s.armen.includes(a.arm)) fail("scene " + id, "actor " + a.id + " op arm " + a.arm + " die niet bestaat");
      if (a.arm === "rotonde" && s.vorm !== "rotonde") fail("scene " + id, "actor " + a.id + " op de rotonde terwijl de vorm " + s.vorm + " is");
      if (a.arm === "uitrit" && s.vorm !== "uitrit") fail("scene " + id, "actor " + a.id + " op de uitrit terwijl de vorm " + s.vorm + " is");
      if (a.uitgang && !s.armen.includes(a.uitgang)) fail("scene " + id, "actor " + a.id + " heeft uitgang " + a.uitgang + " die niet bestaat");
    }
    for (const b of s.borden || []) { checkSign(b.code, "scene " + id); if (b.arm !== "rotonde" && !s.armen.includes(b.arm)) fail("scene " + id, "bord op arm " + b.arm + " die niet bestaat"); }
    for (const m of s.markering || []) if (!s.armen.includes(m.arm)) fail("scene " + id, "markering op arm " + m.arm + " die niet bestaat");
    for (const v of s.volgorde || []) if (!(s.actoren || []).some(a => a.id === v)) fail("scene " + id, "volgorde noemt onbekende actor " + v);
    if (s.hoofdweg) for (const h of s.hoofdweg) if (!s.armen.includes(h)) fail("scene " + id, "hoofdweg-arm " + h + " bestaat niet");
  }

  const all = [];
  for (const b of Object.values(bank)) for (const q of b.vragen) { validateQuestion(q, b._file + " " + q.id, ctx); all.push(q); }
  for (const b of batches) {
    if (!b.unit || !Array.isArray(b.vragen)) fail(b._file, "batch heeft unit en vragen[]");
    else for (const q of b.vragen) { if (q.unit !== b.unit) fail(b._file + " " + q.id, "unit klopt niet met de batch"); validateQuestion(q, b._file + " " + q.id, ctx); all.push(q); }
  }
  crossChecks(all, units);
  gateDashes();

  if (ctx.unknown.size) {
    const top = [...ctx.unknown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    warn("spelling", top.length + " onbekende woorden, de vaakste: " + top.map(([w, n]) => w + (n > 1 ? " x" + n : "")).join(", "));
  }
  for (const w of warns) console.log("  waarschuwing " + w);
  for (const f of fails) console.log("  FOUT " + f);
  console.log((fails.length ? "NIET GEHAALD: " : "Gehaald: ") + fails.length + " fouten, " + warns.length + " waarschuwingen, " + all.length + " vragen, " + Object.keys(units).length + " units");
  process.exit(fails.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { loadSources, normalise, words, numbersIn };
