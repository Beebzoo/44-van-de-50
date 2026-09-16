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

/* Vragen over de begrippen, afgeleid bij de start.

   Twee per begrip: van het woord naar de betekenis en terug. Ze horen bij geen
   enkel blok, dus ze tellen niet mee voor gehaald en ze komen niet in de
   dozen van de herhaling. Het zijn ids met een vast patroon, zodat je fouten
   erop blijven staan over een herstart heen.

   De afleiders zijn uitleggen van andere begrippen. Een afleider die toevallig
   hetzelfde zegt zou een vraag met twee goede antwoorden opleveren, dus ze
   worden op tekst ontdubbeld. */
const kort = s => (s.length > 110 ? s.slice(0, 107).replace(/[,;: ]+\S*$/, "") + "..." : s);
const hoofd = s => s.charAt(0).toUpperCase() + s.slice(1);

export function vragen() {
  const uit = [];
  const bruikbaar = LIJST.filter(b => b.uitleg && b.uitleg.length > 12);
  for (let i = 0; i < bruikbaar.length; i += 1) {
    const b = bruikbaar[i];
    const anderen = [];
    const gezien = new Set([b.uitleg]);
    for (let k = 1; anderen.length < 3 && k < bruikbaar.length; k += 1) {
      const c = bruikbaar[(i + k * 7) % bruikbaar.length];
      if (c.term === b.term || gezien.has(c.uitleg)) continue;
      gezien.add(c.uitleg);
      anderen.push(c);
    }
    if (anderen.length < 3) continue;
    const bron = [b.bron && b.bron.boek ? { boek: b.bron.boek, sectie: b.bron.sectie } : { slide: b.bron && b.bron.slide }];

    /* van het woord naar de betekenis */
    /* het antwoord staat al in de optie, dus de terugkoppeling herhaalt hem niet */
    const opties = [{ id: "goed", tekst: kort(b.uitleg), feedback: "Goed. Dat is wat " + b.term + " betekent." }]
      .concat(anderen.map((c, n) => ({ id: "f" + n, tekst: kort(c.uitleg), feedback: "Fout. Dat is de uitleg van " + c.term + ".", fouttype: "niet_geweten" })));
    uit.push({
      id: "BG-" + b.term.replace(/[^a-z]+/g, "") + "-1",
      unit: "begrippen", soort: "begrip", type: "meerkeuze",
      stam: "Wat betekent " + b.term + "?",
      media: b.borden && b.borden.length ? { bord: b.borden[0] } : b.bord ? { bord: b.bord } : undefined,
      opties, correct: ["goed"],
      uitleg: { regel: hoofd(b.term) + ": " + b.uitleg },
      bronnen: bron, cbr_onderwerp: "verkeerstekens_en_aanwijzingen", term: b.term,
      moeilijkheid: 1, gegenereerd: true, versie: 1, status: "gecheckt",
    });

    /* en terug */
    const opties2 = [{ id: "goed", tekst: hoofd(b.term), feedback: "Goed. " + hoofd(b.uitleg) }]
      .concat(anderen.map((c, n) => ({ id: "f" + n, tekst: hoofd(c.term), feedback: "Fout. " + hoofd(c.term) + " betekent: " + c.uitleg, fouttype: "niet_geweten" })));
    uit.push({
      id: "BG-" + b.term.replace(/[^a-z]+/g, "") + "-2",
      unit: "begrippen", soort: "begrip", type: "meerkeuze",
      stam: "Welk woord hoort hierbij: " + kort(b.uitleg),
      opties: opties2, correct: ["goed"],
      uitleg: { regel: hoofd(b.term) + ": " + b.uitleg },
      bronnen: bron, cbr_onderwerp: "verkeerstekens_en_aanwijzingen", term: b.term,
      moeilijkheid: 1, gegenereerd: true, versie: 1, status: "gecheckt",
    });
  }
  return uit;
}

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
