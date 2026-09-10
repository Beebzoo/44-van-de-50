/* Show where a question, fact or reading block gets its evidence from.

     node _tools/trace.js U01-Q003        every source of that question
     node _tools/trace.js F012            a fact from the registry
     node _tools/trace.js boek 106        the whole page block
     node _tools/trace.js slide 109       the whole slide block

   Prints the cited page or slide block with the anchor marked between
   >>> and <<<, so a disputed answer traces to a sentence in seconds. */
"use strict";
const fs = require("fs");
const path = require("path");
const { loadSources, normalise } = require("./validate.js");

const CONTENT = path.join(__dirname, "..", "content");
const SRC = loadSources();
if (!SRC) { console.error("transcripties niet gevonden, zie _tools/sources.json"); process.exit(1); }
const [what, arg] = process.argv.slice(2);
if (!what) { console.log("gebruik: node _tools/trace.js <vraag-id | feit-id | boek N | slide N>"); process.exit(1); }

function mark(block, anker) {
  /* find the anchor's words in the raw block so the print keeps the book's
     punctuation; fall back to the normalised search if the raw one misses */
  const w = normalise(anker).split(" ").filter(Boolean);
  const re = new RegExp(w.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^a-z0-9]+"), "i");
  const flat = block.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const m = flat.match(re);
  if (!m) return block + "\n\n(anker niet letterlijk gevonden: " + anker + ")";
  return flat.slice(0, m.index) + ">>> " + m[0] + " <<<" + flat.slice(m.index + m[0].length);
}
function show(bron) {
  if (bron.afgeleid) return console.log("  (afgeleid, eigen redenering)\n");
  const block = bron.boek !== undefined ? SRC.pages[bron.boek] : SRC.slides[bron.slide];
  const label = bron.boek !== undefined ? "Boek pagina " + bron.boek + (bron.sectie ? " (§" + bron.sectie + ")" : "") : "Slide " + bron.slide;
  console.log("== " + label + " ==");
  console.log(block ? mark(block, bron.anker).trim() : "(blok niet gevonden)");
  console.log();
}

if (what === "boek" || what === "slide") {
  const block = what === "boek" ? SRC.pages[+arg] : SRC.slides[+arg];
  console.log(block || "(niet gevonden)");
} else if (/^F\d+$/.test(what)) {
  const reg = JSON.parse(fs.readFileSync(path.join(CONTENT, "facts", "registry.json"), "utf8"));
  const f = reg.feiten.find(x => x.id === what);
  if (!f) { console.log("feit " + what + " niet gevonden"); process.exit(1); }
  console.log(f.tekst + "\n");
  for (const b of f.bronnen) show(b);
} else {
  let q = null;
  for (const dir of ["bank", "generated"]) {
    const d = path.join(CONTENT, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const b = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
      q = q || (b.vragen || []).find(x => x.id === what);
    }
  }
  if (!q) {
    const qd = path.join(CONTENT, "questions");
    if (fs.existsSync(qd)) for (const u of fs.readdirSync(qd)) for (const f of fs.readdirSync(path.join(qd, u))) {
      const b = JSON.parse(fs.readFileSync(path.join(qd, u, f), "utf8"));
      q = q || (b.vragen || []).find(x => x.id === what);
    }
  }
  if (!q) { console.log("vraag " + what + " niet gevonden"); process.exit(1); }
  console.log(q.stam + "\n");
  for (const b of q.bronnen) show(b);
}
