/* De vier losse diagrammen uit het bouwplan.

   Dit zijn de dingen die je niet uit een zin leert: hoe hard een remweg
   oploopt, waar een auto verdwijnt die je niet ziet, waarom een kruis twee
   balken heeft, en hoe een agent met zijn arm zegt dat je moet stoppen.

   Ze staan naast de tekeningen van scene.js en niet erin, want die tekent
   kruispunten van bovenaf en deze vier vragen elk een eigen blik: een
   zijaanzicht met een schaal, een blik van bovenaf op een enkele auto, een
   spoor, en een mens.

   Net als scene.js zijn ze niet thema-afhankelijk: dezelfde tekening in
   licht en donker, want asfalt is grijs en een hesje is geel. De cijfers in
   het remwegdiagram komen uit dezelfde formules als het feitenregister
   (F085 en F090), zodat een vraag en een tekening nooit iets anders kunnen
   beweren. */
import { t } from "./taal.js";

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ASFALT = "#2A2F36", MARK = "#F7F7F4", BERM = "#B9C3A8", FIETSPAD = "#B84A3A";
const BLAUW = "#0B5CAD", BLAUW_ZACHT = "#9CC4EA", GEEL = "#F2B705", INKT = "#15181C", GRIJS = "#8A9099", GROEN = "#1E7F4F";

/* een getal zoals het boek het schrijft: komma, en geen ,00 */
const getal = n => { const s = n.toFixed(2).replace(".", ","); return s.endsWith(",00") ? s.slice(0, -3) : s; };

/* ==== 1 reactieafstand, remweg en stopafstand ====

   F085: reactieafstand = ((v : 2) + 10%) : 2
   F090: remweg = (v : 10) x (v : 10) : 2
   De remweg loopt kwadratisch op, en dat is precies wat een tabel niet laat
   zien en een balk wel. */
export function remwegCijfers(v) {
  const reactie = (v / 2) * 1.1 / 2;
  const rem = (v / 10) * (v / 10) / 2;
  return { reactie, rem, stop: reactie + rem };
}

export function remwegSvg(v) {
  const { reactie, rem, stop } = remwegCijfers(v);
  const x0 = 30, x1 = 386, METER = (x1 - x0) / 125;
  const yTop = 52, yH = 40, yMid = yTop + yH / 2;
  const xReactie = x0 + reactie * METER;
  const xStop = x0 + stop * METER;
  const ticks = [0, 25, 50, 75, 100, 125].map(m => {
    const x = x0 + m * METER;
    return `<line x1="${x}" y1="${yTop + yH}" x2="${x}" y2="${yTop + yH + 4}" stroke="${INKT}" stroke-opacity=".4"/><text x="${x}" y="${yTop + yH + 16}" font-size="10" fill="${INKT}" fill-opacity=".6" text-anchor="middle">${m === 125 ? m + " m" : m}</text>`;
  }).join("");
  const auto = `<g transform="translate(${x0 - 2} ${yMid})"><rect x="-26" y="-8" width="26" height="16" rx="3" fill="${MARK}" stroke="${INKT}" stroke-width="1"/><rect x="-19" y="-6" width="9" height="12" rx="2" fill="${BLAUW_ZACHT}"/><circle cx="-6" cy="0" r="2.5" fill="${BLAUW}"/></g>`;
  return `<svg viewBox="0 0 400 150" class="diagramvlak" role="img" aria-label="${esc(t("Bij {v} km/u is de reactieafstand {r} meter, de remweg {b} meter en de stopafstand {s} meter.", { v, r: getal(reactie), b: getal(rem), s: getal(stop) }))}">
    <text x="${x0}" y="20" font-size="12" font-weight="600" fill="${INKT}">${esc(t("je ziet het gevaar"))}</text>
    <line x1="${x0}" y1="26" x2="${x0}" y2="${yTop + yH + 6}" stroke="${INKT}" stroke-width="1" stroke-dasharray="3 3"/>
    <rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="${yH}" fill="${ASFALT}"/>
    <rect x="${x0}" y="${yTop}" width="${xReactie - x0}" height="${yH}" fill="${BLAUW_ZACHT}"/>
    <rect x="${xReactie}" y="${yTop}" width="${xStop - xReactie}" height="${yH}" fill="${BLAUW}"/>
    <line x1="${x0}" y1="${yMid}" x2="${x1}" y2="${yMid}" stroke="${MARK}" stroke-width="2" stroke-dasharray="10 8" stroke-opacity=".35"/>
    ${auto}
    <line x1="${xStop}" y1="${yTop - 10}" x2="${xStop}" y2="${yTop + yH + 6}" stroke="${INKT}" stroke-width="2"/>
    <text x="${Math.min(xStop + 4, 330)}" y="${yTop - 14}" font-size="12" font-weight="600" fill="${INKT}">${esc(t("stilstand"))}</text>
    ${ticks}
    <g font-size="12">
      <rect x="${x0}" y="118" width="10" height="10" fill="${BLAUW_ZACHT}"/>
      <text x="${x0 + 15}" y="127" fill="${INKT}">${esc(t("reactie"))} ${getal(reactie)}</text>
      <rect x="${x0 + 110}" y="118" width="10" height="10" fill="${BLAUW}"/>
      <text x="${x0 + 125}" y="127" fill="${INKT}">${esc(t("remmen"))} ${getal(rem)}</text>
      <text x="${x1}" y="127" fill="${INKT}" font-weight="700" text-anchor="end">${esc(t("stopafstand"))} ${getal(stop)} m</text>
    </g>
  </svg>`;
}

