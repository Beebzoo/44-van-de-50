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

const ROUTES = [
  { naam: "route", hash: "route" },
  { naam: "leren", hash: "leren" },
  { naam: "blok", hash: "blok/{U}" },
  { naam: "lezen", hash: "blok/{U}/lezen/{P}" },
  { naam: "quiz-vraag", hash: "quiz/{U}" },
  { naam: "quiz-antwoord", hash: "quiz/{U}", script: `(() => { const o = document.querySelector('.optie, .bordtegel'); if (o) o.click(); return new Promise(r => setTimeout(() => { const c = document.querySelector('[data-actie="controleer"]'); if (c) c.click(); r(1); }, 200)); })()` },
  { naam: "borden", hash: "borden" },
  { naam: "fouten", hash: "fouten" },
  { naam: "instellingen", hash: "instellingen" },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chromeBin = ["google-chrome", "chromium-browser", "chromium"].find(b => { try { require("child_process").execFileSync("which", [b], { stdio: "ignore" }); return true; } catch (e) { return false; } });
if (!chromeBin) { console.error("geen chrome gevonden"); process.exit(1); }
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

  /* find a unit and page to use for the unit routes */
  await c.send("Page.navigate", { url: base + "content/index.json" });
  await sleep(800);
  const idxText = await evalJs("document.body.innerText");
  const idx = JSON.parse(idxText);
  const U = idx.units[0].id, P = idx.units[0].paginas[0].id;
  const withQuiz = idx.units.find(u => u.aantalVragen > 0) || idx.units[0];

  for (const r of ROUTES) {
    const hash = r.hash.replace("{U}", r.naam.startsWith("quiz") ? withQuiz.id : U).replace("{P}", P);
    await c.send("Page.navigate", { url: "about:blank" });
    await sleep(150);
    await c.send("Page.navigate", { url: base + "#/" + hash });
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { await sleep(250); ok = await evalJs("!!document.querySelector('main.inhoud')"); }
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
  fs.rmSync(profile, { recursive: true, force: true });
})().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
