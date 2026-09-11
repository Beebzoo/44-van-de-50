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
const PORT = 9333;
const DARK = flags.includes("donker");
const WIDE = flags.includes("breed");
/* enkel: screenshot the base url as one page once a .scene or main.inhoud exists */
const SINGLE = flags.includes("enkel");

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
  if (DARK) await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  const evalJs = async expr => { const r = await c.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };

  if (SINGLE) {
    await c.send("Page.navigate", { url: base });
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { await sleep(250); ok = await evalJs("!!document.querySelector('main.inhoud, .scene, .klaar')"); }
    await sleep(800);
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
    const file = path.join(outDir, r.naam + (DARK ? "-donker" : "") + (WIDE ? "-breed" : "") + ".png");
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
