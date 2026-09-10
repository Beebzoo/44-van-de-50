/* Everything derived from the attempt log: per-question history, unit
   states, the lane, the error log, time on task. Nothing here is stored;
   a bug fix in a rule changes nothing on disk.

   Unit states, from BOUWPLAN section 2:
     vergrendeld   the prerequisite is not far enough
     lezen         reading open, quiz not yet (prerequisite voorlopig beheerst)
     oefenen       quiz open, no perfect run yet
     voorlopig     one perfect run
     beheerst      two perfect runs, the second 12 hours or more after the
                   first and sharing at most 4 questions, plus every
                   non-reserve question answered correctly at least once */
const TWAALF_UUR = 12 * 60 * 60 * 1000;

export function questionHistory(attempts) {
  const h = new Map();
  for (const a of attempts) {
    if (!a.answers) continue;
    for (const ans of a.answers) {
      const q = h.get(ans.q) || { gezien: 0, goed: 0, fout: 0, laatste: null, laatsteGoed: null, fouttypes: [] };
      q.gezien++;
      const ok = ans.goed && !ans.twijfel;
      if (ok) q.goed++; else { q.fout++; if (ans.fouttype) q.fouttypes.push(ans.fouttype); }
      q.laatste = a.ts; q.laatsteGoed = ok;
      h.set(ans.q, q);
    }
  }
  return h;
}

function perfectRuns(attempts, unitId) {
  return attempts.filter(a => a.kind === "quiz" && a.ref === unitId && a.total > 0 && a.score === a.total && !(a.answers || []).some(x => x.twijfel));
}
function overlap(a, b) {
  const A = new Set((a.answers || []).map(x => x.q));
  return (b.answers || []).filter(x => A.has(x.q)).length;
}

/* mastery for one unit given its pool of question ids (non-reserve) */
export function unitMastery(attempts, unit, poolIds, history) {
  if (!unit.quiz.gate) {
    const read = attempts.some(a => a.kind === "lezen" && a.ref === unit.id && a.klaar);
    return { staat: read ? "beheerst" : "oefenen", runs: 0, alleGoed: read, ontbreekt: [] };
  }
  const runs = perfectRuns(attempts, unit.id);
  const ontbreekt = poolIds.filter(id => !(history.get(id) && history.get(id).goed > 0));
  const alleGoed = ontbreekt.length === 0 && poolIds.length > 0;
  let confirmed = false;
  for (let i = 0; i < runs.length && !confirmed; i++) for (let j = i + 1; j < runs.length && !confirmed; j++) {
    if (runs[j].ts - runs[i].ts >= TWAALF_UUR && overlap(runs[i], runs[j]) <= 4) confirmed = true;
  }
  if (confirmed && alleGoed) return { staat: "beheerst", runs: runs.length, alleGoed, ontbreekt };
  if (runs.length >= 1) return { staat: "voorlopig", runs: runs.length, alleGoed, ontbreekt, bevestigd: confirmed };
  return { staat: "oefenen", runs: 0, alleGoed, ontbreekt };
}

/* the whole map: unit id -> {staat, ...}. Units in order; a unit is
   locked while any prerequisite is below voorlopig, its quiz locked while
   any prerequisite is below beheerst. */
export function unitStates(attempts, units, pools, history) {
  const own = {};
  for (const u of units) own[u.id] = unitMastery(attempts, u, pools[u.id] || [], history);
  const out = {};
  for (const u of units) {
    const m = own[u.id];
    const prereqs = u.vereist.map(id => own[id] ? own[id].staat : "beheerst");
    const rank = s => ["vergrendeld", "lezen", "oefenen", "voorlopig", "beheerst"].indexOf(s);
    const minPre = prereqs.length ? Math.min(...prereqs.map(rank)) : 4;
    let staat;
    if (minPre < rank("voorlopig")) staat = "vergrendeld";
    else if (m.staat === "beheerst" || m.staat === "voorlopig") staat = m.staat;
    else if (minPre < rank("beheerst")) staat = "lezen";
    else staat = "oefenen";
    const quizAttempts = attempts.filter(a => a.kind === "quiz" && a.ref === u.id);
    const laatste = quizAttempts.length ? quizAttempts[quizAttempts.length - 1] : null;
    out[u.id] = { ...m, staat, quizOpen: staat === "oefenen" || staat === "voorlopig" || staat === "beheerst", pogingen: quizAttempts.length, laatste };
  }
  return out;
}

export const staatLabel = s => ({ vergrendeld: "Vergrendeld", lezen: "Lezen", oefenen: "Oefenen", voorlopig: "Voorlopig gehaald", beheerst: "Gehaald" }[s] || s);

/* the error log: questions with a wrong last answer or two or more misses,
   grouped by unit, newest first */
export function foutenlog(attempts, history, qById) {
  const rows = [];
  for (const [id, h] of history) {
    if (!qById[id]) continue;
    if (h.laatsteGoed === false || h.fout >= 2) rows.push({ id, unit: qById[id].unit, fout: h.fout, laatste: h.laatste, stam: qById[id].stam, pagina: qById[id].pagina });
  }
  rows.sort((a, b) => b.laatste - a.laatste);
  /* an item leaves the list after two consecutive correct answers */
  return rows.filter(r => !laatsteTweeGoed(attempts, r.id));
}
function laatsteTweeGoed(attempts, qid) {
  const seq = [];
  for (const a of attempts) for (const x of a.answers || []) if (x.q === qid) seq.push(x.goed && !x.twijfel);
  return seq.length >= 2 && seq[seq.length - 1] && seq[seq.length - 2];
}

export function vandaag(attempts) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = attempts.filter(a => a.ts >= start.getTime());
  const vragen = today.reduce((n, a) => n + (a.answers ? a.answers.length : 0), 0);
  const ms = today.reduce((n, a) => n + (a.duration_ms || 0), 0);
  return { vragen, minuten: Math.round(ms / 60000), pogingen: today.length };
}

export function unitStats(attempts, unitId) {
  const mine = attempts.filter(a => a.ref === unitId || (a.answers || []).some(x => x.unit === unitId));
  const vragen = mine.reduce((n, a) => n + (a.answers ? a.answers.filter(x => !x.unit || x.unit === unitId).length : 0), 0);
  const ms = mine.reduce((n, a) => n + (a.duration_ms || 0), 0);
  const pogingen = mine.filter(a => a.kind === "quiz").length;
  return { vragen, minuten: Math.round(ms / 60000), pogingen };
}

export function streak(attempts) {
  const days = new Set(attempts.filter(a => a.kind === "quiz" || a.kind === "herstel" || a.kind === "lezen").map(a => new Date(a.ts).toDateString()));
  let n = 0;
  const d = new Date();
  for (;;) {
    if (days.has(d.toDateString())) n++;
    else if (n > 0 || d.toDateString() !== new Date().toDateString()) break;
    d.setDate(d.getDate() - 1);
    if (n > 400) break;
  }
  return n;
}
