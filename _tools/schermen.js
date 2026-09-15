/* Screenshots of the app for review, driven over the DevTools protocol.

     node _tools/schermen.js <baseUrl> <outdir> [donker] [breed]

   Starts a headless Chrome, opens every route in ROUTES at phone size,
   waits until the screen has rendered, runs the route's optional script
   (to answer a question, say) and saves a PNG. Console errors and uncaught
   exceptions are printed, which is the point: the plain --screenshot flag
   captures the page at the load event, before the app has fetched
   anything. Needs google-chrome or chromium on the PATH. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const [base, outDir, ...flags] = process.argv.slice(2);
if (!base || !outDir) { console.error("gebruik: node _tools/schermen.js http://127.0.0.1:8765/ schermen [donker]"); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
/* een eigen poort per run, anders vecht een tweede run om dezelfde browser */
const PORT = 9300 + Math.floor(Math.random() * 400);
const DARK = flags.includes("donker");
const LIGHT = flags.includes("licht");
const WIDE = flags.includes("breed");
/* enkel: screenshot the base url as one page once a .scene or main.inhoud exists */
const SINGLE = flags.includes("enkel");
/* klik=<selector>: tik bij een enkele opname eerst iets aan, bijvoorbeeld een
   begrip in een leestekst, zodat je de kaart erachter kunt zien */
const KLIK = (flags.find(f => f.startsWith("klik=")) || "").slice(5);
/* vrij: seed one perfect run per unit first, so the quiz and exam screens
   are the real thing instead of "nog geen quiz". Nothing is written to the
   repo; it lives in the throwaway profile this script starts Chrome with. */
const VRIJ = flags.includes("vrij");
/* engels: zet de taalinstelling voordat de schermen langskomen */
const ENGELS = flags.includes("engels");
/* fouten: zaai een handvol foute antwoorden met een oorzaak, anders is het
   foutenscherm leeg en valt er niets te zien */
const FOUTEN = flags.includes("fouten");
/* beheerst: maak de eerste blokken echt af, met twee foutloze rondes op
   twaalf uur afstand en elke vraag uit de pool een keer goed. Pas dan vullen
   de bakken van de herhaling zich en kleuren de blokjes op Route blauw. */
const BEHEERST = flags.includes("beheerst");
const BEHEERSTZAAI = "(async () => { const store = await import('./js/store.js');" +
  " const idx = await (await fetch('content/index.json')).json();" +
  " const dag = 86400000; let n = 0;" +
  " for (const u of idx.units.slice(0, 5)) {" +
  "   if (!u.aantalVragen) continue;" +
  "   const vragen = [];" +
  "   for (const f of u.bank) { const b = await (await fetch(f)).json(); vragen.push(...(b.vragen || []).filter(q => !q.reserve)); }" +
  "   if (!vragen.length) continue;" +
  "   const alles = vragen.map(q => ({ q: q.id, unit: u.id, pagina: q.pagina, goed: true, twijfel: false, gekozen: [], ms: 18000, onderwerp: q.cbr_onderwerp }));" +
  "   const nu = Date.now();" +
  "   await store.addAttempt({ kind: 'quiz', ref: u.id, unit: u.id, ts: nu - 3 * dag, duration_ms: 600000, total: alles.length, score: alles.length, answers: alles, synced: true });" +
  "   const helft = Math.max(1, Math.floor(alles.length / 2));" +
  "   await store.addAttempt({ kind: 'quiz', ref: u.id, unit: u.id, ts: nu - 2 * dag, duration_ms: 300000, total: helft, score: helft, answers: alles.slice(0, helft), synced: true });" +
  "   await store.addAttempt({ kind: 'quiz', ref: u.id, unit: u.id, ts: nu - dag, duration_ms: 300000, total: helft, score: helft, answers: alles.slice(-helft), synced: true });" +
  "   n += 1;" +
  " } return n; })()";
