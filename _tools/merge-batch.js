/* Append a checked batch to the unit's bank.

     node _tools/merge-batch.js content/questions/U01/batch-01.json

   The batch must pass the validator first (this script runs it). Questions
   land in content/bank/Uxx.json in id order. Ids are never reused: an id
   that already exists in the bank is refused, and a question is retired
   through content/retired.json, never by deleting it. Only questions with
   status gecheckt or goedgekeurd are merged. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.join(__dirname, "..");
const file = process.argv[2];
if (!file) { console.error("gebruik: node _tools/merge-batch.js content/questions/Uxx/batch-nn.json"); process.exit(1); }
const abs = path.resolve(file);
const batch = JSON.parse(fs.readFileSync(abs, "utf8"));

try {
  execFileSync("node", [path.join(__dirname, "validate.js"), abs, "stil"], { stdio: "inherit" });
} catch (e) { console.error("batch niet gemerged: de validator keurt hem af"); process.exit(1); }

const bankFile = path.join(REPO, "content", "bank", batch.unit + ".json");
const bank = fs.existsSync(bankFile) ? JSON.parse(fs.readFileSync(bankFile, "utf8")) : { unit: batch.unit, vragen: [] };
const have = new Set(bank.vragen.map(q => q.id));
let added = 0, skipped = 0;
for (const q of batch.vragen) {
  if (have.has(q.id)) { console.error("  " + q.id + " bestaat al in de bank, overgeslagen"); skipped++; continue; }
  if (q.status === "concept") { console.error("  " + q.id + " heeft status concept, eerst de checker-pass"); skipped++; continue; }
  bank.vragen.push(q); have.add(q.id); added++;
}
bank.vragen.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(bankFile), { recursive: true });
fs.writeFileSync(bankFile, JSON.stringify(bank, null, 2) + "\n");
console.log(batch.unit + ": " + added + " vragen toegevoegd, " + skipped + " overgeslagen, bank heeft nu " + bank.vragen.length);
