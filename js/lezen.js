/* The reading page: typed blocks to HTML.

   Block types come from content/schema/unit.json. Every page keeps the
   same order of headings so the reader never wonders where they are:
   regel in a box, waarom, voorbeeld, valkuil, onthoud, zelftest. Sign
   codes in [B6] brackets become inline chips. */
import { inlineSigns, bordRij, lampRij } from "./signs.js";
import { t } from "./taal.js";
import { scenePlate } from "./scene.js";

let SCENES = {};
export const setScenes = map => { SCENES = map; };

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tekst = s => inlineSigns(esc(s));

const LABELS = { tip: "Tip", letop: "Let op", weetje: "Weetje", ezelsbrug: "Ezelsbrug" };

export function blockHtml(b, i) {
  switch (b.type) {
    case "kop": return `<h3 class="kop3">${esc(b.tekst)}</h3>`;
    case "tekst": return `<p class="lees">${tekst(b.tekst)}</p>`;
    case "regel": return `<div class="regelbox lees" ${b.id ? `id="${esc(b.id)}"` : ""}><span class="label">${esc(t("Regel"))}</span>${tekst(b.tekst)}</div>`;
    case "waarom": return `<div class="callout waarom lees"><span class="label">${esc(t("Waarom"))}</span>${tekst(b.tekst)}</div>`;
    case "voorbeeld": return `<div class="kaart lees"><span class="meta">${esc(t("Voorbeeld"))}</span><p style="margin:4px 0 0">${tekst(b.tekst)}</p></div>`;
    case "valkuil": return `<div class="callout valkuil lees"><span class="label">${esc(t("Valkuil"))}</span>${tekst(b.tekst)}</div>`;
    case "callout": return `<div class="callout ${esc(b.stijl)} lees"><span class="label">${esc(LABELS[b.stijl] ? t(LABELS[b.stijl]) : b.stijl)}</span>${tekst(b.tekst)}</div>`;
    case "onthoud": return `<div class="onthoud lees"><span class="label">${esc(t("Onthoud"))}</span>${tekst(b.tekst)}</div>`;
    case "lijst": return `<ul class="lijst lees">${b.items.map(x => `<li>${tekst(x)}</li>`).join("")}</ul>`;
    case "tabel": return `<div class="tabelwrap"><table class="tabel"><thead><tr>${b.kop.map(k => `<th>${tekst(k)}</th>`).join("")}</tr></thead><tbody>${b.rijen.map(r => `<tr>${r.map(c => `<td>${tekst(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    case "borden": return (b.tekst ? `<p class="lees">${tekst(b.tekst)}</p>` : "") + bordRij(b.codes);
    case "lampen": return (b.tekst ? `<p class="lees">${tekst(b.tekst)}</p>` : "") + lampRij(b.lampen);
    case "scene": return (SCENES[b.ref] ? scenePlate(SCENES[b.ref]) : `<div class="plaat scene-placeholder">${esc(t("{ref} ontbreekt", { ref: b.ref }))}</div>`) + (b.tekst ? `<p class="meta" style="margin:-4px 0 12px">${tekst(b.tekst)}</p>` : "");
    case "zelftest": return `<div class="zelftest lees" data-zelftest="${i}"><span class="meta">${esc(t("Zelftest"))}</span><p style="margin:4px 0 8px">${tekst(b.vraag)}</p><button class="knop omlijnd" type="button" data-actie="toon-antwoord">${esc(t("Toon antwoord"))}</button><div class="antwoord verborgen"><strong>${tekst(b.antwoord)}</strong>${b.uitleg ? `<p style="margin:6px 0 0">${tekst(b.uitleg)}</p>` : ""}</div></div>`;
    default: return "";
  }
}

export function bronnenRegel(bronnen) {
  const parts = [];
  if (bronnen && bronnen.boek) {
    const p = bronnen.boek.paginas || [];
    const s = bronnen.boek.secties || [];
    let pag = "";
    if (p.length === 1) pag = t("p. {p}", { p: p[0] });
    else if (p.length > 1) pag = t("p. {van} tot {tot}", { van: Math.min(...p), tot: Math.max(...p) });
    parts.push(t("Boek {pag}", { pag: [pag, s.length ? "(§" + s.join(", §") + ")" : ""].filter(Boolean).join(" ") }));
  }
  if (bronnen && bronnen.cursus && bronnen.cursus.slides && bronnen.cursus.slides.length) {
    const sl = bronnen.cursus.slides;
    parts.push(sl.length === 1 ? t("SpeedTheorie slide {n}", { n: sl[0] }) : t("SpeedTheorie slide {van} t/m {tot}", { van: Math.min(...sl), tot: Math.max(...sl) }));
  }
  return parts.length ? `<p class="bronregel">${esc(parts.join(" · "))}</p>` : "";
}

export function pageHtml(unit, page) {
  return `<article class="pagina" id="${esc(page.anker)}">
    <p class="meta">${esc(t("Blok {n} · {titel}", { n: unit.volgorde, titel: unit.titel }))}</p>
    <h1 class="kop1">${esc(page.titel)}</h1>
    ${page.body.map(blockHtml).join("\n")}
    ${bronnenRegel(page.bronnen)}
  </article>`;
}
