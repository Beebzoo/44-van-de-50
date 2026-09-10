/* Leitner: five boxes, intervals 1, 3, 7, 14, 30 days, computed from the
   attempt log every time. Nothing is stored, so a change here changes
   nothing on disk.

   A question enters box 1 the moment its unit is beheerst. Correct at
   review: one box up, due after that box's interval. Wrong: back to box
   1. The daily set is every due question (overdue first, lowest box
   first), capped at 20, topped up with the most-missed questions when
   fewer than 8 are due, plus three sign items when a sign unit is
   beheerst. */
const DAG = 24 * 60 * 60 * 1000;
export const INTERVAL = [0, 1, 3, 7, 14, 30];   /* days per box, index is the box */

/* box and due date per question id, for questions whose unit is beheerst */
export function boxes(attempts, qById, states, unitOf) {
  const out = new Map();
  const beheerst = new Set(Object.entries(states).filter(([, st]) => st.staat === "beheerst").map(([id]) => id));
  const ordered = attempts.slice().sort((a, b) => a.ts - b.ts);
  for (const a of ordered) for (const x of a.answers || []) {
    const q = qById[x.q];
    if (!q || !beheerst.has(q.unit)) continue;
    const cur = out.get(x.q) || { box: 1, due: a.ts + DAG, laatste: a.ts, fout: 0 };
    if (x.goed && !x.twijfel) { cur.box = Math.min(5, cur.box + (a.kind === "herhaling" ? 1 : 0)); }
    else { cur.box = 1; cur.fout += 1; }
    cur.laatste = a.ts;
    cur.due = a.ts + INTERVAL[cur.box] * DAG;
    out.set(x.q, cur);
  }
  /* questions in a beheerst unit never seen in a review yet: box 1, due tomorrow at the latest */
  for (const q of Object.values(qById)) if (beheerst.has(q.unit) && !q.reserve && !out.has(q.id)) out.set(q.id, { box: 1, due: Date.now(), laatste: 0, fout: 0 });
  return out;
}

export function dailySet(bx, qById, now = Date.now()) {
  const due = [...bx.entries()].filter(([, b]) => b.due <= now).sort((a, b) => (a[1].due - b[1].due) || (a[1].box - b[1].box)).map(([id]) => id);
  let set = due.slice(0, 20);
  if (set.length < 8) {
    const extra = [...bx.entries()].filter(([id]) => !set.includes(id)).sort((a, b) => b[1].fout - a[1].fout || a[1].box - b[1].box).map(([id]) => id);
    set = set.concat(extra.slice(0, 8 - set.length));
  }
  const signs = [...bx.keys()].filter(id => qById[id] && qById[id].gegenereerd && !set.includes(id)).sort(() => Math.random() - 0.5).slice(0, 3);
  return { vragen: set.concat(signs), aantalDue: due.length };
}

/* retention health of a unit: share of its questions in box 3 or higher */
export function health(bx, qById, unitId) {
  const mine = [...bx.entries()].filter(([id]) => qById[id] && qById[id].unit === unitId);
  if (!mine.length) return null;
  return mine.filter(([, b]) => b.box >= 3).length / mine.length;
}