function remwegHtml(v = 50) {
  return `<div class="diagramvel">${remwegSvg(v)}</div>
    <div class="schuif">
      <label for="remweg-v">${esc(t("snelheid"))}</label>
      <input id="remweg-v" type="range" min="10" max="130" step="10" value="${v}" data-actie="remweg" aria-label="${esc(t("snelheid"))}">
      <output class="cijfer cijfer-klein" data-remweg-uit>${v} km/u</output>
    </div>`;
}

/* ==== 2 de dode hoek ====

   Van bovenaf, want dat is de enige blik waarin je ziet dat de spiegel en
   je ooghoek elkaar niet raken. De kegels zijn wat de spiegels je geven,
   de gearceerde punten zijn wat er tussenuit valt. */
function dodehoekHtml() {
  const arcering = `<pattern id="dh-arcering" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="${GEEL}" stroke-width="3"/></pattern>`;
  /* jouw auto staat op de rechterrijstrook, de spiegels zitten op 158 */
  const L = 250, R = 288, Y = 158;
  return `<div class="diagramvel"><svg viewBox="0 0 400 330" class="diagramvlak" role="img" aria-label="${esc(t("Van bovenaf: jij rijdt naar boven op de rechterrijstrook. Wat je spiegels je geven is licht ingekleurd. Daartussen blijft links en rechts schuin achter je een gearceerde punt over: daar staat een auto die je inhaalt en een fietser, en die zie je alleen door over je schouder te kijken."))}">
    <defs>${arcering}</defs>
    <rect x="0" y="0" width="400" height="300" fill="${BERM}"/>
    <rect x="60" y="0" width="270" height="300" fill="${ASFALT}"/>
    <rect x="330" y="0" width="26" height="300" fill="${FIETSPAD}"/>
    <line x1="196" y1="0" x2="196" y2="300" stroke="${MARK}" stroke-width="3" stroke-dasharray="16 14"/>
    <line x1="330" y1="0" x2="330" y2="300" stroke="${MARK}" stroke-width="2"/>

    <polygon points="${L},${Y} 60,250 60,300 120,300" fill="${MARK}" fill-opacity=".22"/>
    <polygon points="${R},${Y} 372,300 396,300 396,262" fill="${MARK}" fill-opacity=".22"/>
    <polygon points="${L},${Y} 120,300 215,300" fill="url(#dh-arcering)" fill-opacity=".6"/>
    <polygon points="${R},${Y} 300,300 372,300" fill="url(#dh-arcering)" fill-opacity=".6"/>

    <g transform="translate(200 252)"><rect x="-16" y="-30" width="32" height="60" rx="6" fill="${GRIJS}" stroke="${INKT}" stroke-width="1.2"/><rect x="-11" y="-19" width="22" height="15" rx="3" fill="${INKT}" fill-opacity=".35"/></g>
    <g transform="translate(343 244)"><rect x="-5" y="-11" width="10" height="22" rx="4" fill="${GROEN}" stroke="${INKT}" stroke-width="1"/><circle cx="0" cy="-14" r="4.5" fill="${GROEN}" stroke="${INKT}" stroke-width="1"/></g>

    <g transform="translate(269 175)">
      <rect x="-17" y="-34" width="34" height="68" rx="6" fill="${MARK}" stroke="${INKT}" stroke-width="1.5"/>
      <rect x="-12" y="-22" width="24" height="18" rx="3" fill="${BLAUW_ZACHT}"/>
      <rect x="-12" y="8" width="24" height="14" rx="3" fill="${BLAUW_ZACHT}" fill-opacity=".6"/>
      <circle cx="0" cy="-2" r="4" fill="${BLAUW}"/>
      <rect x="-23" y="-20" width="6" height="10" rx="2" fill="${INKT}"/>
      <rect x="17" y="-20" width="6" height="10" rx="2" fill="${INKT}"/>
    </g>
    <text x="269" y="128" font-size="12" font-weight="700" fill="${MARK}" text-anchor="middle">${esc(t("jij"))}</text>

    <rect x="0" y="300" width="400" height="30" fill="${MARK}"/>
    <g font-size="12" fill="${INKT}">
      <rect x="14" y="309" width="12" height="12" fill="url(#dh-arcering)" fill-opacity=".6" stroke="${INKT}" stroke-opacity=".3"/>
      <text x="32" y="319">${esc(t("dode hoek"))}</text>
      <rect x="150" y="309" width="12" height="12" fill="${ASFALT}" fill-opacity=".22" stroke="${INKT}" stroke-opacity=".3"/>
      <text x="168" y="319">${esc(t("wat je spiegels je geven"))}</text>
    </g>
  </svg></div>`;
}

