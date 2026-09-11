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
/* geel op wit haalt geen enkele contrasteis, dus tekst die geel hoort te zijn
   krijgt deze donkere amber en het kader blijft GEEL */
const AMBER = "#8A6400";

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

/* ==== 5 de voertuigen en waar ze onder vallen ====

   De wet werkt met dozen in dozen, en het examen vraagt bijna altijd naar de
   randen: een bromfiets is wel een motorrijtuig maar geen motorvoertuig, een
   brommobiel heet bromfiets maar rijdt naar de regels van een motorvoertuig.
   In een zin lees je daar overheen; in een tekening zie je de doos. */
function doos(x, y, w, h, kleur, vulling) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${vulling}" stroke="${kleur}" stroke-width="2"/>`;
}
function label(x, y, tekst, opties = {}) {
  const { grootte = 13, gewicht = 500, kleur = INKT, midden = true } = opties;
  return `<text x="${x}" y="${y}" font-size="${grootte}" font-weight="${gewicht}" fill="${kleur}" text-anchor="${midden ? "middle" : "start"}">${esc(tekst)}</text>`;
}

function voertuigenHtml() {
  const rij = (y, naam, sub) => label(0, y, naam, { grootte: 12, midden: false }) + (sub ? label(0, y + 15, sub, { grootte: 11, kleur: GRIJS, midden: false }) : "");
  return `<svg class="schema" viewBox="0 0 340 300" role="img" aria-label="${esc(t("Voertuigen en waar ze onder vallen"))}">
    ${doos(6, 6, 328, 288, GRIJS, "none")}
    ${label(170, 24, t("Voertuig"), { grootte: 14, gewicht: 700 })}
    ${label(170, 40, t("fiets, bromfiets, gehandicaptenvoertuig, motorvoertuig, tram, wagen"), { grootte: 10, kleur: GRIJS })}

    ${doos(16, 52, 308, 170, BLAUW, "rgba(11,92,173,.06)")}
    ${label(170, 70, t("Motorrijtuig"), { grootte: 13, gewicht: 700, kleur: BLAUW })}
    ${label(170, 84, t("alles met een motor, behalve tram en e-bike"), { grootte: 10, kleur: GRIJS })}

    ${doos(26, 96, 288, 74, GROEN, "rgba(30,127,79,.07)")}
    ${label(170, 114, t("Motorvoertuig"), { grootte: 13, gewicht: 700, kleur: GROEN })}
    ${label(170, 132, t("auto, motor, vrachtauto, bus, brommobiel*"), { grootte: 11 })}
    ${label(170, 150, t("* heet bromfiets, rijdt naar de regels hiervan"), { grootte: 10, kleur: GRIJS })}

    ${doos(26, 178, 288, 34, GEEL, "rgba(242,183,5,.10)")}
    ${label(170, 199, t("Bromfiets, snorfiets, speed-pedelec"), { grootte: 12, gewicht: 600 })}

    ${doos(16, 232, 308, 54, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 250, t("Wel voertuig, geen motorrijtuig"), { grootte: 12, gewicht: 600, kleur: GRIJS })}
    ${label(170, 268, t("tram, fiets met trapondersteuning, gehandicaptenvoertuig"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}

/* ==== 6 voetganger of bestuurder ====

   Twee hoofdgroepen en een handvol gevallen die net de andere kant op vallen
   dan je denkt. Het boek zet ze in een opsomming; naast elkaar zie je meteen
   waar de grens loopt. */
function weggebruikersHtml() {
  const kolom = (x, items, kleur) => items.map((s, i) => label(x, 108 + i * 20, s, { grootte: 11, midden: false, kleur })).join("");
  return `<svg class="schema" viewBox="0 0 340 290" role="img" aria-label="${esc(t("Voetganger of bestuurder"))}">
    ${label(170, 22, t("Weggebruiker"), { grootte: 14, gewicht: 700 })}
    <path d="M170 30 V46 M60 46 H280 M60 46 V60 M280 46 V60" stroke="${GRIJS}" stroke-width="2" fill="none"/>

    ${doos(10, 60, 150, 212, GROEN, "rgba(30,127,79,.07)")}
    ${label(85, 80, t("Voetganger"), { grootte: 13, gewicht: 700, kleur: GROEN })}
    ${label(85, 95, t("te voet"), { grootte: 10, kleur: GRIJS })}
    ${kolom(20, [t("lopend"), t("kinderwagen"), t("rollator"), t("fiets aan de hand"), t("rolschaatser"), t("skateboarder"), t("scootmobiel op"), t("de stoep")], INKT)}

    ${doos(180, 60, 150, 212, BLAUW, "rgba(11,92,173,.06)")}
    ${label(255, 80, t("Bestuurder"), { grootte: 13, gewicht: 700, kleur: BLAUW })}
    ${label(255, 95, t("al het andere"), { grootte: 10, kleur: GRIJS })}
    ${kolom(190, [t("automobilist"), t("fietser"), t("bromfietser"), t("trambestuurder"), t("ruiter te paard"), t("paard aan de hand"), t("vee drijven"), t("koetsier")], INKT)}
  </svg>`;
}

/* ==== 7 de rangorde ====

   Vier treden, en het examen vraagt vooral wie de ander overstemt. Een ladder
   van boven naar beneden is hier de hele uitleg. */
function rangordeHtml() {
  const trap = (y, h, kleur, vul, titel, sub) =>
    doos(30, y, 280, h, kleur, vul) + label(170, y + 22, titel, { grootte: 13, gewicht: 700, kleur }) + label(170, y + 38, sub, { grootte: 10, kleur: GRIJS });
  return `<svg class="schema" viewBox="0 0 340 280" role="img" aria-label="${esc(t("De rangorde"))}">
    ${trap(8, 50, GROEN, "rgba(30,127,79,.10)", t("1. Aanwijzing"), t("agent, verkeersregelaar, brigadier"))}
    ${trap(70, 50, BLAUW, "rgba(11,92,173,.10)", t("2. Verkeerslicht"), t("gaat voor borden die voorrang regelen"))}
    ${trap(132, 50, GEEL, "rgba(242,183,5,.14)", t("3. Bord of teken"), t("borden en tekens op het wegdek"))}
    ${trap(194, 50, GRIJS, "rgba(138,144,153,.10)", t("4. Verkeersregel"), t("de gewone regels, zoals rechts gaat voor"))}
    <path d="M16 20 V236" stroke="${GRIJS}" stroke-width="2" fill="none"/>
    <path d="M16 236 l-5 -8 h10 z" fill="${GRIJS}"/>
    ${label(170, 268, t("Hoger op de ladder overstemt alles eronder"), { grootte: 11, kleur: GRIJS })}
  </svg>`;
}


/* ==== 8 de standaardmaxima als staven ====
   Een tabel met snelheden lees je als losse getallen. Als staaf zie je in een
   oogopslag dat buiten de kom bijna twee keer zo hard gaat als erbinnen. */
function snelhedenHtml() {
  const rijen = [
    [t("binnen de bebouwde kom"), 50, GROEN],
    [t("buiten de kom, overige wegen"), 80, GEEL],
    [t("autoweg buiten de kom"), 100, BLAUW],
    [t("autosnelweg, 6 tot 19 uur"), 100, BLAUW],
    [t("autosnelweg, 19 tot 6 uur"), 130, INKT],
  ];
  const x0 = 12, breed = 200, schaal = breed / 130;
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("De standaardmaxima"))}">
    ${rijen.map(([naam, v, kleur], i) => {
      const y = 16 + i * 34;
      return `<text x="${x0}" y="${y}" font-size="11" fill="${GRIJS}">${esc(naam)}</text>
        <rect x="${x0}" y="${y + 5}" width="${(v * schaal).toFixed(1)}" height="14" rx="3" fill="${kleur}" opacity="0.85"/>
        <text x="${x0 + v * schaal + 8}" y="${y + 16}" font-size="12" font-weight="700" fill="${kleur}">${v} km/u</text>`;
    }).join("")}
    <text x="${x0}" y="192" font-size="10" fill="${GRIJS}">${esc(t("Borden kunnen altijd een lager maximum aangeven"))}</text>
  </svg>`;
}

