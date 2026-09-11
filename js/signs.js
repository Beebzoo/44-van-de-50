/* Signs: the sprite, the manifest and the markup for a sign on a plate.

   The sprite is one file of <symbol id="sign-CODE"> elements, fetched once
   and injected inline so <use href="#sign-B6"> works everywhere, inside
   scene diagrams included. Every sign sits on a fixed light plate at one of
   five sizes (24, 40, 64, 112, 176) in both themes. */
let manifest = null;
let byCode = new Map();
let symbols = new Set();

export async function loadSigns() {
  const [m, svg, lampen] = await Promise.all([
    fetch("content/signs/manifest.json").then(r => r.json()),
    fetch("assets/signs.svg").then(r => r.text()),
    fetch("assets/dashboard.svg").then(r => r.text()).catch(() => ""),
  ]);
  manifest = m;
  byCode = new Map(m.borden.map(b => [b.code, b]));
  const holder = document.createElement("div");
  holder.id = "sprite";
  holder.innerHTML = svg + lampen;
  document.body.prepend(holder);
  symbols = new Set([...holder.querySelectorAll("symbol")].map(s => s.id.replace(/^sign-/, "")));
  return manifest;
}
export const sign = code => byCode.get(code) || null;

/* ==== the dashboard lamps ====

   Six lamps, and the colour carries half the meaning: red is stop now, yellow
   is have it looked at. The book teaches them as words in a table, which is no
   use at all when the exam shows you the pictogram. */
export const LAMPEN = {
  olie: { kleur: "rood", naam: "Oliedruk", betekenis: "De oliedruk is te laag: zet direct de motor af en controleer het oliepeil." },
  temperatuur: { kleur: "rood", naam: "Koelvloeistof", betekenis: "De koelvloeistof is te heet: zet direct de motor af en controleer het niveau." },
  accu: { kleur: "rood", naam: "Accu", betekenis: "De accu wordt niet bijgeladen, de dynamo of de V-riem is kapot." },
  rem: { kleur: "rood", naam: "Remsysteem", betekenis: "Er is een probleem met het remsysteem." },
  motor: { kleur: "geel", naam: "Motormanagement", betekenis: "Storing in het managementsysteem van de motor, met gevolgen voor de uitstoot." },
  brandstof: { kleur: "geel", naam: "Brandstof", betekenis: "De brandstoftank is bijna leeg." },
};
export const lamp = id => LAMPEN[id] || null;
export function lampHtml(id, size = 64, attrs = "") {
  const l = LAMPEN[id];
  if (!l) return `<span class="lamp-plaat l${size}" ${attrs}><span class="geen">${esc(id)}</span></span>`;
  return `<span class="lamp-plaat l${size} ${l.kleur}" role="img" aria-label="${esc(l.naam)}: ${esc(l.betekenis)}" ${attrs}><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><use href="#lamp-${esc(id)}" width="100" height="100"/></svg></span>`;
}
export const lampRij = ids => `<div class="lamprij">${ids.map(id => { const l = LAMPEN[id]; return `<figure>${lampHtml(id, 64)}<figcaption>${l ? esc(l.naam) : esc(id)}</figcaption></figure>`; }).join("")}</div>`;
export const hasSymbol = code => symbols.has(code);
export const families = () => manifest ? manifest.families : [];
export const allSigns = () => manifest ? manifest.borden : [];
export const familyName = letter => { const f = families().find(x => x.letter === letter); return f ? f.naam : letter; };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* a sign on its plate; size is one of 24, 40, 64, 112, 176 */
export function bordHtml(code, size = 64, attrs = "") {
  const b = byCode.get(code);
  const label = b ? esc(b.betekenis) : code;
  if (!symbols.has(code)) return `<span class="bord b${size}" role="img" aria-label="${label}" ${attrs}><span class="geen">${esc(code)}</span></span>`;
  return `<span class="bord b${size}" role="img" aria-label="${label}" ${attrs}><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><use href="#sign-${esc(code)}" width="100" height="100"/></svg></span>`;
}
/* inline chip: small sign plus its code, for running text */
export const bordChip = code => `<span class="bordchip">${bordHtml(code, 24)}<span class="bordcode">${esc(code)}</span></span>`;

/* replace [B6] style references in a text with inline chips */
export function inlineSigns(text) {
  return String(text).replace(/\[([A-Z]{1,2}[0-9]{1,3}[a-z]?[0-9]{0,2}(?:-[0-9]{2})?)\]/g, (m, code) => byCode.has(code)
    ? `<button class="bordchip" data-actie="bekijk-bord" data-code="${esc(code)}" type="button">${bordHtml(code, 24)}<span class="bordcode">${esc(code)}</span></button>`
    : m);
}

/* the sign row on a reading page: plates with the code underneath */
export function bordRij(codes) {
  return `<div class="bordrij">${codes.map(c => `<figure><button type="button" data-actie="bekijk-bord" data-code="${esc(c)}" aria-label="${esc(c)} vergroten">${bordHtml(c, 64)}</button><figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>`;
}