/* ==== 3 de andreaskruisen ====

   Een kruis of twee kruisen: het enige verschil is het aantal sporen, en
   dat is precies wat er in een vraag toe doet. De borden komen uit de
   sprite, dus het zijn dezelfde tekeningen als overal in de app. */
function andreaskruisHtml() {
  const paneel = (x, code, sporen, tekst) => {
    const rails = [];
    for (let i = 0; i < sporen; i++) {
      const y = 150 + i * 26;
      rails.push(`<g><line x1="${x + 6}" y1="${y}" x2="${x + 174}" y2="${y}" stroke="${INKT}" stroke-width="3"/><line x1="${x + 6}" y1="${y + 9}" x2="${x + 174}" y2="${y + 9}" stroke="${INKT}" stroke-width="3"/>${[0, 1, 2, 3, 4, 5].map(k => `<line x1="${x + 16 + k * 30}" y1="${y - 3}" x2="${x + 16 + k * 30}" y2="${y + 12}" stroke="${INKT}" stroke-width="5" stroke-opacity=".45"/>`).join("")}</g>`);
    }
    return `<g>
      <rect x="${x}" y="40" width="180" height="${sporen > 1 ? 152 : 126}" rx="10" fill="none" stroke="${INKT}" stroke-opacity=".18"/>
      <rect x="${x + 78}" y="120" width="4" height="${sporen > 1 ? 68 : 42}" fill="${INKT}" fill-opacity=".5"/>
      <use href="#sign-${esc(code)}" x="${x + 40}" y="${sporen > 1 ? 52 : 56}" width="80" height="80"/>
      ${rails.join("")}
      <text x="${x + 90}" y="30" font-size="13" font-weight="700" fill="${INKT}" text-anchor="middle">${esc(code)}</text>
      <text x="${x + 90}" y="${sporen > 1 ? 212 : 212}" font-size="12" fill="${INKT}" text-anchor="middle">${esc(tekst)}</text>
    </g>`;
  };
  return `<div class="diagramvel"><svg viewBox="0 0 400 230" class="diagramvlak" role="img" aria-label="${esc(t("Links een andreaskruis met een balk, dat hoort bij een overweg met een spoor. Rechts een kruis met twee balken, dat hoort bij een overweg met twee of meer sporen."))}">
    ${paneel(6, "J12", 1, t("een spoor"))}
    ${paneel(214, "J13", 2, t("twee of meer sporen"))}
  </svg></div>`;
}

/* ==== 4 de handsignalen ====

   Acht foto's in het boek op pagina 255, waarvan dit er zes zijn: de twee
   die overblijven zijn het bord van de verkeersbrigadier en de agent die
   het kruispunt vrij laat maken. Een poppetje is genoeg, want het gaat om
   de stand van de arm en om de kant waar je vandaan komt. */
