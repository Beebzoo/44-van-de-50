/* IndexedDB: the attempt log and the settings.

   Everything on screen is derived from `attempts`. Each row carries a
   client uuid and a synced flag so Phase 1 can push it to Supabase and
   merge rows from the other device without conflicts. Settings are the
   only snapshot-shaped data: last write wins, harmless to lose. */
const DB = "vvd50";
const VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("attempts")) {
        const s = db.createObjectStore("attempts", { keyPath: "id" });
        s.createIndex("ts", "ts");
        s.createIndex("synced", "synced");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
const tx = (db, store, mode, fn) => new Promise((resolve, reject) => {
  const t = db.transaction(store, mode);
  const s = t.objectStore(store);
  const out = fn(s);
  t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
  t.onerror = () => reject(t.error);
  t.onabort = () => reject(t.error);
});

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));

export const deviceName = () => {
  try {
    let d = localStorage.getItem("apparaat");
    if (!d) { d = (/Mobi|Android/i.test(navigator.userAgent) ? "telefoon" : "computer") + "-" + uuid().slice(0, 4); localStorage.setItem("apparaat", d); }
    return d;
  } catch (e) { return "onbekend"; }
};

export async function allAttempts() {
  const db = await open();
  const rows = await new Promise((resolve, reject) => {
    const req = db.transaction("attempts").objectStore("attempts").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return rows.sort((a, b) => a.ts - b.ts);
}

/* kind: quiz | herstel | lezen | zelftest | flag. ref: unit id or page id.
   answers: [{q, goed, gekozen, fouttype, twijfel, ms}] */
export async function addAttempt(a) {
  const db = await open();
  const row = { id: uuid(), ts: Date.now(), device: deviceName(), schema: 1, synced: false, ...a };
  await tx(db, "attempts", "readwrite", s => s.put(row));
  return row;
}

export async function getSetting(key, fallback) {
  const db = await open();
  const row = await new Promise((resolve, reject) => {
    const req = db.transaction("settings").objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return row ? row.value : fallback;
}
export async function setSetting(key, value) {
  const db = await open();
  await tx(db, "settings", "readwrite", s => s.put({ key, value, updated_at: Date.now() }));
}
export async function allSettings() {
  const db = await open();
  const rows = await new Promise((resolve, reject) => {
    const req = db.transaction("settings").objectStore("settings").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function wipe() {
  const db = await open();
  await tx(db, "attempts", "readwrite", s => s.clear());
  await tx(db, "settings", "readwrite", s => s.clear());
}

export async function persist() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* not granted, fine */ }
}