/* ==== 9 stilstaan, parkeren, of geen van beide ==== */
function stilstaanHtml() {
  const lijst = (x, items) => items.map((s, i) => `<text x="${x}" y="${106 + i * 19}" font-size="11" fill="${INKT}">${esc(s)}</text>`).join("");
  return `<svg class="schema" viewBox="0 0 340 250" role="img" aria-label="${esc(t("Stilstaan of parkeren"))}">
    ${label(170, 20, t("Je staat vrijwillig stil"), { grootte: 13, gewicht: 700 })}
    <path d="M170 28 V44 M58 44 H282 M58 44 V58 M282 44 V58" stroke="${GRIJS}" stroke-width="2" fill="none"/>
    ${doos(10, 58, 150, 110, GROEN, "rgba(30,127,79,.07)")}
    ${label(85, 78, t("Stilstaan"), { grootte: 13, gewicht: 700, kleur: GROEN })}
    ${label(85, 93, t("en je bent er ook mee bezig"), { grootte: 9, kleur: GRIJS })}
    ${lijst(20, [t("in- of uitstappen"), t("laden of lossen"), t("en niet langer dan nodig")])}
    ${doos(180, 58, 150, 110, GEEL, "rgba(242,183,5,.12)")}
    ${label(255, 78, t("Parkeren"), { grootte: 13, gewicht: 700, kleur: INKT })}
    ${label(255, 93, t("al het andere"), { grootte: 9, kleur: GRIJS })}
    ${lijst(190, [t("wachten op iemand"), t("even een boodschap"), t("stilstaand bellen")])}
    ${doos(10, 182, 320, 56, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 202, t("Geen van beide: je moest wel"), { grootte: 12, gewicht: 600, kleur: GRIJS })}
    ${label(170, 222, t("rood licht, voorrang verlenen, file"), { grootte: 11 })}
  </svg>`;
}