const POPPETJE = {
  omhoog: `<line x1="0" y1="-14" x2="0" y2="22" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="-8" x2="0" y2="-40" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="-10" y2="44" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="10" y2="44" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="-4" x2="14" y2="12" stroke="${INKT}" stroke-width="3"/>`,
  opzij: `<line x1="0" y1="-14" x2="0" y2="22" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="-8" x2="-30" y2="-8" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="-4" x2="14" y2="12" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="-10" y2="44" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="10" y2="44" stroke="${INKT}" stroke-width="3"/>`,
  beide: `<line x1="0" y1="-14" x2="0" y2="22" stroke="${INKT}" stroke-width="3"/><line x1="-30" y1="-8" x2="30" y2="-8" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="-10" y2="44" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="10" y2="44" stroke="${INKT}" stroke-width="3"/>`,
  vooruit: `<line x1="0" y1="-14" x2="0" y2="22" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="-8" x2="26" y2="-8" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="-8" y2="44" stroke="${INKT}" stroke-width="3"/><line x1="0" y1="22" x2="12" y2="44" stroke="${INKT}" stroke-width="3"/>`,
};
function figuur(x, y, houding, rug, extra = "") {
  const hesje = `<rect x="-11" y="-14" width="22" height="30" rx="4" fill="${GEEL}" stroke="${INKT}" stroke-width="1.5"/>`;
  const hoofd = rug
    ? `<circle cx="0" cy="-28" r="10" fill="${INKT}" fill-opacity=".85"/>`
    : `<circle cx="0" cy="-28" r="10" fill="${MARK}" stroke="${INKT}" stroke-width="2"/><circle cx="-3.5" cy="-29" r="1.4" fill="${INKT}"/><circle cx="3.5" cy="-29" r="1.4" fill="${INKT}"/>`;
  return `<g transform="translate(${x} ${y})">${POPPETJE[houding]}${hesje}${hoofd}${extra}</g>`;
}
function handsignalenHtml() {
  const panelen = [
    { houding: "omhoog", rug: false, tekst: t("algemeen stopteken") },
    { houding: "opzij", rug: false, tekst: t("stop voor verkeer van voren") },
    { houding: "opzij", rug: true, tekst: t("stop voor verkeer van achteren") },
    { houding: "beide", rug: false, tekst: t("stop voor voren en achteren") },
    { houding: "vooruit", rug: false, zij: true, tekst: t("stop voor verkeer van rechts") },
    { houding: "vooruit", rug: false, zij: true, beweeg: true, tekst: t("teken tot langzamer rijden") },
  ];
  const cel = (p, i) => {
    const kol = i % 3, rij = Math.floor(i / 3);
    const x = 66 + kol * 134, y = 76 + rij * 150;
    const extra = p.beweeg ? `<path d="M30 -18 l0 -8 M30 2 l0 8" stroke="${INKT}" stroke-width="2" stroke-linecap="round" opacity=".6"/><path d="M26 -22 l4 -5 l4 5 M26 6 l4 5 l4 -5" fill="none" stroke="${INKT}" stroke-width="2" opacity=".6"/>` : "";
    const woorden = p.tekst.split(" ");
    const helft = Math.ceil(woorden.length / 2);
    return `${figuur(x, y, p.houding, p.rug, extra)}
      <text x="${x}" y="${y + 66}" font-size="11" fill="${INKT}" text-anchor="middle">${esc(woorden.slice(0, helft).join(" "))}</text>
      <text x="${x}" y="${y + 80}" font-size="11" fill="${INKT}" text-anchor="middle">${esc(woorden.slice(helft).join(" "))}</text>`;
  };
  return `<div class="diagramvel"><svg viewBox="0 0 400 310" class="diagramvlak" role="img" aria-label="${esc(t("Zes houdingen van een verkeersregelaar: een arm recht omhoog is het algemene stopteken, een arm opzij stopt het verkeer dat hem van voren nadert, met de rug naar je toe stopt het het verkeer van achteren, beide armen opzij stoppen beide richtingen, zijwaarts met een arm naar voren stopt het verkeer van rechts, en dezelfde arm die op en neer beweegt betekent langzamer rijden."))}">
    ${panelen.map(cel).join("")}
  </svg></div>`;
}

/* ==== de deur naar buiten ==== */
const DIAGRAMMEN = {
  remweg: { html: remwegHtml, titel: () => t("Reactieafstand, remweg en stopafstand") },
  dodehoek: { html: dodehoekHtml, titel: () => t("De dode hoek") },
  andreaskruis: { html: andreaskruisHtml, titel: () => t("Een kruis of twee kruisen") },
  handsignalen: { html: handsignalenHtml, titel: () => t("De hand van de verkeersregelaar") },
};
export const kentDiagram = naam => Object.prototype.hasOwnProperty.call(DIAGRAMMEN, naam);
export const diagramNamen = () => Object.keys(DIAGRAMMEN);

export function diagramHtml(naam, bijschrift) {
  const d = DIAGRAMMEN[naam];
  if (!d) return `<div class="plaat scene-placeholder">${esc(t("{ref} ontbreekt", { ref: naam }))}</div>`;
  return `<figure class="diagram" data-diagram="${esc(naam)}">
    <figcaption class="diagramkop">${esc(d.titel())}</figcaption>
    ${d.html()}
    ${bijschrift ? `<figcaption class="meta">${esc(bijschrift)}</figcaption>` : ""}
  </figure>`;
}