const FOUTZAAI = "(async () => { const store = await import('./js/store.js');" +
  " const idx = await (await fetch('content/index.json')).json();" +
  " const oorzaken = ['verkeerd_gelezen', 'verkeerd_gelezen', 'verkeerd_toegepast', 'niet_geweten', 'gegokt', 'verkeerd_gelezen'];" +
  " let n = 0;" +
  " for (const u of idx.units.slice(1, 7)) {" +
  "   const bank = await (await fetch(u.bank[0])).json();" +
  "   const vragen = (bank.vragen || []).slice(0, 2);" +
  "   const answers = vragen.map((q, i) => ({ q: q.id, unit: u.id, pagina: q.pagina, goed: false, gekozen: [], fouttype: oorzaken[(n + i) % oorzaken.length], twijfel: false, ms: 21000, onderwerp: q.cbr_onderwerp }));" +
  "   if (!answers.length) continue;" +
  "   n += answers.length;" +
  "   await store.addAttempt({ kind: 'quiz', ref: u.id, unit: u.id, duration_ms: 240000, total: answers.length, score: 0, answers, synced: true });" +
  " } return n; })()";
const THEMAZAAI = t => "(async () => { const store = await import('./js/store.js');" +
  " await store.setSetting('thema', '" + t + "');" +
  " try { localStorage.setItem('thema', '" + t + "'); } catch (e) {}" +
  " return '" + t + "'; })()";
const TAALZAAI = "(async () => { const store = await import('./js/store.js');" +
  " await store.setSetting('taal', 'en');" +
  " try { localStorage.setItem('taal', 'en'); } catch (e) {}" +
  " return 'en'; })()";
const ZAAI = "(async () => { const store = await import('./js/store.js');" +
  " const idx = await (await fetch('content/index.json')).json();" +
  " for (const u of idx.units) {" +
  "   if (u.paginas && u.paginas[0]) await store.addAttempt({ kind: 'lezen', ref: u.paginas[0].id, unit: u.id, duration_ms: 120000, klaar: true, content_version: idx.versie, answers: [], synced: true });" +
  "   if (u.aantalVragen > 0) await store.addAttempt({ kind: 'quiz', ref: u.id, unit: u.id, duration_ms: 300000, total: 1, score: 1, answers: [], synced: true });" +
  " } return idx.units.length; })()";