/* ==== 10 de twee alcoholgrenzen ==== */
function alcoholHtml() {
  const x0 = 30, breed = 250, max = 1.0;
  const px = v => x0 + (v / max) * breed;
  const balk = (y, naam, grens, kleur) => `
    <text x="${x0}" y="${y}" font-size="11" fill="${GRIJS}">${esc(naam)}</text>
    <rect x="${x0}" y="${y + 6}" width="${breed}" height="12" rx="3" fill="rgba(138,144,153,.18)"/>
    <rect x="${x0}" y="${y + 6}" width="${(px(grens) - x0).toFixed(1)}" height="12" rx="3" fill="${kleur}" opacity="0.8"/>
    <path d="M${px(grens).toFixed(1)} ${y + 2} V${y + 24}" stroke="${kleur}" stroke-width="2"/>
    <text x="${px(grens).toFixed(1)}" y="${y + 36}" font-size="12" font-weight="700" fill="${kleur}" text-anchor="middle">${esc(grens.toFixed(1).replace(".", ","))}</text>`;
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("De twee alcoholgrenzen"))}">
    ${balk(18, t("beginnende bestuurder"), 0.2, GROEN)}
    ${balk(78, t("ervaren bestuurder"), 0.5, BLAUW)}
    <text x="${x0}" y="148" font-size="10" fill="${GRIJS}">0</text>
    <text x="${x0 + breed}" y="148" font-size="10" fill="${GRIJS}" text-anchor="end">1,0 ${esc(t("promille"))}</text>
    ${doos(10, 156, 320, 38, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 172, t("Een standaardglas is 0,2 tot 0,3 promille"), { grootte: 10, gewicht: 600 })}
    ${label(170, 187, t("en dat breek je pas in ongeveer anderhalf uur af"), { grootte: 9, kleur: GRIJS })}
  </svg>`;
}

/* ==== 11 duurzaam veilig: drie soorten wegen ==== */
function duurzaamveiligHtml() {
  const kaart = (x, kleur, naam, taak, snelheid) => {
    const inkt = kleur === GEEL ? AMBER : kleur;
    return doos(x, 30, 100, 150, kleur, "rgba(0,0,0,.03)") +
      label(x + 50, 52, naam, { grootte: 11, gewicht: 700, kleur: inkt }) +
      label(x + 50, 74, taak, { grootte: 10, kleur: GRIJS }) +
      `<text x="${x + 50}" y="120" font-size="17" font-weight="700" fill="${inkt}" text-anchor="middle">${esc(snelheid)}</text>`;
  };
  return `<svg class="schema" viewBox="0 0 340 210" role="img" aria-label="${esc(t("Drie soorten wegen"))}">
    ${label(170, 18, t("Duurzaam veilig kent drie soorten wegen"), { grootte: 12, gewicht: 600 })}
    ${kaart(8, BLAUW, t("Stroomweg"), t("doorstromen"), "100 / 130")}
    ${kaart(120, GEEL, t("Gebiedsontsluiting"), t("gebied ontsluiten"), "50 / 70 / 80")}
    ${kaart(232, GROEN, t("Erftoegangsweg"), t("erven ontsluiten"), "30 / 60")}
    ${label(58, 150, t("autoweg, autosnelweg"), { grootte: 9, kleur: GRIJS })}
    ${label(170, 150, t("gelijkvloerse kruisingen"), { grootte: 9, kleur: GRIJS })}
    ${label(282, 150, t("gemengd verkeer"), { grootte: 9, kleur: GRIJS })}
    ${label(170, 200, t("km/u, binnen en buiten de bebouwde kom"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}

/* ==== 12 welk licht wanneer ==== */
function lichtenHtml() {
  const rij = (y, naam, wanneer, kleur) =>
    doos(10, y, 320, 38, kleur, "rgba(0,0,0,.03)") +
    label(80, y + 17, naam, { grootte: 12, gewicht: 700, kleur: kleur === GEEL ? AMBER : kleur }) +
    `<text x="150" y="${y + 17}" font-size="10" fill="${GRIJS}">${esc(wanneer)}</text>`;
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("Welk licht wanneer"))}">
    ${rij(8, t("Dimlicht"), t("'s nachts, en overdag onder 200 meter zicht"), BLAUW)}
    ${rij(52, t("Dagrijlicht"), t("overdag, als dimlicht niet verplicht is"), GRIJS)}
    ${rij(96, t("Stadslicht"), t("alleen om stil te staan, nooit om te rijden"), GEEL)}
    ${rij(140, t("Groot licht"), t("alleen 's nachts, als dimlicht te weinig is"), INKT)}
    ${label(170, 192, t("Stadslicht is geen rijlicht"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}

/* ==== 13 de twee mistlichten ==== */
function mistlichtenHtml() {
  const x0 = 20, breed = 300;
  /* 200 meter links, 0 rechts: hoe slechter het zicht, hoe verder naar rechts */
  const px = m => x0 + ((200 - m) / 200) * breed;
  return `<svg class="schema" viewBox="0 0 340 210" role="img" aria-label="${esc(t("De twee mistlichten"))}">
    <rect x="${x0}" y="26" width="${breed}" height="16" rx="3" fill="rgba(138,144,153,.18)"/>
    <text x="${x0}" y="20" font-size="10" fill="${GRIJS}">200 m</text>
    <text x="${px(50).toFixed(1)}" y="20" font-size="10" fill="${GRIJS}" text-anchor="middle">50 m</text>
    <text x="${x0 + breed}" y="20" font-size="10" fill="${GRIJS}" text-anchor="end">0 m</text>
    <path d="M${px(50).toFixed(1)} 24 V52" stroke="${GRIJS}" stroke-width="2" stroke-dasharray="3 3"/>

    <rect x="${px(200).toFixed(1)}" y="60" width="${(px(0) - px(200)).toFixed(1)}" height="30" rx="4" fill="rgba(242,183,5,.22)" stroke="${GEEL}" stroke-width="2"/>
    ${label(170, 80, t("Mistlicht voor: mag onder de 200 meter"), { grootte: 11, gewicht: 600 })}
    ${label(170, 100, t("bij mist, sneeuw of regen"), { grootte: 10, kleur: GRIJS })}

    <rect x="${px(50).toFixed(1)}" y="116" width="${(px(0) - px(50)).toFixed(1)}" height="30" rx="4" fill="rgba(184,74,58,.18)" stroke="${FIETSPAD}" stroke-width="2"/>
    ${label(282, 136, t("Mistachterlicht"), { grootte: 10, gewicht: 600 })}
    ${label(170, 162, t("pas onder de 50 meter, en nooit bij regen"), { grootte: 10, kleur: GRIJS })}
    ${doos(10, 174, 320, 30, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 194, t("Onder de 50 meter houd je drie seconden afstand"), { grootte: 11, gewicht: 600 })}
  </svg>`;
}

/* ==== 14 PAMAN, in volgorde ==== */
function pamanHtml() {
  const stap = (i, letter, woord, uitleg) => {
    const y = 8 + i * 38;
    return `<circle cx="26" cy="${y + 18}" r="14" fill="${BLAUW}"/>
      <text x="26" y="${y + 23}" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">${esc(letter)}</text>
      <text x="50" y="${y + 15}" font-size="12" font-weight="700" fill="${INKT}">${esc(woord)}</text>
      <text x="50" y="${y + 30}" font-size="10" fill="${GRIJS}">${esc(uitleg)}</text>
      ${i < 4 ? `<path d="M26 ${y + 32} V${y + 42}" stroke="${GRIJS}" stroke-width="2"/>` : ""}`;
  };
  return `<svg class="schema" viewBox="0 0 340 210" role="img" aria-label="PAMAN">
    ${stap(0, "P", t("Persoonlijke veiligheid"), t("eerst jezelf in veiligheid brengen"))}
    ${stap(1, "A", t("Andere betrokkenen"), t("daarna de veiligheid van de rest"))}
    ${stap(2, "M", t("Markeren"), t("de ongevalsplaats zichtbaar maken"))}
    ${stap(3, "A", t("Alarmeren"), t("112 bellen, zeg waar en wat"))}
    ${stap(4, "N", t("Noodzakelijke eerste hulp"), t("en pas dan helpen"))}
  </svg>`;
}

/* ==== 15 overtreding of misdrijf ==== */
function strafbaarHtml() {
  const lijst = (x, items, kleur) => items.map((s, i) => `<text x="${x}" y="${102 + i * 18}" font-size="10" fill="${kleur}">${esc(s)}</text>`).join("");
  return `<svg class="schema" viewBox="0 0 340 230" role="img" aria-label="${esc(t("Overtreding of misdrijf"))}">
    ${label(170, 20, t("Strafbaar feit"), { grootte: 13, gewicht: 700 })}
    <path d="M170 28 V44 M58 44 H282 M58 44 V58 M282 44 V58" stroke="${GRIJS}" stroke-width="2" fill="none"/>
    ${doos(10, 58, 150, 162, GEEL, "rgba(242,183,5,.10)")}
    ${label(85, 78, t("Overtreding"), { grootte: 12, gewicht: 700, kleur: INKT })}
    ${label(85, 92, t("meestal licht"), { grootte: 9, kleur: GRIJS })}
    ${lijst(20, [t("door rood rijden"), t("foutparkeren"), t("te hard rijden")], INKT)}
    ${label(85, 172, t("bekeuring per post"), { grootte: 10, kleur: GRIJS })}
    ${label(85, 188, t("zwaarder: officier"), { grootte: 10, kleur: GRIJS })}
    ${label(85, 204, t("van justitie"), { grootte: 10, kleur: GRIJS })}
    ${doos(180, 58, 150, 162, FIETSPAD, "rgba(184,74,58,.10)")}
    ${label(255, 78, t("Misdrijf"), { grootte: 12, gewicht: 700, kleur: FIETSPAD })}
    ${label(255, 92, t("ernstig"), { grootte: 9, kleur: GRIJS })}
    ${lijst(190, [t("rijden onder invloed"), t("doorrijden na ongeval"), t("rijden tijdens ontzegging")], INKT)}
    ${label(255, 172, t("altijd de rechter"), { grootte: 10, kleur: GRIJS })}
    ${label(255, 188, t("hoge boete, cel of"), { grootte: 10, kleur: GRIJS })}
    ${label(255, 204, t("ontzegging, strafblad"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}


/* ==== 16 weg, rijbaan, rijstrook ====
   De rijbaan is niet de weg, en het fietspad ligt er wel op maar hoort er niet
   bij. Dat verschil kost op het examen punten en in een zin lees je erover. */
function weggedeeltenHtml() {
  return `<svg class="schema" viewBox="0 0 340 210" role="img" aria-label="${esc(t("Weg, rijbaan en rijstrook"))}">
    ${doos(6, 26, 328, 150, INKT, "rgba(21,24,28,.04)")}
    ${label(170, 18, t("Weg: alles wat openstaat voor het verkeer"), { grootte: 12, gewicht: 700 })}

    <rect x="14" y="40" width="46" height="126" rx="4" fill="rgba(185,195,168,.5)" stroke="${GRIJS}" stroke-width="1"/>
    ${label(37, 106, t("berm"), { grootte: 10, kleur: GRIJS })}

    <rect x="66" y="40" width="46" height="126" rx="4" fill="rgba(184,74,58,.14)" stroke="${FIETSPAD}" stroke-width="2"/>
    ${label(89, 100, t("fietspad"), { grootte: 10, kleur: FIETSPAD })}
    ${label(89, 116, t("ligt ernaast"), { grootte: 8, kleur: GRIJS })}

    ${doos(120, 40, 210, 126, BLAUW, "rgba(11,92,173,.07)")}
    ${label(225, 58, t("Rijbaan"), { grootte: 12, gewicht: 700, kleur: BLAUW })}
    <rect x="130" y="68" width="60" height="88" rx="3" fill="rgba(11,92,173,.12)" stroke="${BLAUW}" stroke-width="1"/>
    ${label(160, 116, t("rijstrook"), { grootte: 10 })}
    <rect x="196" y="68" width="60" height="88" rx="3" fill="rgba(11,92,173,.12)" stroke="${BLAUW}" stroke-width="1"/>
    ${label(226, 116, t("rijstrook"), { grootte: 10 })}
    <rect x="262" y="68" width="58" height="88" rx="3" fill="rgba(242,183,5,.18)" stroke="${GEEL}" stroke-width="1"/>
    ${label(291, 108, t("fietsstrook"), { grootte: 9 })}
    ${label(291, 124, t("of busstrook"), { grootte: 9 })}

    ${label(170, 196, t("Een strook ligt op de rijbaan, een pad ligt ernaast"), { grootte: 11, gewicht: 600, kleur: GRIJS })}
  </svg>`;
}

/* ==== 17 de stroken op de snelweg ====
   Vier namen die allemaal "strook" heten en op de foto op elkaar lijken. Naast
   elkaar zie je waar ze liggen en wat er met de vluchtstrook gebeurt. */
function strokenHtml() {
  const strook = (x, w, vul, rand, naam, sub) =>
    `<rect x="${x}" y="36" width="${w}" height="110" rx="4" fill="${vul}" stroke="${rand}" stroke-width="2"/>` +
    label(x + w / 2, 100, naam, { grootte: 10, gewicht: 700 }) +
    (sub ? label(x + w / 2, 116, sub, { grootte: 8, kleur: GRIJS }) : "");
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("De stroken op de snelweg"))}">
    ${label(170, 18, t("Van links naar rechts op een autosnelweg"), { grootte: 11, gewicht: 600 })}
    ${label(28, 32, t("links"), { grootte: 8, kleur: GRIJS })}
    ${label(310, 32, t("rechts"), { grootte: 8, kleur: GRIJS })}
    ${strook(8, 56, "rgba(30,127,79,.14)", GROEN, t("plusstrook"), t("smaller"))}
    ${strook(68, 76, "rgba(42,47,54,.10)", GRIJS, t("rijstrook"), "")}
    ${strook(148, 76, "rgba(42,47,54,.10)", GRIJS, t("rijstrook"), "")}
    ${strook(228, 104, "rgba(242,183,5,.18)", GEEL, t("vluchtstrook"), t("of spitsstrook"))}
    ${doos(8, 154, 324, 40, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 170, t("Plusstrook links: de vluchtstrook blijft vrij"), { grootte: 10, gewicht: 600, kleur: GROEN })}
    ${label(170, 186, t("Spitsstrook rechts: de vluchtstrook is dan in gebruik"), { grootte: 10, gewicht: 600, kleur: AMBER })}
  </svg>`;
}


/* ==== 18 het examen in cijfers ====
   Vijftig vragen, vierenveertig goed, dus zes fout mag. Als balk zie je hoe
   smal die marge is, en dat is precies het punt. */
function examencijfersHtml() {
  const x0 = 20, breed = 300, per = breed / 50;
  return `<svg class="schema" viewBox="0 0 340 170" role="img" aria-label="${esc(t("Het examen in cijfers"))}">
    <rect x="${x0}" y="34" width="${(44 * per).toFixed(1)}" height="26" rx="4" fill="rgba(30,127,79,.85)"/>
    <rect x="${(x0 + 44 * per).toFixed(1)}" y="34" width="${(6 * per).toFixed(1)}" height="26" rx="4" fill="rgba(184,74,58,.75)"/>
    ${label(x0 + 22 * per, 52, t("44 goed"), { grootte: 13, gewicht: 700, kleur: "#fff" })}
    <path d="M${(x0 + 44 * per).toFixed(1)} 28 V66" stroke="${INKT}" stroke-width="2"/>
    ${label(x0 + 47 * per, 80, t("6 fout"), { grootte: 11, gewicht: 600, kleur: FIETSPAD })}
    ${label(170, 24, t("50 vragen, en dit is je hele marge"), { grootte: 12, gewicht: 700 })}
    ${doos(10, 92, 320, 66, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 112, t("30 minuten, dus 36 seconden per vraag"), { grootte: 11, gewicht: 600 })}
    ${label(170, 130, t("2 vragen tellen niet mee, en je weet niet welke"), { grootte: 10, kleur: GRIJS })}
    ${label(170, 148, t("Ongeveer 2 van de 3 vragen zijn inzichtvragen"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}

/* ==== 19 de twee secondenregel ==== */
function tweesecondenHtml() {
  const auto = (x, kleur) => `<rect x="${x}" y="46" width="44" height="24" rx="5" fill="${kleur}" stroke="${INKT}" stroke-width="1.5"/>`;
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("De twee secondenregel"))}">
    <rect x="0" y="36" width="340" height="44" fill="${ASFALT}"/>
    <path d="M0 58 H340" stroke="${MARK}" stroke-width="2" stroke-dasharray="14 12" opacity=".5"/>
    ${auto(30, MARK)}
    ${auto(250, GRIJS)}
    <path d="M78 84 H248" stroke="${BLAUW}" stroke-width="2"/>
    <path d="M78 84 l8 -5 v10 z M248 84 l-8 -5 v10 z" fill="${BLAUW}"/>
    ${label(163, 104, t("2 seconden"), { grootte: 13, gewicht: 700, kleur: BLAUW })}
    ${label(163, 120, t("bij 80 km/u is dat ongeveer 44 meter"), { grootte: 10, kleur: GRIJS })}
    ${label(52, 28, t("jij"), { grootte: 10, kleur: GRIJS })}
    ${label(272, 28, t("je voorligger"), { grootte: 10, kleur: GRIJS })}
    ${doos(10, 134, 320, 58, GEEL, "rgba(242,183,5,.12)")}
    ${label(170, 154, t("3 seconden bij regen, sneeuw of mist"), { grootte: 12, gewicht: 700, kleur: AMBER })}
    ${label(170, 172, t("en ook met een zware lading of een aanhangwagen"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}

/* ==== 20 de bakens voor een overweg ==== */
function bakensHtml() {
  const baken = (x, strepen, meters) => {
    let h = `<rect x="${x - 11}" y="58" width="22" height="40" rx="3" fill="#fff" stroke="${INKT}" stroke-width="1.5"/>`;
    for (let i = 0; i < strepen; i++) h += `<path d="M${x - 8} ${90 - i * 12} l16 -10" stroke="${FIETSPAD}" stroke-width="4" stroke-linecap="round"/>`;
    return h + `<text x="${x}" y="114" font-size="11" font-weight="700" fill="${INKT}" text-anchor="middle">${esc(meters)}</text>`;
  };
  return `<svg class="schema" viewBox="0 0 340 170" role="img" aria-label="${esc(t("De bakens voor een overweg"))}">
    <rect x="0" y="118" width="340" height="30" fill="${ASFALT}"/>
    <path d="M0 133 H300" stroke="${MARK}" stroke-width="2" stroke-dasharray="14 12" opacity=".5"/>
    ${label(170, 20, t("Elke schuine streep is 80 meter"), { grootte: 12, gewicht: 700 })}
    ${label(170, 36, t("Je rijdt van links naar rechts"), { grootte: 10, kleur: GRIJS })}
    ${baken(40, 3, "240 m")}
    ${baken(120, 2, "160 m")}
    ${baken(200, 1, "80 m")}
    <path d="M300 52 V148" stroke="${INKT}" stroke-width="3"/>
    <path d="M288 60 l24 24 M312 60 l-24 24" stroke="${FIETSPAD}" stroke-width="3"/>
    ${label(300, 40, t("overweg"), { grootte: 10, gewicht: 700, kleur: FIETSPAD })}
    ${label(300, 164, t("andreaskruis"), { grootte: 9, kleur: GRIJS })}
  </svg>`;
}

/* ==== 21 lading: de maten ==== */
function ladingHtml() {
  return `<svg class="schema" viewBox="0 0 340 210" role="img" aria-label="${esc(t("De maten van je lading"))}">
    ${label(170, 18, t("Van opzij: auto plus lading"), { grootte: 12, gewicht: 700 })}
    <rect x="90" y="70" width="130" height="34" rx="6" fill="rgba(138,144,153,.25)" stroke="${INKT}" stroke-width="1.5"/>
    <rect x="112" y="56" width="86" height="16" rx="3" fill="rgba(242,183,5,.35)" stroke="${GEEL}" stroke-width="1.5"/>
    <circle cx="118" cy="106" r="8" fill="${INKT}"/><circle cx="192" cy="106" r="8" fill="${INKT}"/>
    <path d="M60 50 V112" stroke="${BLAUW}" stroke-width="2"/>
    <path d="M60 50 l-4 7 h8 z M60 112 l-4 -7 h8 z" fill="${BLAUW}"/>
    ${label(38, 84, "4 m", { grootte: 11, gewicht: 700, kleur: BLAUW })}
    <path d="M220 120 H262" stroke="${GROEN}" stroke-width="2"/>
    <path d="M220 120 l7 -4 v8 z M262 120 l-7 -4 v8 z" fill="${GROEN}"/>
    ${label(241, 136, "1 m", { grootte: 10, gewicht: 700, kleur: GROEN })}
    ${label(241, 150, t("achter"), { grootte: 9, kleur: GRIJS })}
    <path d="M48 120 H90" stroke="${GROEN}" stroke-width="2"/>
    <path d="M48 120 l7 -4 v8 z M90 120 l-7 -4 v8 z" fill="${GROEN}"/>
    ${label(69, 136, "1 m", { grootte: 10, gewicht: 700, kleur: GROEN })}
    ${label(69, 150, t("alleen ondeelbaar"), { grootte: 8, kleur: GRIJS })}
    ${doos(10, 160, 320, 44, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 178, t("Breed mag 2,55 m, lang 12 m, met aanhanger samen 18 m"), { grootte: 10, gewicht: 600 })}
    ${label(170, 194, t("Op de imperiaal steekt lading hoogstens 20 cm opzij uit"), { grootte: 10, kleur: GRIJS })}
  </svg>`;
}

/* ==== 22 welke aanhanger mag je met rijbewijs B ==== */
function aanhangerHtml() {
  const trede = (y, h, kleur, vul, links, rechts) =>
    doos(10, y, 320, h, kleur, vul) +
    `<text x="24" y="${y + h / 2 + 4}" font-size="11" fill="${INKT}">${esc(links)}</text>` +
    `<text x="316" y="${y + h / 2 + 4}" font-size="13" font-weight="700" fill="${kleur === GEEL ? AMBER : kleur}" text-anchor="end">${esc(rechts)}</text>`;
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("Welke aanhanger met welk rijbewijs"))}">
    ${label(170, 16, t("Aanhanger en auto samen, en wat je daarvoor nodig hebt"), { grootte: 11, gewicht: 600 })}
    ${trede(26, 38, GROEN, "rgba(30,127,79,.10)", t("aanhanger tot en met 750 kg"), "B")}
    ${trede(70, 38, GROEN, "rgba(30,127,79,.10)", t("zwaarder, samen tot 3.500 kg"), "B")}
    ${trede(114, 38, GEEL, "rgba(242,183,5,.14)", t("samen 3.500 tot 4.250 kg"), "B96 / BE")}
    ${trede(158, 38, FIETSPAD, "rgba(184,74,58,.12)", t("samen boven 4.250 kg"), "BE")}
  </svg>`;
}

/* ==== 23 de vorm van een bord zegt wat het doet ==== */
function bordvormenHtml() {
  const kaart = (x, y, vorm, naam, wat) =>
    vorm + label(x, y + 46, naam, { grootte: 11, gewicht: 700 }) + label(x, y + 60, wat, { grootte: 9, kleur: GRIJS });
  const rond = (x, y, rand, vul) => `<circle cx="${x}" cy="${y + 18}" r="17" fill="${vul}" stroke="${rand}" stroke-width="4"/>`;
  const driehoek = (x, y) => `<path d="M${x} ${y + 2} l19 32 h-38 z" fill="#fff" stroke="${FIETSPAD}" stroke-width="4" stroke-linejoin="round"/>`;
  const ruit = (x, y) => `<path d="M${x} ${y} l17 18 l-17 18 l-17 -18 z" fill="${GEEL}" stroke="#fff" stroke-width="3"/>`;
  const rechthoek = (x, y) => `<rect x="${x - 20}" y="${y + 4}" width="40" height="28" rx="3" fill="${BLAUW}" stroke="#fff" stroke-width="2"/>`;
  return `<svg class="schema" viewBox="0 0 340 220" role="img" aria-label="${esc(t("De vorm van een bord"))}">
    ${label(170, 16, t("Aan de vorm en de kleur zie je al wat een bord doet"), { grootte: 11, gewicht: 600 })}
    ${kaart(55, 26, rond(55, 26, FIETSPAD, "#fff"), t("Rond, rode rand"), t("verbod of maximum"))}
    ${kaart(170, 26, rond(170, 26, BLAUW, BLAUW), t("Rond, blauw"), t("gebod: zo moet het"))}
    ${kaart(285, 26, driehoek(285, 26), t("Driehoek"), t("waarschuwing"))}
    ${kaart(55, 130, ruit(55, 130), t("Gele ruit"), t("voorrangsweg"))}
    ${kaart(170, 130, rechthoek(170, 130), t("Blauw vlak"), t("informatie"))}
    ${kaart(285, 130, rond(285, 130, GRIJS, "#fff"), t("Grijze rand"), t("einde van iets"))}
  </svg>`;
}


/* ==== 24 wat de belijning zegt ====
   De tekenmachine kan geen belijning sturen, en juist daar hangt de stof van
   blok 6, 7 en 8 aan. Als los diagram kan het wel, en dan zie je de drie
   wegbeelden onder elkaar in plaats van in een tabel. */
function belijningHtml() {
  const weg = (y, midden, kant, snelheid, wat) => {
    let h = `<rect x="10" y="${y}" width="250" height="40" fill="${ASFALT}"/>`;
    /* kantstrepen */
    if (kant === "door") h += `<path d="M14 ${y + 3} H256 M14 ${y + 37} H256" stroke="${MARK}" stroke-width="2.5"/>`;
    else h += `<path d="M14 ${y + 3} H256 M14 ${y + 37} H256" stroke="${MARK}" stroke-width="2.5" stroke-dasharray="10 8"/>`;
    /* middenstreep */
    if (midden === "groen") h += `<rect x="10" y="${y + 16}" width="250" height="8" fill="rgba(30,127,79,.55)"/><path d="M10 ${y + 16} H260 M10 ${y + 24} H260" stroke="${MARK}" stroke-width="2"/>`;
    else if (midden === "dubbel") h += `<path d="M10 ${y + 17} H260 M10 ${y + 23} H260" stroke="${MARK}" stroke-width="2"/>`;
    return h
      + `<text x="272" y="${y + 18}" font-size="15" font-weight="700" fill="${INKT}">${esc(snelheid)}</text>`
      + `<text x="272" y="${y + 33} " font-size="9" fill="${GRIJS}">km/u</text>`
      + `<text x="14" y="${y - 5}" font-size="10" fill="${GRIJS}">${esc(wat)}</text>`;
  };
  return `<svg class="schema" viewBox="0 0 340 232" role="img" aria-label="${esc(t("Wat de belijning zegt"))}">
    ${label(170, 14, t("De strepen verraden meestal de snelheid"), { grootte: 11, gewicht: 600 })}
    ${weg(36, "groen", "door", "100", t("groene baan tussen twee strepen, doorgetrokken kant"))}
    ${weg(102, "dubbel", "onder", "80", t("dubbele middenstreep, onderbroken kant"))}
    ${weg(168, "geen", "onder", "60", t("geen middenstreep, onderbroken kant"))}
    ${label(170, 226, t("Het blijft een aanwijzing: het bord is de zekerheid"), { grootte: 9, kleur: GRIJS })}
  </svg>`;
}

/* ==== 25 invoegen, stap voor stap ==== */
function invoegenHtml() {
  return `<svg class="schema" viewBox="0 0 340 200" role="img" aria-label="${esc(t("Invoegen op de snelweg"))}">
    <rect x="0" y="30" width="340" height="34" fill="${ASFALT}"/>
    <path d="M0 47 H340" stroke="${MARK}" stroke-width="2" stroke-dasharray="14 12" opacity=".5"/>
    ${label(40, 24, t("doorgaande rijbaan"), { grootte: 9, kleur: GRIJS, midden: false })}
    <path d="M20 104 L120 104 L230 70 L340 70" fill="none" stroke="${ASFALT}" stroke-width="30" stroke-linejoin="round"/>
    <path d="M120 90 L230 56" stroke="${MARK}" stroke-width="3" stroke-dasharray="12 10"/>
    ${label(20, 136, t("invoegstrook"), { grootte: 10, gewicht: 700, midden: false })}
    <rect x="26" y="96" width="30" height="16" rx="4" fill="${MARK}" stroke="${INKT}" stroke-width="1.5"/>
    <path d="M118 128 V104" stroke="${GEEL}" stroke-width="2" stroke-dasharray="3 3"/>
    ${label(150, 136, t("tweederde: hier heb je snelheid"), { grootte: 9, gewicht: 700, kleur: AMBER })}
    
    ${doos(10, 158, 320, 38, GRIJS, "rgba(138,144,53,.06)")}
    ${label(170, 174, t("Snelheid maken, kijken, pas laat richting aangeven"), { grootte: 10, gewicht: 600 })}
    ${label(170, 189, t("en het doorgaande verkeer gaat voor"), { grootte: 9, kleur: GRIJS })}
  </svg>`;
}

/* ==== 26 auto te water ==== */
function autotewaterHtml() {
  const stap = (i, woord, uitleg) => {
    const y = 26 + i * 40;
    return `<circle cx="26" cy="${y + 16}" r="13" fill="${BLAUW}"/>
      <text x="26" y="${y + 21}" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>
      <text x="48" y="${y + 13}" font-size="12" font-weight="700" fill="${INKT}">${esc(woord)}</text>
      <text x="48" y="${y + 28}" font-size="10" fill="${GRIJS}">${esc(uitleg)}</text>
      ${i < 3 ? `<path d="M26 ${y + 30} V${y + 42}" stroke="${GRIJS}" stroke-width="2"/>` : ""}`;
  };
  return `<svg class="schema" viewBox="0 0 340 230" role="img" aria-label="${esc(t("Auto te water"))}">
    ${label(170, 16, t("In deze volgorde, en geen andere"), { grootte: 11, gewicht: 600 })}
    ${stap(0, t("Licht aan"), t("binnen en buiten, sleutels in het contact"))}
    ${stap(1, t("Gordel los"), t("lukt dat niet, snij hem door naar je toe"))}
    ${stap(2, t("Zijruit open of stuk"), t("sla in de hoek bij de spiegel, nooit de voorruit"))}
    ${stap(3, t("Eruit en wegzwemmen"), t("eerst met je gezicht naar de auto toe"))}
    ${doos(10, 190, 320, 34, FIETSPAD, "rgba(184,74,58,.10)")}
    ${label(170, 211, t("Lukt de ruit niet: wacht tot hij vol is, dan kan het portier open"), { grootte: 9, gewicht: 600 })}
  </svg>`;
}

/* ==== 27 welke rijstrook kies je ==== */
function rijstrookkeuzeHtml() {
  const baan = (y, kleur, vul, tekst, sub) =>
    `<rect x="10" y="${y}" width="320" height="40" fill="${ASFALT}"/>` +
    `<rect x="10" y="${y}" width="320" height="40" fill="${vul}"/>` +
    `<text x="22" y="${y + 18}" font-size="11" font-weight="700" fill="#fff">${esc(tekst)}</text>` +
    `<text x="22" y="${y + 32}" font-size="9" fill="rgba(255,255,255,.75)">${esc(sub)}</text>`;
  return `<svg class="schema" viewBox="0 0 340 190" role="img" aria-label="${esc(t("Welke rijstrook kies je"))}">
    ${label(170, 14, t("Drie rijstroken, van boven naar beneden"), { grootte: 11, gewicht: 600 })}
    ${baan(22, BLAUW, "rgba(11,92,173,.55)", t("links: alleen om in te halen"), t("onnodig links rijden mag niet"))}
    ${baan(66, GRIJS, "rgba(138,144,153,.45)", t("midden: ook alleen om in te halen"), t("of om voor te sorteren"))}
    ${baan(110, GROEN, "rgba(30,127,79,.55)", t("rechts: hier hoor je"), t("vrachtauto's en lange combinaties altijd"))}
    ${doos(10, 158, 320, 28, GRIJS, "rgba(138,144,153,.08)")}
    ${label(170, 176, t("In de file schuif je op om invoegers erin te laten"), { grootte: 10, gewicht: 600 })}
  </svg>`;
}

/* ==== 28 ruimte maken voor een voorrangsvoertuig ==== */
function ruimtemakenHtml() {
  const auto = (x, y, kleur) => `<rect x="${x}" y="${y}" width="38" height="20" rx="5" fill="${kleur}" stroke="${INKT}" stroke-width="1.5"/>`;
  return `<svg class="schema" viewBox="0 0 340 190" role="img" aria-label="${esc(t("Ruimte maken in de file"))}">
    ${label(170, 16, t("File, en er komt een ambulance aan"), { grootte: 11, gewicht: 600 })}
    <rect x="10" y="28" width="320" height="96" fill="${ASFALT}"/>
    <path d="M170 28 V124" stroke="${MARK}" stroke-width="2" stroke-dasharray="10 8" opacity=".4"/>
    ${auto(16, 34, MARK)}${auto(16, 62, MARK)}${auto(16, 90, MARK)}
    ${auto(276, 34, GRIJS)}${auto(276, 62, GRIJS)}${auto(276, 90, GRIJS)}
    <rect x="150" y="36" width="40" height="22" rx="5" fill="${GEEL}" stroke="${INKT}" stroke-width="1.5"/>
    <circle cx="170" cy="32" r="4" fill="${BLAUW}"/>
    <path d="M170 70 V116" stroke="${BLAUW}" stroke-width="2" stroke-dasharray="5 5"/>
    <path d="M170 116 l-5 -8 h10 z" fill="${BLAUW}"/>
    ${label(86, 142, t("links: naar links"), { grootte: 9, kleur: GRIJS })}
    ${label(254, 142, t("rechts: naar rechts"), { grootte: 9, kleur: GRIJS })}
    ${doos(10, 152, 320, 34, GROEN, "rgba(30,127,79,.10)")}
    ${label(170, 173, t("Zo ontstaat er in het midden een vrije doorgang"), { grootte: 11, gewicht: 700, kleur: GROEN })}
  </svg>`;
}

const DIAGRAMMEN = {
  remweg: { html: remwegHtml, titel: () => t("Reactieafstand, remweg en stopafstand") },
  dodehoek: { html: dodehoekHtml, titel: () => t("De dode hoek") },
  andreaskruis: { html: andreaskruisHtml, titel: () => t("Een kruis of twee kruisen") },
  handsignalen: { html: handsignalenHtml, titel: () => t("De hand van de verkeersregelaar") },
  voertuigen: { html: voertuigenHtml, titel: () => t("Voertuigen en waar ze onder vallen") },
  weggebruikers: { html: weggebruikersHtml, titel: () => t("Voetganger of bestuurder") },
  rangorde: { html: rangordeHtml, titel: () => t("De rangorde: wie overstemt wie") },
  snelheden: { html: snelhedenHtml, titel: () => t("De standaardmaxima") },
  stilstaan: { html: stilstaanHtml, titel: () => t("Stilstaan of parkeren") },
  alcohol: { html: alcoholHtml, titel: () => t("De twee alcoholgrenzen") },
  duurzaamveilig: { html: duurzaamveiligHtml, titel: () => t("Drie soorten wegen") },
  lichten: { html: lichtenHtml, titel: () => t("Welk licht wanneer") },
  mistlichten: { html: mistlichtenHtml, titel: () => t("De twee mistlichten") },
  paman: { html: pamanHtml, titel: () => t("PAMAN, in volgorde") },
  strafbaar: { html: strafbaarHtml, titel: () => t("Overtreding of misdrijf") },
  weggedeelten: { html: weggedeeltenHtml, titel: () => t("Weg, rijbaan en rijstrook") },
  stroken: { html: strokenHtml, titel: () => t("De stroken op de snelweg") },
  examencijfers: { html: examencijfersHtml, titel: () => t("Het examen in cijfers") },
  tweeseconden: { html: tweesecondenHtml, titel: () => t("De twee secondenregel") },
  bakens: { html: bakensHtml, titel: () => t("De bakens voor een overweg") },
  lading: { html: ladingHtml, titel: () => t("De maten van je lading") },
  aanhanger: { html: aanhangerHtml, titel: () => t("Welke aanhanger met welk rijbewijs") },
  bordvormen: { html: bordvormenHtml, titel: () => t("De vorm van een bord") },
  belijning: { html: belijningHtml, titel: () => t("Wat de belijning zegt") },
  invoegen: { html: invoegenHtml, titel: () => t("Invoegen op de snelweg") },
  autotewater: { html: autotewaterHtml, titel: () => t("Auto te water") },
  rijstrookkeuze: { html: rijstrookkeuzeHtml, titel: () => t("Welke rijstrook kies je") },
  ruimtemaken: { html: ruimtemakenHtml, titel: () => t("Ruimte maken in de file") },
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
