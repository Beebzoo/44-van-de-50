/* Kijkt een Engelse leesoverlay na tegen de Nederlandse pagina.

     node _tools/check-en.js U07          een blok
     node _tools/check-en.js              alle blokken

   Wat het controleert:
     1 het bestand bestaat en is geldige JSON
     2 elke pagina-id bestaat in het Nederlands, en geen enkele ontbreekt
     3 het aantal blokken per pagina klopt precies, in dezelfde volgorde
     4 alleen vertaalbare velden staan erin, en alleen velden die het
       Nederlandse blok ook heeft
     5 dezelfde getallen, want een vertaalfout in een snelheid of een afstand
       is een fout antwoord
     6 dezelfde bordcodes tussen blokhaken
     7 een lijst of tabel heeft evenveel regels en kolommen als het origineel
     8 niets is per ongeluk Nederlands gebleven (een steekproef op woorden die
       in het Engels niet bestaan)

   Dit is geen poort in de bouw: ontbreekt er iets, dan valt de app terug op
   het Nederlands. Het is de checklist voor wie vertaalt. */
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const CONTENT = path.join(REPO, "content");
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));

const VERTAALBAAR = ["tekst", "vraag", "antwoord", "uitleg", "kop", "rijen", "items", "titel"];
const getallen = s => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(",", ".")).sort();
const codes = s => (String(s).match(/\[[A-L][0-9]{1,2}[a-z]?\]/g) || []).sort();
const plat = b => VERTAALBAAR.map(k => (b[k] === undefined ? "" : Array.isArray(b[k]) ? JSON.stringify(b[k]) : String(b[k]))).join(" ");
/* woorden die geen Engels zijn en vaak blijven staan */
const NEDERLANDS = /\b(het|een|deze|niet|moet|mag|wordt|zijn|jij|daarom|rijbaan|weggebruiker|voertuig|kruispunt|bestuurder|altijd|nooit)\b/i;

function checkUnit(id) {
  const fouten = [];
  const nlFile = path.join(CONTENT, "units", id + ".json");
  const enFile = path.join(CONTENT, "units-en", id + ".json");
  if (!fs.existsSync(nlFile)) return ["blok " + id + " bestaat niet"];
  if (!fs.existsSync(enFile)) return ["content/units-en/" + id + ".json bestaat niet"];
  const u = readJson(nlFile);
  let ov;
  try { ov = readJson(enFile); } catch (e) { return [id + ": geen geldige JSON, " + e.message]; }

  if (ov.id !== u.id) fouten.push("id is " + ov.id + " en niet " + u.id);
  if (!ov.titel) fouten.push("titel ontbreekt");
  if (!ov.intro) fouten.push("intro ontbreekt");
  if (ov.titel && NEDERLANDS.test(ov.titel)) fouten.push("titel lijkt nog Nederlands: " + ov.titel);

  const nlIds = new Set(u.paginas.map(p => p.id));
  for (const k of Object.keys(ov.paginas || {})) if (!nlIds.has(k)) fouten.push("pagina " + k + " bestaat niet in het Nederlands");

  for (const pg of u.paginas) {
    const po = (ov.paginas || {})[pg.id];
    if (!po) { fouten.push(pg.id + " ontbreekt"); continue; }
    if (!po.titel) fouten.push(pg.id + ": titel ontbreekt");
    if (!Array.isArray(po.body)) { fouten.push(pg.id + ": body is geen lijst"); continue; }
    if (po.body.length !== pg.body.length) { fouten.push(pg.id + ": " + po.body.length + " blokken tegen " + pg.body.length + " in het Nederlands"); continue; }
    for (let i = 0; i < pg.body.length; i++) {
      const nlB = pg.body[i], enB = po.body[i] || {};
      const waar = pg.id + " blok " + (i + 1) + " (" + nlB.type + ")";
      for (const k of Object.keys(enB)) {
        if (!VERTAALBAAR.includes(k)) fouten.push(waar + ": veld " + k + " hoort niet in een vertaling");
        else if (nlB[k] === undefined) fouten.push(waar + ": veld " + k + " bestaat niet in het Nederlands");
      }
      /* een blok met tekst dat leeg blijft is vergeten */
      for (const k of VERTAALBAAR) {
        if (nlB[k] !== undefined && enB[k] === undefined && k !== "titel") fouten.push(waar + ": " + k + " is niet vertaald");
      }
      if (Array.isArray(nlB.items) && Array.isArray(enB.items) && nlB.items.length !== enB.items.length) fouten.push(waar + ": lijst heeft " + enB.items.length + " regels tegen " + nlB.items.length);
      if (Array.isArray(nlB.kop) && Array.isArray(enB.kop) && nlB.kop.length !== enB.kop.length) fouten.push(waar + ": tabelkop heeft " + enB.kop.length + " kolommen tegen " + nlB.kop.length);
      if (Array.isArray(nlB.rijen) && Array.isArray(enB.rijen)) {
        if (nlB.rijen.length !== enB.rijen.length) fouten.push(waar + ": tabel heeft " + enB.rijen.length + " rijen tegen " + nlB.rijen.length);
        else for (let r = 0; r < nlB.rijen.length; r++) if ((nlB.rijen[r] || []).length !== (enB.rijen[r] || []).length) fouten.push(waar + ": rij " + (r + 1) + " heeft een ander aantal cellen");
      }
      const a = getallen(plat(nlB)), b = getallen(plat(enB));
      if (plat(enB).trim() && a.join(",") !== b.join(",")) fouten.push(waar + ": andere getallen, " + (a.join(" ") || "geen") + " tegen " + (b.join(" ") || "geen"));
      const ca = codes(plat(nlB)), cb = codes(plat(enB));
      if (plat(enB).trim() && ca.join(",") !== cb.join(",")) fouten.push(waar + ": andere bordcodes, " + (ca.join(" ") || "geen") + " tegen " + (cb.join(" ") || "geen"));
      const eng = plat(enB);
      if (eng.trim() && eng === plat(nlB)) fouten.push(waar + ": woordelijk gelijk aan het Nederlands");
    }
  }
  return fouten;
}

const arg = process.argv[2];
const ids = arg ? [arg.toUpperCase()] : fs.readdirSync(path.join(CONTENT, "units")).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
let totaal = 0;
for (const id of ids) {
  const f = checkUnit(id);
  totaal += f.length;
  if (!f.length) console.log(id + ": in orde");
  else {
    console.log(id + ": " + f.length + " dingen");
    for (const x of f.slice(0, 40)) console.log("  " + x);
    if (f.length > 40) console.log("  en nog " + (f.length - 40));
  }
}
process.exit(totaal ? 1 : 0);