const ROUTES = [
  { naam: "route", hash: "route" },
  { naam: "leren", hash: "leren" },
  { naam: "blok", hash: "blok/{U}" },
  { naam: "lezen", hash: "blok/{U}/lezen/{P}" },
  { naam: "quiz-vraag", hash: "quiz/{U}" },
  { naam: "quiz-antwoord", hash: "quiz/{U}", script: `(() => { if (document.querySelector('.stempel')) { const n = document.querySelectorAll('.optie').length; for (let i = 0; i < n; i++) { const o = document.querySelectorAll('.optie')[i]; if (o && !o.classList.contains('gekozen')) o.click(); } } else { const o = document.querySelector('.optie, .bordtegel'); if (o) o.click(); } return new Promise(r => setTimeout(() => { const c = document.querySelector('[data-actie="controleer"]'); if (c) c.click(); r(1); }, 200)); })()` },
  { naam: "quiz-volgorde", hash: "quiz/{U}", herlaadTot: ".stempel", script: `(() => { const n = document.querySelectorAll('.optie').length; for (let i = 0; i < n; i++) { const o = document.querySelectorAll('.optie')[i]; if (o && !o.classList.contains('gekozen')) o.click(); } return new Promise(r => setTimeout(() => { const c = document.querySelector('[data-actie="controleer"]'); if (c) c.click(); r(1); }, 200)); })()` },
  { naam: "examen-intro", hash: "examen" },
  { naam: "examen-vraag", hash: "examen", script: `(() => { const b = document.querySelector('[data-actie="start-examen"]'); if (b) b.click(); return new Promise(r => setTimeout(r, 400)); })()` },
  { naam: "examen-overzicht", hash: "examen", script: `(() => { const b = document.querySelector('[data-actie="start-examen"]'); if (b) b.click(); return new Promise(r => setTimeout(() => { const o = document.querySelector('.optie, .bordtegel'); if (o) o.click(); const g = [...document.querySelectorAll('[data-actie="examen-ga"]')].pop(); const run = 1; for (let i = 0; i < 60; i++) { const nx = [...document.querySelectorAll('[data-actie="examen-ga"]')].pop(); if (nx) nx.click(); } r(1); }, 400)); })()` },
  { naam: "lampen", hash: "blok/U14/lezen/U14-P03" },
  { naam: "begrippen", hash: "begrippen" },
  { naam: "herhaling", hash: "herhaling" },
  { naam: "borden", hash: "borden" },
  { naam: "fouten", hash: "fouten" },
  { naam: "instellingen", hash: "instellingen" },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Windows houdt het chromeprofiel soms nog even vast. Het staat in de tempmap
   en ruimt vanzelf op, dus daar hoeft dit script niet hard op te vallen. */
const opruimen = () => { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch (e) { /* laat maar staan */ } };
/* Op Linux staat de browser op het pad, op Windows op een vaste plek. Zoek
   allebei, anders draait dit script maar op een van de twee computers. */
function vindBrowser() {
  for (const b of ["google-chrome", "chromium-browser", "chromium", "chrome"]) {
    try { require("child_process").execFileSync("which", [b], { stdio: "ignore" }); return b; } catch (e) { /* volgende */ }
  }
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  for (const f of [
    path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
  ]) if (fs.existsSync(f)) return f;
  return null;
}
const chromeBin = vindBrowser();
if (!chromeBin) { console.error("geen chrome of edge gevonden"); process.exit(1); }
const profile = fs.mkdtempSync(path.join(require("os").tmpdir(), "vvd50-chrome-"));
const chrome = spawn(chromeBin, ["--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=" + profile, "--remote-debugging-port=" + PORT, "--window-size=" + (WIDE ? "1280,900" : "390,844"), "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

async function cdp() {
  let list;
  for (let i = 0; i < 50; i++) {
    try { list = await fetch("http://127.0.0.1:" + PORT + "/json/list").then(r => r.json()); if (list.length) break; } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  const page = list.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, events, close: () => ws.close() };
}

(async () => {
  const c = await cdp();
  await c.send("Page.enable"); await c.send("Runtime.enable"); await c.send("Log.enable");
  await c.send("Emulation.setDeviceMetricsOverride", WIDE ? { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false } : { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  if (DARK || LIGHT) await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: DARK ? "dark" : "light" }] });
  const evalJs = async expr => { const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };

  /* eerst zaaien, dan pas fotograferen: ook een enkele opname wil een
     profiel dat ergens op lijkt */
  if (VRIJ) {
    await c.send("Page.navigate", { url: base });
    let klaar = false;
    for (let i = 0; i < 40 && !klaar; i++) { await sleep(250); klaar = await evalJs("!!document.querySelector('main.inhoud')"); }
    const n = await evalJs(ZAAI);
    console.log("vrijgespeeld: " + n + " blokken gezaaid");
  }
  if (DARK || LIGHT) {
    if (!VRIJ) {
      await c.send("Page.navigate", { url: base });
      let klaar = false;
      for (let i = 0; i < 40 && !klaar; i++) { await sleep(250); klaar = await evalJs("!!document.querySelector('main.inhoud')"); }
    }
    await evalJs(THEMAZAAI(DARK ? "donker" : "licht"));
    console.log("thema op " + (DARK ? "donker" : "licht") + " gezet");
  }
  if (BEHEERST) {
    if (!VRIJ && !DARK && !LIGHT) {
      await c.send("Page.navigate", { url: base });
      let klaar = false;
      for (let i = 0; i < 40 && !klaar; i++) { await sleep(250); klaar = await evalJs("!!document.querySelector('main.inhoud')"); }
    }
    const n = await evalJs(BEHEERSTZAAI);
    console.log("beheerst gezaaid: " + n + " blokken");
  }
  if (FOUTEN) {
    if (!VRIJ && !DARK && !LIGHT) {
      await c.send("Page.navigate", { url: base });
      let klaar = false;
      for (let i = 0; i < 40 && !klaar; i++) { await sleep(250); klaar = await evalJs("!!document.querySelector('main.inhoud')"); }
    }
    const n = await evalJs(FOUTZAAI);
    console.log("fouten gezaaid: " + n);
  }
  if (ENGELS) {
    if (!VRIJ && !DARK && !LIGHT) {
      await c.send("Page.navigate", { url: base });
      let klaar = false;
      for (let i = 0; i < 40 && !klaar; i++) { await sleep(250); klaar = await evalJs("!!document.querySelector('main.inhoud')"); }
    }
    await evalJs(TAALZAAI);
    console.log("taal op Engels gezet");
  }

  if (SINGLE) {
    /* eerst about:blank, anders is een navigatie naar dezelfde url met een
       andere hash geen herlading en leest de app het gezaaide profiel nooit */
    await c.send("Page.navigate", { url: "about:blank" });
    await sleep(150);
    await c.send("Page.navigate", { url: base });
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { await sleep(250); ok = await evalJs("!!document.querySelector('main.inhoud, .scene, .klaar')"); }
    await sleep(800);
    if (KLIK) {
      const geraakt = await evalJs("(() => { const el = document.querySelector(" + JSON.stringify(KLIK) + "); if (!el) return false; el.click(); return true; })()");
      console.log(geraakt ? "aangetikt: " + KLIK : "niets gevonden voor " + KLIK);
      await sleep(500);
    }
    const full = await evalJs("Math.min(document.documentElement.scrollHeight, 6000)");
    await c.send("Emulation.setDeviceMetricsOverride", WIDE ? { width: 1280, height: full, deviceScaleFactor: 1, mobile: false } : { width: 390, height: full, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
    const shot = await c.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(outDir, "enkel" + (WIDE ? "-breed" : "") + ".png"), Buffer.from(shot.result.data, "base64"));
    console.log((ok ? "ok  " : "LEEG") + " enkel " + base);
    c.close(); chrome.kill(); opruimen();
    return;
  }
  /* find a unit and page to use for the unit routes */
  await c.send("Page.navigate", { url: base + "content/index.json" });
  await sleep(800);
  const idxText = await evalJs("document.body.innerText");
  const idx = JSON.parse(idxText);
  const U = idx.units[0].id, P = idx.units[0].paginas[0].id;
  const withQuiz = idx.units.slice().reverse().find(u => u.aantalVragen > 0) || idx.units[0];


  for (const r of ROUTES) {
    const hash = r.hash.replace("{U}", r.naam.startsWith("quiz") ? withQuiz.id : U).replace("{P}", P);
    await c.send("Page.navigate", { url: "about:blank" });
    await sleep(150);
    await c.send("Page.navigate", { url: base + "#/" + hash });
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { await sleep(250); ok = await evalJs("!!document.querySelector('main.inhoud')"); }
    /* some routes want a particular sampled question: reload until the selector appears */
    if (r.herlaadTot) {
      let found = false;
      for (let tries = 0; tries < 12 && !found; tries++) {
        found = await evalJs("!!document.querySelector('" + r.herlaadTot + "')");
        if (!found) { await c.send("Page.navigate", { url: "about:blank" }); await sleep(120); await c.send("Page.navigate", { url: base + "#/" + hash }); let ok2 = false; for (let i = 0; i < 40 && !ok2; i++) { await sleep(250); ok2 = await evalJs("!!document.querySelector('main.inhoud')"); } }
      }
      if (!found) { console.log("geen " + r.herlaadTot + " gevonden voor " + r.naam); continue; }
    }
    if (r.script) { await evalJs(r.script); await sleep(600); }
    await sleep(400);
    const shot = await c.send("Page.captureScreenshot", { format: "png" });
    const file = path.join(outDir, r.naam + (ENGELS ? "-en" : "") + (DARK ? "-donker" : "") + (WIDE ? "-breed" : "") + ".png");
    fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    const title = await evalJs("document.title");
    console.log((ok ? "ok  " : "LEEG") + " " + r.naam.padEnd(14) + " " + title);
  }
  const problems = c.events.filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)) || (e.method === "Log.entryAdded" && e.params.entry.level === "error"));
  for (const p of problems) {
    if (p.method === "Runtime.exceptionThrown") console.log("  EXCEPTION " + (p.params.exceptionDetails.exception && p.params.exceptionDetails.exception.description || p.params.exceptionDetails.text));
    else if (p.method === "Log.entryAdded") console.log("  LOG " + p.params.entry.text + " " + (p.params.entry.url || ""));
    else console.log("  CONSOLE " + p.params.args.map(a => a.value || a.description).join(" "));
  }
  console.log(problems.length + " fouten in de console");
  c.close();
  chrome.kill();
  opruimen();
})().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
