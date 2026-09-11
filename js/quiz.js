/* The quiz engine: sampling, one run, scoring.

   Select, then Controleer, then reveal. Never an instant reveal. A run is
   scored when the last question is answered and written to the attempt
   log as one row; everything the app shows afterwards is derived from
   those rows.

   Sampling is stratified by reading page, weighted to the least seen and
   to anything missed before, and shares at most four questions with the
   previous perfect run so the confirmation quiz cannot be memorised.
   Questions flagged reserve never appear here; they are held back for
   the exam simulations. */
export const SUPPORTED = new Set(["ja_nee", "meerkeuze", "meervoudig", "hotspot", "volgorde", "reeks", "invul"]);

/* An invul answer is one typed number. Dutch writes a decimal comma, and a
   learner types what he sees on a sign, so "1,6" and "1.6" both count. */
export const getalUit = tekst => {
  const t = String(tekst == null ? "" : tekst).replace(",", ".").replace(/[^0-9.-]/g, "");
  if (!t || !/[0-9]/.test(t)) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const weightOf = (q, history) => {
  const h = history.get(q.id);
  if (!h) return 1;
  let w = 1 / (1 + h.gezien);
  if (h.laatsteGoed === false) w *= 3; else if (h.fout > 0) w *= 2;
  return w;
};
/* weighted sampling without replacement: smallest key first */
const ranked = (qs, history) => qs.map(q => ({ q, key: -Math.log(Math.random()) / weightOf(q, history) })).sort((a, b) => a.key - b.key).map(x => x.q);

export function sample({ pool, history, lengte, avoid = [] }) {
  const cands = pool.filter(q => !q.reserve && SUPPORTED.has(q.type));
  const avoidSet = new Set(avoid);
  const chosen = [];
  const taken = new Set();
  let overlap = 0;
  const canTake = q => !taken.has(q.id) && (!avoidSet.has(q.id) || overlap < 4);
  const take = q => { chosen.push(q); taken.add(q.id); if (avoidSet.has(q.id)) overlap++; };

  /* one from every reading page first */
  const byPage = {};
  for (const q of cands) (byPage[q.pagina] = byPage[q.pagina] || []).push(q);
  for (const page of shuffle(Object.keys(byPage))) {
    if (chosen.length >= lengte) break;
    const pick = ranked(byPage[page], history).find(canTake);
    if (pick) take(pick);
  }
  /* then fill by weight */
  for (const q of ranked(cands, history)) {
    if (chosen.length >= lengte) break;
    if (canTake(q)) take(q);
  }
  /* pool too small to avoid the previous run: allow the overlap */
  if (chosen.length < lengte) for (const q of ranked(cands, history)) {
    if (chosen.length >= lengte) break;
    if (!taken.has(q.id)) { chosen.push(q); taken.add(q.id); }
  }
  return shuffle(chosen);
}

/* the sibling for a herstelronde: same page, not in the run, least seen */
export function sibling(q, pool, exclude, history) {
  const ex = new Set(exclude);
  const cands = pool.filter(x => x.pagina === q.pagina && x.id !== q.id && !ex.has(x.id) && !x.reserve && SUPPORTED.has(x.type));
  return ranked(cands, history)[0] || null;
}

export function prepare(q) {
  const opties = q.type === "ja_nee" ? q.opties.slice() : shuffle(q.opties);
  return { q, opties, grid: q.type === "hotspot" ? shuffle(q.media.borden) : null, frame: 0 };
}

export function isCorrect(q, gekozen) {
  if (q.type === "invul") {
    const n = getalUit(gekozen[0]);
    if (n === null) return false;
    return Math.abs(n - q.correct.getal) <= (q.correct.tolerantie || 0);
  }
  if (q.type === "volgorde") return gekozen.length === q.correct.length && gekozen.every((g, i) => g === q.correct[i]);
  const c = new Set(q.correct);
  if (gekozen.length !== c.size) return false;
  return gekozen.every(g => c.has(g));
}

/* can the run be checked with what is chosen so far */
export function ready(run) {
  const q = current(run).q;
  if (q.type === "invul") return getalUit(run.gekozen[0]) !== null;
  if (q.type === "volgorde") return run.gekozen.length === q.correct.length;
  return run.gekozen.length > 0;
}

/* the default answer to "Wat ging er mis?": the distractor's own type,
   else a heuristic on the stem */
export function defaultFouttype(q, gekozen, history) {
  if (q.type === "invul") return history.get(q.id) ? "verkeerd_toegepast" : "niet_geweten";
  if (q.type === "volgorde") return history.get(q.id) ? "verkeerd_toegepast" : "niet_geweten";
  const wrong = q.opties.find(o => gekozen.includes(o.id) && !q.correct.includes(o.id));
  if (wrong && wrong.fouttype) return wrong.fouttype;
  if (/\b(niet|geen|mag|moet)\b/i.test(q.stam)) return "verkeerd_gelezen";
  if (!history.get(q.id)) return "niet_geweten";
  return "verkeerd_toegepast";
}

export function newRun({ unit, soort, questions, ref }) {
  return {
    unit, soort, ref: ref || unit,
    items: questions.map(prepare),
    i: 0, gekozen: [], fase: "kies", twijfel: false, fouttype: null,
    resultaten: [], start: Date.now(), vraagStart: Date.now(), klaar: false,
  };
}

export function current(run) { return run.items[run.i]; }

export function choose(run, id) {
  const q = current(run).q;
  if (run.fase !== "kies") return;
  if (q.type === "meervoudig") {
    run.gekozen = run.gekozen.includes(id) ? run.gekozen.filter(x => x !== id) : run.gekozen.concat(id);
  } else if (q.type === "volgorde") {
    /* tap to stamp the next number; tap a stamped item to remove its stamp and renumber */
    run.gekozen = run.gekozen.includes(id) ? run.gekozen.filter(x => x !== id) : run.gekozen.concat(id);
  } else run.gekozen = [id];
}

export function check(run, history) {
  if (run.fase !== "kies" || !ready(run)) return null;
  const q = current(run).q;
  const goed = isCorrect(q, run.gekozen);
  run.fase = "toon";
  run.fouttype = goed ? (run.twijfel ? "gegokt" : null) : defaultFouttype(q, run.gekozen, history);
  run.resultaten.push({ q: q.id, unit: q.unit, pagina: q.pagina, goed, gekozen: run.gekozen.slice(), twijfel: run.twijfel, fouttype: run.fouttype, ms: Date.now() - run.vraagStart });
  return goed;
}

export function setFouttype(run, t) {
  run.fouttype = t;
  const r = run.resultaten[run.resultaten.length - 1];
  if (r) r.fouttype = t;
}

export function next(run) {
  if (run.fase !== "toon") return false;
  run.i += 1; run.gekozen = []; run.fase = "kies"; run.twijfel = false; run.fouttype = null; run.vraagStart = Date.now();
  if (run.i >= run.items.length) { run.klaar = true; run.i = run.items.length - 1; }
  return run.klaar;
}

export function score(run) {
  if (run.examen) { const u = examenUitslag(run); return { score: u.score, total: u.totaal, gehaald: u.gehaald, fouten: u.fouten }; }
  const total = run.resultaten.length;
  const goed = run.resultaten.filter(r => r.goed && !r.twijfel).length;
  return { score: goed, total, gehaald: total > 0 && goed === total, fouten: run.resultaten.filter(r => !r.goed || r.twijfel) };
}

export function toAttempt(run, contentVersion) {
  const s = score(run);
  return {
    kind: run.soort === "examen" ? "examen" : run.soort === "quiz" ? "quiz" : run.soort === "herhaling" ? "herhaling" : "herstel", ref: run.ref,
    score: s.score, total: s.total, duration_ms: Date.now() - run.start,
    content_version: contentVersion,
    answers: run.resultaten.map(r => ({ q: r.q, unit: r.unit, goed: r.goed, gekozen: r.gekozen, fouttype: r.fouttype, twijfel: r.twijfel, ms: r.ms, ...(r.onderwerp ? { onderwerp: r.onderwerp, telt: r.telt } : {}) })),
  };
}

/* ==== the exam simulation ====

   The real thing: 50 questions that count, 2 test questions that do not, 30
   minutes, 44 right to pass. Those five numbers are F001 to F004 and F006 in
   the fact registry, so they are not invented here.

   What is invented, and worth knowing: the CBR does not publish how many
   questions it draws per topic, and neither transcription says. So the
   simulation weighs the topics by how many hand-written questions the bank has
   per topic, because that follows how much room the book gives each subject.
   It deliberately does not weigh by the whole bank: the generated sign items
   are half of everything and all one topic, so a simulation drawn that way is
   a sign quiz with some traffic rules mixed in. The questions themselves are
   then drawn from everything, generated ones included.

   An exam run never reveals an answer between questions. You answer, you may
   flag a question, you may walk back and change it, and you see everything at
   the end. Anything else would train you on a screen the exam does not have. */
export const EXAMEN = { getoond: 52, telt: 50, halen: 44, minuten: 30 };

export function sampleExamen(pool, history) {
  const bruikbaar = pool.filter(q => SUPPORTED.has(q.type));
  if (bruikbaar.length <= EXAMEN.getoond) return shuffle(bruikbaar);

  const perOnderwerp = {};
  for (const q of bruikbaar) (perOnderwerp[q.cbr_onderwerp] = perOnderwerp[q.cbr_onderwerp] || []).push(q);
  const onderwerpen = Object.keys(perOnderwerp);

  /* the weight of a topic is how many hand-written questions it has */
  const gewicht = {};
  for (const o of onderwerpen) gewicht[o] = perOnderwerp[o].filter(q => !q.gegenereerd).length || perOnderwerp[o].length;
  const somGewicht = onderwerpen.reduce((a, o) => a + gewicht[o], 0);

  /* every topic gets two, the rest follows the weight */
  const quota = {};
  let over = EXAMEN.getoond;
  for (const o of onderwerpen) { quota[o] = Math.min(2, perOnderwerp[o].length); over -= quota[o]; }
  for (const o of onderwerpen) {
    const extra = Math.min(perOnderwerp[o].length - quota[o], Math.round(over * gewicht[o] / somGewicht));
    quota[o] += extra;
  }
  /* rounding leaves a few over or short, so top up or trim where there is room */
  let gekozen = [];
  for (const o of shuffle(onderwerpen)) gekozen = gekozen.concat(ranked(perOnderwerp[o], history).slice(0, quota[o]));
  if (gekozen.length > EXAMEN.getoond) gekozen = shuffle(gekozen).slice(0, EXAMEN.getoond);
  if (gekozen.length < EXAMEN.getoond) {
    const genomen = new Set(gekozen.map(q => q.id));
    for (const q of ranked(bruikbaar, history)) {
      if (gekozen.length >= EXAMEN.getoond) break;
      if (!genomen.has(q.id)) { gekozen.push(q); genomen.add(q.id); }
    }
  }
  return shuffle(gekozen);
}

export function newExamen(questions) {
  const run = newRun({ unit: null, soort: "examen", questions, ref: "examen" });
  run.examen = true;
  run.gemarkeerd = [];
  run.antwoorden = {};                 /* vraag-id naar wat je koos, want je mag terug */
  run.eindigt = Date.now() + EXAMEN.minuten * 60000;
  /* the two that do not count, drawn now so the result cannot be argued with */
  run.proef = questions.slice(0, Math.max(0, questions.length - EXAMEN.telt)).map(q => q.id);
  return run;
}

export const seconden = run => Math.max(0, Math.round((run.eindigt - Date.now()) / 1000));
export const tijdOp = run => Date.now() >= run.eindigt;

export function markeer(run) {
  const id = current(run).q.id;
  run.gemarkeerd = run.gemarkeerd.includes(id) ? run.gemarkeerd.filter(x => x !== id) : run.gemarkeerd.concat(id);
}

/* In an exam the answer is parked, not checked: you find out at the end. */
export function park(run) {
  const id = current(run).q.id;
  if (run.gekozen.length) run.antwoorden[id] = run.gekozen.slice();
  else delete run.antwoorden[id];
}

export function ga(run, i) {
  park(run);
  run.i = Math.max(0, Math.min(run.items.length - 1, i));
  run.gekozen = (run.antwoorden[current(run).q.id] || []).slice();
  run.vraagStart = Date.now();
}

/* Scoring happens once, at the end or when the clock runs out. */
export function sluitExamen(run, history) {
  park(run);
  run.resultaten = run.items.map(item => {
    const q = item.q;
    const gekozen = run.antwoorden[q.id] || [];
    const goed = gekozen.length ? isCorrect(q, gekozen) : false;
    return {
      q: q.id, unit: q.unit, pagina: q.pagina, onderwerp: q.cbr_onderwerp,
      goed, gekozen, twijfel: false, telt: !run.proef.includes(q.id),
      fouttype: goed ? null : defaultFouttype(q, gekozen, history), ms: 0,
    };
  });
  run.klaar = true;
  return examenUitslag(run);
}

export function examenUitslag(run) {
  const tellen = run.resultaten.filter(r => r.telt);
  const goed = tellen.filter(r => r.goed).length;
  const perOnderwerp = {};
  for (const r of tellen) {
    const o = perOnderwerp[r.onderwerp] = perOnderwerp[r.onderwerp] || { goed: 0, totaal: 0 };
    o.totaal += 1; if (r.goed) o.goed += 1;
  }
  const onbeantwoord = run.resultaten.filter(r => !r.gekozen.length).length;
  return {
    score: goed, totaal: tellen.length, halen: EXAMEN.halen, gehaald: goed >= EXAMEN.halen,
    perOnderwerp, onbeantwoord, fouten: run.resultaten.filter(r => !r.goed),
  };
}

/* ==== is he ready ====

   Three simulations of 44 or higher in the last ten days, no topic under 70
   percent over those simulations, and the daily revision not in arrears. Three
   lamps, and only all three together mean green. */
export const EXAMENKLAAR = { simulaties: 3, drempel: EXAMEN.halen, dagen: 10, onderwerp: 0.7, retentie: 0.8 };

export function examenklaar(attempts, retentie) {
  const grens = Date.now() - EXAMENKLAAR.dagen * 86400000;
  const sims = attempts
    .filter(a => a.kind === "examen" && new Date(a.created_at || a.ts || 0).getTime() >= grens)
    .sort((a, b) => new Date(b.created_at || b.ts || 0) - new Date(a.created_at || a.ts || 0));
  const geslaagd = sims.filter(a => a.score >= EXAMENKLAAR.drempel);

  const perOnderwerp = {};
  for (const a of sims) for (const r of a.answers || []) {
    if (!r.onderwerp || r.telt === false) continue;
    const o = perOnderwerp[r.onderwerp] = perOnderwerp[r.onderwerp] || { goed: 0, totaal: 0 };
    o.totaal += 1; if (r.goed) o.goed += 1;
  }
  const zwak = Object.entries(perOnderwerp)
    .filter(([, o]) => o.totaal >= 4 && o.goed / o.totaal < EXAMENKLAAR.onderwerp)
    .map(([k]) => k);

  const lampen = [
    { id: "simulaties", ok: geslaagd.length >= EXAMENKLAAR.simulaties, tekst: geslaagd.length + " van de " + EXAMENKLAAR.simulaties + " simulaties gehaald, in de laatste " + EXAMENKLAAR.dagen + " dagen" },
    { id: "onderwerpen", ok: sims.length > 0 && zwak.length === 0, tekst: sims.length === 0 ? "nog geen simulatie gedaan" : zwak.length ? zwak.length + " onderwerp" + (zwak.length > 1 ? "en" : "") + " onder de 70 procent" : "elk onderwerp boven de 70 procent" },
    { id: "retentie", ok: retentie >= EXAMENKLAAR.retentie, tekst: Math.round(retentie * 100) + " procent van de herhaling op tijd" },
  ];
  return { lampen, klaar: lampen.every(l => l.ok), sims: sims.length, zwak };
}
