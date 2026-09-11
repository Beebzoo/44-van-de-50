/* De begrippenlijst: vaktermen in de lopende tekst aantikbaar maken.

   Waarom automatisch en niet met een markering in de inhoud: de uitleg staat al
   op leespagina's en in vraaguitleg, verspreid over 93 pagina's en 601 vragen.
   Die allemaal met de hand van haakjes voorzien zou een dag werk zijn en elke
   nieuwe vraag zou het opnieuw vragen. Herkennen doen we dus bij het tekenen.

   Drie regels houden het leesbaar:

   1. Alleen de eerste keer per stuk tekst. Het woord "bestuurder" tien keer
      onderstrepen op een pagina maakt van een leespagina een lappendeken.
   2. Hele woorden, en de langste vorm wint. Anders pakt "weg" de helft van
      "invoegstrook" en "snelweg" mee.
   3. Nooit binnen een stukje HTML. Er wordt op de al ontsnapte tekst gewerkt,
      en alles tussen < en > blijft met rust gelaten.

   Het herkennen gebeurt op een tekst waarin & al &amp; is geworden, dus de
   losse woorden zelf bevatten geen HTML meer. */

let LIJST = [];
let PATROON = null;
const opTerm = new Map();

export function laad(data) {
  LIJST = (data && data.begrippen) || [];
  opTerm.clear();
  const vormen = [];
  for (const b of LIJST) {
    for (const v of [b.term, ...(b.varianten || [])]) {
      const sleutel = v.toLowerCase();
      if (!opTerm.has(sleutel)) opTerm.set(sleutel, b);
      vormen.push(v);
    }
  }
  /* langste eerst, anders wint een kort woord van een samenstelling */
  vormen.sort((a, b) => b.length - a.length);
  PATROON = vormen.length
    ? new RegExp("(?<![a-zA-Z\\u00c0-\\u024f-])(" + vormen.map(ontsnap).join("|") + ")(?![a-zA-Z\\u00c0-\\u024f-])", "gi")
    : null;
  return LIJST.length;
}

const ontsnap = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const kent = term => opTerm.has(String(term || "").toLowerCase());
export const zoek = term => opTerm.get(String(term || "").toLowerCase()) || null;
export const alle = () => LIJST;

/* Wikkel de eerste keer dat een begrip voorkomt in een knop. gezien is een Set
   die je meegeeft als je meerdere blokken als een geheel wilt behandelen, zoals
   de blokken van een leespagina. */
export function markeer(html, gezien) {
  if (!PATROON || typeof html !== "string" || !html) return html;
  const al = gezien || new Set();
  /* splits op tags: de even stukken zijn tekst, de oneven zijn tags */
  return html.split(/(<[^>]*>)/).map((stuk, i) => {
    if (i % 2 === 1) return stuk;
    return stuk.replace(PATROON, (vol) => {
      const b = opTerm.get(vol.toLowerCase());
      if (!b || al.has(b.term)) return vol;
      al.add(b.term);
      return `<button type="button" class="begrip" data-actie="begrip" data-term="${b.term.replace(/"/g, "&quot;")}">${vol}</button>`;
    });
  }).join("");
}
