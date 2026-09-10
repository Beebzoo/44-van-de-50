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
export const SUPPORTED = new Set(["ja_nee", "meerkeuze", "meervoudig", "hotspot"]);

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
  return { q, opties, grid: q.type === "hotspot" ? shuffle(q.media.borden) : null };
}

export function isCorrect(q, gekozen) {
  const c = new Set(q.correct);
  if (gekozen.length !== c.size) return false;
  return gekozen.every(g => c.has(g));
}

/* the default answer to "Wat ging er mis?": the distractor's own type,
   else a heuristic on the stem */
export function defaultFouttype(q, gekozen, history) {
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
  } else run.gekozen = [id];
}

export function check(run, history) {
  if (run.fase !== "kies" || !run.gekozen.length) return null;
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
  const total = run.resultaten.length;
  const goed = run.resultaten.filter(r => r.goed && !r.twijfel).length;
  return { score: goed, total, gehaald: total > 0 && goed === total, fouten: run.resultaten.filter(r => !r.goed || r.twijfel) };
}

export function toAttempt(run, contentVersion) {
  const s = score(run);
  return {
    kind: run.soort === "quiz" ? "quiz" : "herstel", ref: run.ref,
    score: s.score, total: s.total, duration_ms: Date.now() - run.start,
    content_version: contentVersion,
    answers: run.resultaten.map(r => ({ q: r.q, unit: r.unit, goed: r.goed, gekozen: r.gekozen, fouttype: r.fouttype, twijfel: r.twijfel, ms: r.ms })),
  };
}
