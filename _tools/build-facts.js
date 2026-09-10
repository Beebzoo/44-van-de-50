/* Regenerate the cheat sheet from the fact registry.

     node _tools/build-facts.js [pad/naar/feiten-en-cijfers.md]

   Every line in the sheet is a fact from content/facts/registry.json, and
   every fact carries a page or slide with a verbatim anchor that the
   validator finds. Nothing else goes in. The default output path is the
   sheet in the Rijbewijs folder; pass another path to write elsewhere. */
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const OUT = process.argv[2] || "/home/alardus/Admin/09 Voertuig/Rijbewijs/feiten-en-cijfers.md";
const reg = JSON.parse(fs.readFileSync(path.join(REPO, "content", "facts", "registry.json"), "utf8"));

const ref = b => b.boek !== undefined ? "boek p. " + b.boek : "slide " + b.slide;
const refs = f => (f.bronnen || []).filter(b => !b.afgeleid).map(ref).join(", ");

const lines = [];
lines.push("# Feiten en cijfers");
lines.push("");
lines.push("Je stampblad. Elk getal dat het examen kan vragen, met de pagina in het VekaBest theorieboek of de slide in de SpeedTheorie waar het staat. Alles hierin is terug te vinden op die plek; wat nergens staat, staat hier ook niet.");
lines.push("");
lines.push("Gegenereerd op " + reg.gegenereerd + " uit `content/facts/registry.json` in de repo van de app (" + reg.feiten.length + " feiten). Niet met de hand bewerken: pas het register aan en draai `node _tools/build-facts.js`.");
lines.push("");

for (const cat of reg.categorieen) {
  const facts = reg.feiten.filter(f => f.categorie === cat.id && !(f.tags || []).includes("niet-examenstof-volgens-boek"));
  if (!facts.length) continue;
  lines.push("## " + cat.naam);
  lines.push("");
  /* group by onderwerp so related numbers sit together */
  const groups = [];
  for (const f of facts) {
    const g = groups.find(x => x.onderwerp === f.onderwerp);
    if (g) g.facts.push(f); else groups.push({ onderwerp: f.onderwerp, facts: [f] });
  }
  for (const g of groups) {
    if (g.facts.length === 1) {
      const f = g.facts[0];
      lines.push("- " + f.tekst + " *(" + refs(f) + ")*");
    } else {
      lines.push("- **" + g.onderwerp + "**");
      for (const f of g.facts) lines.push("  - " + f.tekst + " *(" + refs(f) + ")*");
    }
  }
  lines.push("");
}
const skipped = reg.feiten.filter(f => (f.tags || []).includes("niet-examenstof-volgens-boek"));
if (skipped.length) {
  lines.push("## Niet leren");
  lines.push("");
  lines.push("Het boek zegt zelf dat je dit niet hoeft te kennen voor het theorie-examen auto. Het staat in het register voor de volledigheid.");
  lines.push("");
  for (const f of skipped) lines.push("- " + f.tekst + " *(" + refs(f) + ")*");
  lines.push("");
}
const text = lines.join("\n");
if (/[\u2012\u2013\u2014\u2015]/.test(text)) { console.error("streepje in de uitvoer"); process.exit(1); }
fs.writeFileSync(OUT, text);
console.log(OUT + ": " + reg.feiten.length + " feiten in " + reg.categorieen.length + " rubrieken, " + text.split("\n").length + " regels");
