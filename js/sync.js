/* Sync: the attempt log mirrored to Supabase, no login.

   Identity is a koppelcode, 26 characters of base32 generated on the
   first device and typed once on the second. Every request carries it
   as the x-learner header; a row-level policy on the server returns and
   accepts only rows with that learner. No header, no rows.

   Local IndexedDB stays the source of truth. A flush runs on start, when
   the browser comes online and after every attempt: outbox rows are
   posted with ignore-duplicates, then rows newer than the last pull are
   fetched and merged. Nothing on screen waits for the server. Settings
   are one row per learner, last write wins. */
import * as store from "./store.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   /* no I, O, 0, 1 */
const COLUMNS = ["id", "learner", "ts", "kind", "ref", "score", "total", "duration_ms", "device", "content_version", "schema", "answers"];
let busy = false;
let status = { laatst: null, fout: null, bezig: false };

export const configured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const state = () => status;

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bits = 0, value = 0, out = "";
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.slice(0, 26);
}
export const normaliseCode = c => String(c || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
export const validCode = c => /^[A-HJ-NP-Z2-9]{26}$/.test(c);
export const formatCode = c => (c || "").replace(/(.{5})/g, "$1 ").trim();

export async function learnerCode() {
  let code = await store.getSetting("koppelcode", null);
  if (!code) {
    try { code = localStorage.getItem("koppelcode"); } catch (e) { /* private mode */ }
    if (!validCode(code || "")) code = newCode();
    await store.setSetting("koppelcode", code);
  }
  try { localStorage.setItem("koppelcode", code); } catch (e) { /* private mode */ }
  return code;
}
export async function setLearnerCode(code) {
  const c = normaliseCode(code);
  if (!validCode(c)) throw new Error("Een koppelcode heeft 26 tekens, letters en cijfers.");
  await store.setSetting("koppelcode", c);
  await store.setSetting("laatstePull", 0);
  try { localStorage.setItem("koppelcode", c); } catch (e) { /* private mode */ }
  return c;
}

async function api(path, { method = "GET", body, prefer, learner } = {}) {
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "x-learner": learner,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error("Supabase " + res.status + " bij " + path);
  return res.status === 204 || method === "POST" && prefer && prefer.includes("return=minimal") ? null : res.json();
}

/* a local row to the server shape: known columns plus the rest in extra */
function toServer(row, learner) {
  const out = { learner };
  const extra = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "synced") continue;
    if (COLUMNS.includes(k)) out[k] = v; else extra[k] = v;
  }
  if (Object.keys(extra).length) out.extra = extra;
  return out;
}
function fromServer(row) {
  const { learner, extra, ...rest } = row;
  return { ...rest, ...(extra || {}), synced: true };
}

/* push the outbox, pull what is new, merge settings; returns the number of rows merged from the server */
export async function flush() {
  if (!configured() || busy || !navigator.onLine) return 0;
  busy = true; status.bezig = true; status.fout = null;
  let merged = 0;
  try {
    const learner = await learnerCode();
    const outbox = await store.unsyncedAttempts();
    for (let i = 0; i < outbox.length; i += 100) {
      const slice = outbox.slice(i, i + 100);
      await api("attempts", { method: "POST", body: slice.map(r => toServer(r, learner)), prefer: "resolution=ignore-duplicates,return=minimal", learner });
      await store.markSynced(slice.map(r => r.id));
    }
    const since = await store.getSetting("laatstePull", 0);
    const rows = await api("attempts?select=*&ts=gt." + since + "&order=ts.asc&limit=2000", { learner });
    let maxTs = since;
    for (const row of rows || []) {
      if (row.ts > maxTs) maxTs = row.ts;
      if (await store.hasAttempt(row.id)) continue;
      await store.putAttempt(fromServer(row));
      merged += 1;
    }
    await store.setSetting("laatstePull", maxTs);

    /* settings: last write wins on updated_at */
    const local = await store.allSettings();
    const mine = { examenDatum: local.examenDatum, thema: local.thema, tekst: local.tekst };
    const localAt = local.instellingenAt || 0;
    const remote = await api("settings?select=*&learner=eq." + encodeURIComponent(learner), { learner });
    const r = remote && remote[0];
    if (r && r.updated_at > localAt) {
      for (const [k, v] of Object.entries(r.data || {})) if (v !== undefined && v !== null) await store.setSetting(k, v);
      await store.setSetting("instellingenAt", r.updated_at);
      merged += 1;
    } else if (!r || localAt > r.updated_at) {
      await api("settings", { method: "POST", body: [{ learner, data: mine, updated_at: localAt || Date.now() }], prefer: "resolution=merge-duplicates,return=minimal", learner });
    }
    status.laatst = Date.now();
    await store.setSetting("laatsteSync", status.laatst);
  } catch (e) {
    status.fout = e.message;
  } finally {
    busy = false; status.bezig = false;
  }
  return merged;
}
