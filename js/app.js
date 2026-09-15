/* 44 van de 50: one state object, one render().

   Content comes from content/index.json and the unit and bank files it
   lists. Progress comes from the attempt log in IndexedDB (store.js) and
   is derived on every render (voortgang.js). Screens are template
   literals; clicks are delegated on data-actie attributes. */
import * as store from "./store.js";
import { listen, go } from "./router.js";
import { loadSigns, sign, bordHtml, hasSymbol, families, allSigns, familyName, lampHtml, LAMPEN } from "./signs.js";
import * as V from "./voortgang.js";
import * as Q from "./quiz.js";
import { pageHtml, setScenes } from "./lezen.js";
import { sceneSvg, scenePlate } from "./scene.js";
import * as SRS from "./srs.js";
import * as sync from "./sync.js";
import * as B from "./begrippen.js";
import { t, taal, zetTaal, isEngels, DAGEN as TDAGEN, MAANDEN as TMAANDEN, LANGEDAG, LANGEMAAND } from "./taal.js";
import { remwegSvg, diagramHtml, kentDiagram } from "./diagram.js";

const app = document.getElementById("app");
const S = {
  route: { name: "route" }, index: null, units: [], unitsNl: [], vertalingen: null, vragenEn: null, unitById: {}, bankNl: {}, bank: {}, qById: {}, pools: {}, scenes: {},
  attempts: [], history: new Map(), states: {}, settings: {}, boxes: new Map(),
  run: null, sheet: null, viewer: null, schrijf: null, toast: null, gemeld: new Set(), familie: null, lezenStart: null, zojuistGehaald: null,
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const langeDatum = d => isEngels()
  ? LANGEDAG.en[d.getDay()] + " " + d.getDate() + " " + LANGEMAAND.en[d.getMonth()]
  : LANGEDAG.nl[d.getDay()] + " " + d.getDate() + " " + LANGEMAAND.nl[d.getMonth()];
const datum = d => isEngels()
  ? TDAGEN.en[d.getDay()] + " " + d.getDate() + " " + TMAANDEN.en[d.getMonth()]
  : TDAGEN.nl[d.getDay()] + " " + d.getDate() + " " + TMAANDEN.nl[d.getMonth()];
const midnight = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
/* the link under an explanation: the section number when the page title carries one, otherwise the page itself */
const kortePaginanaam = p => { const m = p.titel.match(/^§\S+/); return m ? m[0] : t("de pagina"); };
const dagenTot = iso => Math.ceil((midnight(new Date(iso + "T00:00:00")) - midnight(new Date())) / 86400000);

/* ==== icons: one stroke weight, no emoji ==== */
const I = {
  terug: '<svg class="ico" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  sluit: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pijl: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  notitie: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v5h5M8 13h8M8 17h5"/></svg>',
  instellingen: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 8h8M17 8h3M4 16h3M12 16h8"/><circle cx="14.5" cy="8" r="2.5"/><circle cx="9.5" cy="16" r="2.5"/></svg>',
  route: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 21V9M12 9h6l2-2.5L18 4h-6M12 13H7l-2 2 2 2h5"/></svg>',
  leren: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/></svg>',
  borden: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 4l9 15H3z"/></svg>',
  fouten: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  vink: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  kruis: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  beeld: '<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>',
  vergroot: '<svg class="ico" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>',
};

/* ==== boot ==== */
async function boot() {
  store.persist(); /* not awaited: a permission prompt must never block the start */
  S.settings = { thema: "licht", tekst: "normaal", taal: "nl", examenDatum: null, notities: {}, ...(await store.allSettings()) };
  zetTaal(S.settings.taal);
  S.koppelcode = await sync.learnerCode();
  S.index = await fetch("content/index.json").then(r => r.json());
  if (!S.settings.examenDatum) S.settings.examenDatum = S.index.examenDatum;
  await loadSigns();
  try { B.laad(await fetch("content/begrippen.json").then(r => r.json())); } catch (e) { /* zonder begrippenlijst blijft de tekst gewoon tekst */ }
  const units = await Promise.all(S.index.units.map(u => fetch(u.bestand).then(r => r.json())));
  S.unitsNl = units.sort((a, b) => a.volgorde - b.volgorde);
  await Promise.all(S.index.units.map(async u => {
    S.bankNl[u.id] = [];
    for (const f of u.bank) { const b = await fetch(f).then(r => r.json()); S.bankNl[u.id].push(...b.vragen); }
  }));
  await laadVertalingen();
  pasTaalToe();
  await Promise.all((S.index.scenes || []).map(async id => { S.scenes[id] = await fetch("content/scenes/" + id + ".json").then(r => r.json()); }));
  setScenes(S.scenes);
  for (const u of S.units) S.pools[u.id] = (S.bankNl[u.id] || []).filter(q => !q.reserve && Q.SUPPORTED.has(q.type)).map(q => q.id);
  await refresh();
  registerSw();
  /* the sync never blocks: it runs after the first paint, on reconnect, and after every attempt */
  setTimeout(() => sync.flush().then(n => { if (n) refresh().then(render); }), 800);
  addEventListener("online", () => sync.flush().then(n => { if (n) refresh().then(render); }));
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("input", onInput);
  addEventListener("keydown", onKey);
  listen(route => { leavePage(); S.route = route; onRoute(); render(); });
}
/* De Engelse leespagina's staan in content/units-en/ en zijn een overlay: per
   pagina dezelfde blokken in dezelfde volgorde, met alleen de te vertalen
   velden erin. Ontbreekt een blok of een heel bestand, dan blijft het
   Nederlands staan, dus de app kan nooit leeg vallen. */
async function laadVertalingen() {
  if (!isEngels() || S.vertalingen) return;
  const uit = {}, vragen = {};
  await Promise.all(S.index.units.map(async u => {
    try { const r = await fetch("content/units-en/" + u.id + ".json"); uit[u.id] = r.ok ? await r.json() : null; }
    catch (e) { uit[u.id] = null; }
    /* alleen ophalen waar de index zegt dat er iets te halen valt */
    if (!u.vragenEn) return;
    try {
      const r = await fetch("content/bank-en/" + u.id + ".json");
      if (r.ok) { const j = await r.json(); for (const [id, v] of Object.entries(j.vragen || {})) vragen[id] = v; }
    } catch (e) { /* een blok zonder vertaalde vragen blijft gewoon Nederlands */ }
  }));
  S.vertalingen = uit;
  S.vragenEn = vragen;
}

/* De Engelse vraag is een overlay op de Nederlandse, op id en niet op volgorde,
   want id's liggen vast en de volgorde in de bank niet. Ontbreekt een veld of
   een hele vraag, dan blijft het Nederlands staan: de app toont nooit een gat.

   Wat met opzet Nederlands blijft in allebei de talen is de bordcode zelf en
   alles wat de tekening laat zien, want dat is wat je op de dag voor je hebt. */
function voegSamenVraag(q, ov) {
  if (!ov) return q;
  const opties = (q.opties || []).map(o => {
    const oo = ov.opties && ov.opties[o.id];
    return oo ? { ...o, ...oo } : o;
  });
  return { ...q, stam: ov.stam || q.stam, opties, uitleg: { ...q.uitleg, ...(ov.uitleg || {}) }, vertaald: true };
}
function voegSamen(u, ov) {
  if (!ov) return u;
  const paginas = u.paginas.map(pg => {
    const po = ov.paginas && ov.paginas[pg.id];
    if (!po) return pg;
    const body = (pg.body || []).map((b, i) => {
      const bo = po.body && po.body[i];
      return bo && bo.type === undefined ? { ...b, ...bo } : bo && bo.type === b.type ? { ...b, ...bo } : b;
    });
    return { ...pg, titel: po.titel || pg.titel, body, vertaald: !!(po.body && po.body.length) };
  });
  return { ...u, titel: ov.titel || u.titel, intro: ov.intro || u.intro, paginas };
}
function pasTaalToe() {
  const en = isEngels();
  S.units = en && S.vertalingen ? S.unitsNl.map(u => voegSamen(u, S.vertalingen[u.id])) : S.unitsNl;
  S.unitById = {};
  for (const u of S.units) S.unitById[u.id] = u;
  S.bank = {};
  S.qById = {};
  for (const [id, vragen] of Object.entries(S.bankNl)) {
    S.bank[id] = en && S.vragenEn ? vragen.map(q => voegSamenVraag(q, S.vragenEn[q.id])) : vragen;
    for (const q of S.bank[id]) S.qById[q.id] = q;
  }
  /* een lopende ronde wijst naar de oude vraagobjecten, dus haak die opnieuw
     aan, anders blijft de vraag op je scherm in de oude taal staan */
  if (S.run) for (const it of S.run.items) if (S.qById[it.q.id]) it.q = S.qById[it.q.id];
}
async function refresh() {
  S.attempts = await store.allAttempts();
  S.history = V.questionHistory(S.attempts);
  S.states = V.unitStates(S.attempts, S.units, S.pools, S.history);
  S.boxes = SRS.boxes(S.attempts, S.qById, S.states);
  S.gemeld = new Set(S.attempts.filter(a => a.kind === "flag").map(a => a.ref));
}
async function log(a) { await store.addAttempt(a); await refresh(); sync.flush().then(n => { if (n) refresh().then(render); }); }

function onRoute() {
  S.sheet = null; S.viewer = null; S.schrijf = null;
  if (S.route.name === "quiz") startRunIfNeeded();
  else if (S.run && !S.run.klaar && S.route.name !== "quiz") { /* a run left half-way is dropped; nothing was scored */ S.run = null; }
  if (S.route.name === "lezen") S.lezenStart = Date.now();
  scrollTo(0, 0);
}
function leavePage() {
  if (S.route.name === "lezen" && S.lezenStart) {
    const ms = Date.now() - S.lezenStart;
    const u = S.unitById[S.route.unit];
    if (u && ms > 8000) store.addAttempt({ kind: "lezen", ref: S.route.pagina || u.paginas[0].id, unit: u.id, duration_ms: Math.min(ms, 30 * 60000), klaar: false, content_version: S.index.versie, answers: [] }).then(refresh);
    S.lezenStart = null;
  }
}

/* ==== shell ==== */
function countdownChip() {
  const d = dagenTot(S.settings.examenDatum);
  const cls = d < 0 ? "voorbij" : d <= 14 ? "dringend" : "";
  if (d < 0) return `<button class="aftelpil ${cls}" data-actie="open-route">${esc(t("examen geweest"))}</button>`;
  return `<button class="aftelpil ${cls}" data-actie="open-route" aria-label="${esc(t("{d} dagen tot je examen", { d }))}">
    <span class="cijfer">${d}</span><span class="label">${esc(t("dagen"))}<br>${esc(t("tot je examen"))}</span></button>`;
}
function taalknop() {
  const nu = taal();
  return `<div class="taalknop" role="group" aria-label="${esc(t("Taal"))}">${["nl", "en"].map(x => `<button type="button" class="${x === nu ? "actief" : ""}" data-actie="taal" data-waarde="${x}" aria-pressed="${x === nu}" aria-label="${esc(x === "en" ? t("Schakel naar het Engels") : t("Schakel naar het Nederlands"))}">${x.toUpperCase()}</button>`).join("")}</div>`;
}
function header(v) {
  const nav = ["route", "leren", "examen", "borden", "begrippen", "herhaling", "fouten"].map(n => `<a href="#/${n}" class="${S.route.name === n || (n === "leren" && ["blok", "lezen"].includes(S.route.name)) ? "actief" : ""}">${esc(t({ route: "Route", leren: "Leren", examen: "Oefenexamen", borden: "Borden", begrippen: "Begrippen", herhaling: "Herhaling", fouten: "Fouten" }[n]))}</a>`).join("");
  const links = v.terug
    ? `<a class="ikoonknop" href="${esc(v.terug)}" aria-label="${esc(t(v.sluit ? "Sluiten" : "Terug"))}">${v.sluit ? I.sluit : I.terug}</a>`
    : `<a class="merk" href="#/route">44 van de 50<span class="datum">${esc(langeDatum(new Date()))}</span></a>`;
  /* Het tandwiel is de enige weg naar Instellingen, en daar staat de
     koppelcode. Tijdens een quiz of een examen blijft hij weg: daar zou hij je
     ronde afbreken, en in een examen loopt ook nog de klok. */
  const instel = S.run || S.route.name === "instellingen" ? "" : `<a class="ikoonknop tandwiel" href="#/instellingen" aria-label="${esc(t("Instellingen"))}">${I.instellingen}</a>`;
  /* De taalknop stond in de kopbalk en duwde daar het woordmerk kapot. Hij
     staat ook bovenaan Instellingen, en dat is de plek waar je hem zoekt. */
  return `<header class="kopbalk">${links}<nav class="nav">${nav}</nav><div class="midden">${v.midden || ""}</div>${instel}${v.chip === false ? "" : countdownChip()}</header>`;
}
function lane() {
  const cur = currentUnit();
  return `<div class="baan" aria-hidden="true">${S.units.map(u => { const st = S.states[u.id]; const c = st.staat === "beheerst" ? "vol" : st.staat === "voorlopig" ? "half" : ""; return `<span class="streep ${c} ${cur && cur.id === u.id ? "nu" : ""}"></span>`; }).join("")}</div>`;
}
function tabbar() {
  const tabs = [["route", t("Route"), I.route], ["leren", t("Leren"), I.leren], ["borden", t("Borden"), I.borden], ["fouten", t("Fouten"), I.fouten]];
  const act = n => S.route.name === n || (n === "leren" && ["blok", "lezen", "gehaald"].includes(S.route.name)) || (n === "borden" && S.route.name === "bord");
  return `<nav class="onderbalk tab"><div class="tabbalk">${tabs.map(([n, l, ic]) => `<a href="#/${n}" class="${act(n) ? "actief" : ""}"><span class="vak">${ic}</span><span>${l}</span></a>`).join("")}</div></nav>`;
}
const hoofdletter = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
function actionbar(html) { return `<div class="onderbalk"><div class="actiebalk">${html}</div></div>`; }
function overlays() {
  let h = "";
  if (S.sheet === "route") h += `<div class="scrim" data-actie="sluit-sheet"></div><div class="sheet" role="dialog" aria-label="Route"><div class="handvat"></div>${countdownBlock()}${timeline()}</div>`;
  if (S.schrijf) {
    const n = notitieVan(S.schrijf.ref) || { tekst: "" };
    const d = notitieDoel(S.schrijf.ref);
    h += `<div class="scrim" data-actie="notitie-annuleer"></div><div class="sheet notitiesheet" role="dialog" aria-label="${esc(t("Notitie"))}"><div class="handvat"></div>
      <p class="meta-3">${esc(S.schrijf.titel || d.titel)}</p>
      <textarea id="notitieveld" class="notitieveld" rows="7" placeholder="${esc(t("Schrijf op wat je wilt onthouden"))}">${esc(n.tekst)}</textarea>
      <div class="rij"><button class="knop omlijnd" data-actie="notitie-annuleer">${esc(t("Annuleren"))}</button><button class="knop primair groei" data-actie="notitie-bewaar" data-ref="${esc(S.schrijf.ref)}" data-titel="${esc(S.schrijf.titel || "")}">${esc(t("Bewaren"))}</button></div>
      ${n.tekst ? `<button class="knop tekstknop" data-actie="notitie-wis" data-ref="${esc(S.schrijf.ref)}">${esc(t("Verwijderen"))}</button>` : ""}</div>`;
  }
  if (S.viewer && S.viewer.bord) {
    const code = S.viewer.bord, b = sign(code);
    h += `<div class="viewer" data-actie="sluit-viewer" role="dialog" aria-label="${esc(code)}">${bordHtml(code, 176)}<div class="naam"><span class="bordcode">${esc(code)}</span><br>${b ? esc(b.betekenis) : ""}</div><a class="knop tekstknop" href="#/borden/${encodeURIComponent(code)}">${esc(t("Bekijk in Borden"))}</a></div>`;
  } else if (S.viewer && S.viewer.begrip) {
    const b = S.viewer.begrip;
    /* een bord, of twee die elkaar afmaken (begin en einde), of een tekening,
       of een van de vier diagrammen: wat dit begrip het beste laat zien */
    const codes = (b.borden || (b.bord ? [b.bord] : [])).filter(hasSymbol);
    const beeld = codes.length > 1
      ? `<div class="begripborden">${codes.slice(0, 3).map(c => `<figure>${bordHtml(c, 64)}<figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>`
      : codes.length ? bordHtml(codes[0], 140)
        : b.scene && S.scenes[b.scene] ? sceneSvg(S.scenes[b.scene])
          : b.diagram && kentDiagram(b.diagram) ? diagramHtml(b.diagram, "")
            : "";
    const bron = b.bron.boek ? t("Boek p. {p}", { p: b.bron.boek }) + (b.bron.sectie ? " (\u00a7" + b.bron.sectie + ")" : "") : t("SpeedTheorie slide {n}", { n: b.bron.slide });
    h += `<div class="viewer begripviewer" data-actie="sluit-viewer" role="dialog" aria-label="${esc(b.term)}"><div class="begripkaart">${beeld}<h2 class="kop2">${esc(hoofdletter(b.term))}</h2><p class="lees">${esc(isEngels() && b.uitleg_en ? b.uitleg_en : b.uitleg)}</p><p class="meta-3">${esc(bron)}</p></div></div>`;
  } else if (S.viewer && S.viewer.scene && S.scenes[S.viewer.scene]) {
    const sc = S.scenes[S.viewer.scene];
    h += `<div class="viewer" data-actie="sluit-viewer" role="dialog" aria-label="${esc(t("Tekening"))}">${sceneSvg(sc)}<div class="naam">${esc(sc.alt)}</div></div>`;
  }
  if (S.toast) h += `<div class="toast" role="status">${esc(S.toast.tekst)}${S.toast.actie ? `<button data-actie="${esc(S.toast.actie)}">${esc(S.toast.knop)}</button>` : ""}</div>`;
  return h;
}
function render() {
  const screen = SCREENS[S.route.name] || SCREENS.route;
  const v = screen();
  const onder = v.onder === "tab" ? tabbar() : v.onder ? actionbar(v.onder) : "";
  app.innerHTML = `${v.kop === false ? "" : header(v)}${v.baan === false ? "" : lane()}<div class="romp"><main class="inhoud ${v.onder ? "" : "geen-balk"}">${v.body}</main>${S.route.name === "route" ? "" : `<aside class="rail">${timeline(true)}</aside>`}</div>${onder}${overlays()}`;
  document.title = (v.titel ? v.titel + " · " : "") + "44 van de 50";
  document.documentElement.lang = taal();
}
const q0 = run => Q.current(run).q;
const klokTekst = sec => Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
const ONDERWERP_NL = {
  gebruik_van_de_weg: "Gebruik van de weg",
  voorrang_en_voor_laten_gaan: "Voorrang en voor laten gaan",
  bijzondere_wegen_weggebruikers_manoeuvres: "Bijzondere wegen en manoeuvres",
  veilig_rijden_en_noodsituaties: "Veilig rijden en noodsituaties",
  verkeerstekens_en_aanwijzingen: "Verkeerstekens en aanwijzingen",
  verantwoorde_deelname_en_milieu: "Verantwoorde deelname en milieu",
  wetgeving: "Wetgeving",
  voertuigkennis: "Voertuigkennis",
};
/* De feedback opent met Goed of Fout, en in het Engels met Correct of Wrong.
   Het uitlegpaneel zegt zelf al of het goed was, dus dat woord gaat eraf. */
const VOORVOEGSEL = /^(Goed|Fout|Correct|Wrong)[.,:]?\s*/i;
const onderwerpNaam = k => t(ONDERWERP_NL[k] || k);

/* ==== het oefenexamen ====

   De klok loopt door terwijl je kijkt, dus hij tikt in de DOM en niet via een
   hertekening: die zou je antwoord en je cursor kwijtraken. */
let examenTik = null;
function startKlok() {
  stopKlok();
  examenTik = setInterval(() => {
    const run = S.run;
    if (!run || !run.examen || run.klaar) return stopKlok();
    const el = document.getElementById("examenklok");
    if (el) el.textContent = klokTekst(Q.seconden(run));
    if (Q.tijdOp(run)) leverIn();
  }, 1000);
}
function stopKlok() { if (examenTik) { clearInterval(examenTik); examenTik = null; } }

function examenPool() {
  const pool = [];
  for (const u of S.units) {
    if (!S.states[u.id] || !S.states[u.id].quizOpen) continue;
    for (const q of S.bank[u.id] || []) pool.push(q);
  }
  return pool;
}

/* Zonder nummer een verse trekking, met een nummer een van de zes vaste sets. */
function startExamen(nr) {
  const pool = examenPool();
  if (pool.length < Q.EXAMEN.getoond) return;
  const vragen = nr ? Q.sampleExamenVast(pool, nr) : Q.sampleExamen(pool, S.history);
  S.run = Q.newExamen(vragen, nr);
  startKlok();
  autoSpeel(S.run);
}
async function leverIn() {
  const run = S.run;
  if (!run || !run.examen || run.klaar) return;
  stopKlok();
  Q.sluitExamen(run, S.history);
  await log(Q.toAttempt(run, S.index.versie));
  render();
}

/* De zes vaste examens, met per set je beste poging. Twee keer hetzelfde
   examen doen meet wat je geleerd hebt; twee verse trekkingen meten ook het
   geluk van de trekking. */
/* De donkere kop van het examen: drie getallen die de verwachting zetten
   voordat de klok gaat lopen. */
function examenKop(extra) {
  return `<header class="examenkop">
    <a class="sluit" href="#/route" aria-label="${esc(t("Sluiten"))}">${I.sluit}</a>
    <span class="wenkbrauw">${esc(t("OEFENEXAMEN"))}</span>
    <h1>44 van de 50</h1>
    ${extra}
  </header>`;
}

function vasteExamens(sims) {
  const beste = {};
  for (const a of sims) {
    if (!a.ref || !a.ref.startsWith("examen-")) continue;
    const nr = a.ref.slice(7);
    if (!beste[nr] || a.score > beste[nr].score) beste[nr] = a;
  }
  const rijen = Array.from({ length: Q.VASTE_EXAMENS }, (_, i) => i + 1).map(nr => {
    const b = beste[nr];
    const staat = b
      ? `<span class="staatlabel ${b.score >= Q.EXAMEN.halen ? "goed" : ""}">${esc(t("beste {score} van {n}", { score: b.score, n: b.total }))}</span>`
      : `<span class="meta">${esc(t("nog niet gedaan"))}</span>`;
    return `<button type="button" class="setkaart ${b ? "gedaan" : ""}" data-actie="start-examen" data-nr="${nr}">
      <span class="naam">${esc(t("Set {n}", { n: nr }))}</span>${staat}</button>`;
  }).join("");
  return `<p class="wenkbrauw donker">${esc(t("KIES EEN SET"))}</p>
    <div class="setkiezer">${rijen}</div>
    <p class="meta-3">${esc(t("Elk vast examen bevat altijd dezelfde vragen, dus je kunt je score met die van vorige keer vergelijken. De verse trekking onderaan kiest elke keer nieuwe vragen."))}</p>`;
}

function examenIntro() {
  const open = S.units.filter(u => S.states[u.id] && S.states[u.id].quizOpen);
  const pool = open.reduce((a, u) => a + (S.bank[u.id] || []).length, 0);
  const sims = S.attempts.filter(a => a.kind === "examen");
  const laatste = sims.slice(-5).reverse();
  const genoeg = pool >= Q.EXAMEN.getoond;
  const tegels = `<div class="examentegels">
      <div><span class="cijfer">${Q.EXAMEN.getoond}</span><span class="bij">${esc(t("vragen, {n} tellen", { n: Q.EXAMEN.telt }))}</span></div>
      <div><span class="cijfer">${Q.EXAMEN.minuten}:00</span><span class="bij">${esc(t("{n} sec per vraag", { n: Math.round(Q.EXAMEN.minuten * 60 / Q.EXAMEN.getoond) }))}</span></div>
      <div><span class="cijfer">${Q.EXAMEN.halen}</span><span class="bij">${esc(t("om te halen"))}</span></div>
    </div>`;
  const regels = `<div class="kaart regelskaart">
      <p>${esc(t("Geen uitleg tussendoor. Je hoort pas aan het eind wat goed was."))}</p>
      <p>${esc(t("Twijfel je, vlag de vraag en loop aan het eind terug."))}</p>
      <p>${esc(t("De klok loopt door, ook als je de app dichtklapt."))}</p>
    </div>`;
  const body = `${examenKop(tegels)}
    <div class="examenlijf">
    ${genoeg ? "" : `<div class="kaart"><p style="margin:0">${esc(t("Er zijn nog {n} vragen te weinig vrijgespeeld. Rond eerst wat blokken af.", { n: Q.EXAMEN.getoond - pool }))}</p></div>`}
    ${genoeg ? vasteExamens(sims) : ""}
    ${genoeg ? regels : ""}
    ${laatste.length ? `<h2 class="kop2">${esc(t("Je vorige simulaties"))}</h2>${laatste.map(a => `<div class="kaart"><div class="rij"><span class="cijfer">${a.score}<span class="meta-3"> ${esc(t("van {n}", { n: a.total }))}</span></span><div class="groei"><strong>${esc(a.score >= Q.EXAMEN.halen ? t("Gehaald") : t("Niet gehaald"))}</strong><br><span class="meta">${esc(a.ref && a.ref.startsWith("examen-") ? t("Examen {n}", { n: a.ref.slice(7) }) : t("Verse trekking"))} · ${datum(new Date(a.created_at || a.ts))}</span></div></div></div>`).join("")}` : ""}
    </div>`;
  const onder = genoeg
    ? `<button class="knop primair groot" data-actie="start-examen">${esc(t("Verse trekking"))}<span class="pijl">${I.pijl}</span></button>`
    : `<a class="knop omlijnd groot" href="#/route">${esc(t("Terug naar Route"))}</a>`;
  return { titel: t("Oefenexamen"), terug: "#/route", sluit: true, kop: false, baan: false, body, onder };
}

/* De kop tijdens het examen. De voortgangsbalk is drie stukken: wat je
   beantwoord hebt, waar je nu bent, en wat er nog ligt. De tempozin zegt of je
   voor of achter ligt, want dat is het enige dat je onderweg over jezelf mag
   weten; over goed of fout hoor je niets. */
function examenBalk(run) {
  const n = run.items.length;
  const beantwoord = run.items.filter(it => (run.antwoorden[it.q.id] || []).length).length;
  const resterend = Q.seconden(run);
  const verstreken = Q.EXAMEN.minuten * 60 - resterend;
  const perVraag = Q.EXAMEN.minuten * 60 / Q.EXAMEN.getoond;
  const voor = Math.round(beantwoord * perVraag - verstreken);
  const mmss = sec => Math.floor(Math.abs(sec) / 60) + ":" + String(Math.abs(sec) % 60).padStart(2, "0");
  const tempo = beantwoord < 2 ? ""
    : voor >= 0 ? t("Je zit {tijd} voor op het tempo", { tijd: mmss(voor) })
      : t("Je zit {tijd} achter op het tempo", { tijd: mmss(voor) });
  const gevlagd = run.gemarkeerd.length;
  return `<header class="examenkop onderweg">
    <div class="rij">
      <span class="klok" id="examenklok">${klokTekst(resterend)}</span>
      <span class="rechts">${gevlagd ? `<span class="gevlagd">${esc(t("{n} gevlagd", { n: gevlagd }))}</span>` : ""}<span class="teller">${run.i + 1} / ${n}</span></span>
    </div>
    <div class="examenbaan" aria-hidden="true">
      <span class="gedaan" style="flex:${Math.max(beantwoord, 0.001)}"></span>
      <span class="nu" style="flex:1"></span>
      <span class="rest" style="flex:${Math.max(n - beantwoord - 1, 0.001)}"></span>
    </div>
    ${tempo ? `<p class="tempo">${esc(tempo)}</p>` : ""}
  </header>`;
}

function examenOverzicht(run) {
  const n = run.items.length;
  const beantwoord = run.items.filter(it => (run.antwoorden[it.q.id] || []).length).length;
  const hokjes = run.items.map((it, i) => {
    const heeft = (run.antwoorden[it.q.id] || []).length > 0;
    const vlag = run.gemarkeerd.includes(it.q.id);
    return `<button type="button" class="vraaghokje ${heeft ? "beantwoord" : ""} ${vlag ? "gemarkeerd" : ""}" data-actie="examen-ga" data-n="${i}">${i + 1}</button>`;
  }).join("");
  const body = `${examenBalk(run)}
    <div class="examenlijf">
    <h1 class="kop1">${esc(t("Overzicht"))}</h1>
    <p class="lees">${esc(t("Tik op een nummer om terug te gaan. Een blauw randje betekent dat je hem gemarkeerd hebt."))}</p>
    <div class="vraagraster">${hokjes}</div>
    ${beantwoord < n ? `<p class="meta">${esc(t("Je hebt er nog {n} niet beantwoord. Onbeantwoord telt als fout.", { n: n - beantwoord }))}</p>` : ""}
    </div>`;
  return { titel: t("Oefenexamen"), terug: "#/examen", sluit: true, midden: esc(t("Oefenexamen")), taal: false, kop: false, baan: false, body, onder: `<button class="knop primair groot" data-actie="examen-inleveren">${esc(t("Inleveren en nakijken"))}<span class="pijl">${I.pijl}</span></button>` };
}

function examenUitslagScherm(run) {
  const u = Q.examenUitslag(run);
  const rijen = Object.entries(u.perOnderwerp).sort((a, b) => a[1].goed / a[1].totaal - b[1].goed / b[1].totaal).map(([k, o]) => {
    const pct = Math.round(o.goed / o.totaal * 100);
    return `<tr><td>${esc(onderwerpNaam(k))}</td><td style="text-align:right">${esc(t("{goed} van {totaal}", { goed: o.goed, totaal: o.totaal }))}</td><td style="text-align:right" class="${pct < 70 ? "zwak" : ""}">${pct}%</td></tr>`;
  }).join("");
  const fouten = u.fouten.map(f => {
    const q = S.qById[f.q]; if (!q) return "";
    const uq = S.unitById[q.unit];
    const pg = uq ? uq.paginas.find(x => x.id === q.pagina) : null;
    return `<div class="kaart"><p style="margin:0 0 6px"><strong>${esc(q.stam)}</strong></p><p class="lees" style="margin:0">${esc(q.uitleg.regel)}</p><p class="meta-3" style="margin:6px 0 0">${f.gekozen.length ? "" : esc(t("Niet beantwoord. "))}${pg && uq ? `<a href="#/blok/${uq.id}/lezen/${pg.id}">${esc(t("Lees {pagina} opnieuw", { pagina: kortePaginanaam(pg) }))}</a>` : ""}</p></div>`;
  }).join("");
  const body = `<div style="text-align:center;margin:24px 0"><span class="cijfer cijfer-groot">${u.score} <span class="meta-3">${esc(t("van {n}", { n: u.totaal }))}</span></span><h1 class="kop1" style="margin-top:8px">${esc(u.gehaald ? t("Gehaald") : t("Niet gehaald"))}</h1><p class="meta">${esc(t("Je haalt het bij {halen} goed", { halen: u.halen }))}${u.onbeantwoord ? esc(t(", en je liet er {n} open", { n: u.onbeantwoord })) : ""}.</p>${tempoRegel(V.tempo(run.resultaten))}<p class="meta-3">${esc(t("Je deed er {min} minuten over van de {max}", { min: Math.round((run.duur || (Date.now() - run.start)) / 60000), max: Q.EXAMEN.minuten }))}</p></div>
    <h2 class="kop2">${esc(t("Per onderwerp"))}</h2><div class="tabelwrap"><table class="tabel"><thead><tr><th>${esc(t("Onderwerp"))}</th><th style="text-align:right">${esc(t("Goed"))}</th><th style="text-align:right"></th></tr></thead><tbody>${rijen}</tbody></table></div>
    ${u.fouten.length ? `<h2 class="kop2">${esc(u.fouten.length === 1 ? t("Deze ging mis") : t("Deze gingen mis"))}</h2>${fouten}` : ""}`;
  return { titel: t("Uitslag"), terug: "#/examen", sluit: true, midden: esc(t("Oefenexamen")), body, onder: `<a class="knop primair groot" href="#/examen">${esc(t("Klaar"))}<span class="pijl">${I.pijl}</span></a>` };
}

/* Het examenklaar-lampje. Drie voorwaarden, en alleen alle drie samen zijn
   groen. Een enkele goede simulatie zegt niets: je kunt geluk hebben gehad met
   de onderwerpen, of net die dag scherp zijn geweest. */
function examenklaarKaart() {
  const retentie = retentieOverAlles();
  const k = Q.examenklaar(S.attempts, retentie);
  const lampen = k.lampen.map(l => `<li class="lamp ${l.ok ? "aan" : ""}"><span class="bol"></span><span>${esc(l.tekst)}</span></li>`).join("");
  return `<a class="kaart klik examenklaar ${k.klaar ? "klaar" : ""}" href="#/examen">
    <div class="rij"><span class="groei"><strong>${esc(k.klaar ? t("Je bent examenklaar") : t("Nog niet examenklaar"))}</strong></span>${I.pijl}</div>
    <ul class="lampen">${lampen}</ul></a>`;
}
function retentieOverAlles() {
  const waarden = S.units.map(u => SRS.health(S.boxes, S.qById, u.id)).filter(x => x !== null);
  if (!waarden.length) return 0;
  return waarden.reduce((a, b) => a + b, 0) / waarden.length;
}

function currentUnit() {
  return S.units.find(u => S.states[u.id].staat !== "beheerst") || S.units[S.units.length - 1];
}

/* ==== route ==== */
function countdownBlock() {
  const d = dagenTot(S.settings.examenDatum);
  const dt = new Date(S.settings.examenDatum + "T00:00:00");
  const tekst = d > 1 ? t("dagen tot je examen, {datum}", { datum: datum(dt) }) : d === 1 ? t("dag tot je examen, morgen") : d === 0 ? t("vandaag is je examen") : t("je examen is geweest");
  return `<div class="aftel aftelblok"><span class="cijfer cijfer-groot" aria-hidden="true">${Math.max(d, 0)}</span><span class="meta">${tekst}</span></div>`;
}
/* ==== de laatste week ====

   Binnen een week verandert de taak van de app. Nieuwe stof erbij leren levert
   dan minder op dan het dichten van de gaten die je al kent, dus Route wijst
   niet langer naar het volgende blok maar naar je zwakste onderwerp, je
   openstaande fouten en een simulatie op de klok. */
const LAATSTE_WEEK = 7;

function laatsteWeek() {
  const d = dagenTot(S.settings.examenDatum);
  return d >= 0 && d <= LAATSTE_WEEK;
}

function laatsteWeekKaart() {
  const k = Q.examenklaar(S.attempts, retentieOverAlles());
  const fouten = V.foutenlog(S.attempts, S.history, S.qById);
  const traag = V.traagsteUnits(S.attempts, S.units);
  const genoegPool = examenPool().length >= Q.EXAMEN.getoond;

  /* het blok waar een zwak onderwerp het meest in zit */
  const blokVoor = onderwerp => S.units.find(u => (u.cbr_onderwerpen || []).includes(onderwerp) && S.states[u.id] && S.states[u.id].quizOpen);

  let actie;
  if (genoegPool && k.sims < Q.EXAMENKLAAR.simulaties) actie = { tekst: t("Doe een oefenexamen op de klok. Dat is nu meer waard dan nieuwe stof."), href: "#/examen", knop: t("Naar het oefenexamen") };
  else if (k.zwak.length) {
    const u = blokVoor(k.zwak[0]);
    actie = u
      ? { tekst: t("{onderwerp} staat onder de 70 procent. Pak dat blok er nog een keer bij.", { onderwerp: onderwerpNaam(k.zwak[0]) }), href: "#/quiz/" + u.id, knop: t("Oefen blok {n}", { n: u.volgorde }) }
      : { tekst: t("{onderwerp} staat onder de 70 procent.", { onderwerp: onderwerpNaam(k.zwak[0]) }), href: "#/fouten", knop: t("Naar je fouten") };
  } else if (fouten.length >= 5) actie = { tekst: t("Je hebt nog {n} vragen openstaan in je foutenlijst.", { n: fouten.length }), href: "#/fouten", knop: t("Oefen je fouten") };
  else if (genoegPool) actie = { tekst: t("Je staat er goed voor. Houd het warm met een simulatie op de klok."), href: "#/examen", knop: t("Naar het oefenexamen") };
  else actie = { tekst: t("Maak eerst genoeg blokken af om een oefenexamen te kunnen doen."), href: "#/leren", knop: t("Naar Leren") };

  const punten = [];
  if (k.zwak.length) punten.push(t("zwakste onderwerpen: {lijst}", { lijst: k.zwak.slice(0, 3).map(onderwerpNaam).join(", ") }));
  if (fouten.length) punten.push(t("{n} vragen in je foutenlijst", { n: fouten.length }));
  if (traag.length) punten.push(t("te traag in blok {lijst}", { lijst: traag.map(x => x.unit.volgorde).join(", ") }));

  return `<div class="kaart laatsteweek"><div class="rij"><span class="groei"><strong>${esc(t("Laatste week"))}</strong><br><span class="meta">${esc(actie.tekst)}</span></span></div>
    ${punten.length ? `<ul class="lijst meta-3" style="margin:8px 0 0">${punten.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    <a class="knop primair groot" style="margin-top:12px" href="${actie.href}">${esc(actie.knop)}<span class="pijl">${I.pijl}</span></a></div>`;
}

function timeline(compact) {
  const cur = currentUnit();
  const dt = new Date(S.settings.examenDatum + "T00:00:00");
  const rows = S.units.map(u => {
    const st = S.states[u.id];
    const cls = st.staat === "beheerst" ? "klaar" : u.id === cur.id ? "nu" : st.staat === "vergrendeld" ? "vergrendeld" : "";
    const paal = st.staat === "beheerst" ? "groen" : st.staat === "voorlopig" ? "half" : u.id === cur.id ? "nu" : "";
    const staat = st.staat === "beheerst" ? t("klaar") : u.id === cur.id ? t("nu") : st.staat === "voorlopig" ? t("bijna") : t("wk {n}", { n: u.week });
    return `<li class="${cls}"><a href="#/blok/${u.id}"><span class="paaltje ${paal}"></span><span class="nr">${u.volgorde}</span><span class="titel">${esc(u.titel)}</span><span class="staat">${staat}</span></a></li>`;
  }).join("");
  return `<h2 class="kop2" style="margin-top:${compact ? 0 : 24}px">${esc(t("Route"))} <span class="meta-3" style="float:right">${esc(t("vandaag {datum}", { datum: datum(new Date()) }))}</span></h2><ul class="tijdlijn">${rows}
    <li><span class="paaltje doel"></span><span class="nr"></span><span class="titel">${esc(t("Theorie-examen"))}</span><span class="staat">${datum(dt)}</span></li>
    <li><span class="paaltje later"></span><span class="nr"></span><span class="titel">${esc(t("Praktijklessen"))}</span><span class="staat">${esc(t("daarna"))}</span></li></ul>`;
}
/* the daily Leitner set: only once a block is beheerst does it start */
function herhalingKaart() {
  if (!S.boxes.size) return "";
  const set = SRS.dailySet(S.boxes, S.qById);
  const vandaagGedaan = S.attempts.some(a => a.kind === "herhaling" && a.ts >= new Date().setHours(0, 0, 0, 0));
  if (!set.vragen.length) return "";
  const min = Math.max(1, Math.round(set.vragen.length * 0.5));
  return `<div class="kaart"><div class="rij"><div class="groei"><strong>${esc(t("Herhaling vandaag"))}</strong><br><span class="meta">${esc(t("{n} vragen, ongeveer {min} minuten", { n: set.vragen.length, min }))}${set.aantalDue ? esc(t(", {n} aan de beurt", { n: set.aantalDue })) : ""}${vandaagGedaan ? esc(t(" · vandaag al gedaan")) : ""}</span></div><a class="knop ${vandaagGedaan ? "omlijnd" : "primair"}" href="#/quiz/herhaling/herhaling">${esc(t("Start"))}</a></div></div>`;
}
function volgendeActie(u) {
  const st = S.states[u.id];
  const pool = S.pools[u.id] || [];
  if (st.staat === "vergrendeld") return { tekst: t("Eerst het vorige blok afronden"), href: "#/blok/" + u.id, knop: t("Bekijk blok") };
  if (!u.quiz.gate) return { tekst: t("Lees de pagina en rond af"), href: "#/blok/" + u.id + "/lezen/" + u.paginas[0].id, knop: t("Lezen") };
  if (st.staat === "lezen" || (st.staat === "oefenen" && st.pogingen === 0 && !S.attempts.some(a => a.kind === "lezen" && a.unit === u.id))) return { tekst: t("{n} pagina's om te lezen", { n: u.paginas.length }), href: "#/blok/" + u.id + "/lezen/" + u.paginas[0].id, knop: t("Lezen") };
  if (pool.length < u.quiz.lengte) return { tekst: t("De quiz voor dit blok is nog niet klaar"), href: "#/blok/" + u.id, knop: t("Bekijk blok") };
  if (st.staat === "voorlopig") {
    const last = S.attempts.filter(a => a.kind === "quiz" && a.ref === u.id && a.score === a.total).pop();
    const uren = last ? Math.max(0, Math.ceil((last.ts + 12 * 3600000 - Date.now()) / 3600000)) : 0;
    return { tekst: uren > 0 ? t("Voorlopig gehaald. Over {uren} uur kun je bevestigen", { uren }) : t("Voorlopig gehaald. Bevestig met een tweede quiz"), href: "#/quiz/" + u.id, knop: uren > 0 ? t("Oefen alvast") : t("Bevestig") };
  }
  const l = st.laatste;
  return { tekst: l ? t("Quiz · vorige keer {score} van {total}", { score: l.score, total: l.total }) : t("Quiz · eerste poging"), href: "#/quiz/" + u.id, knop: t("Start quiz") };
}
/* ==== notities ==== */
const notities = () => (S.settings && S.settings.notities) || {};
const notitieVan = ref => notities()[ref] || null;
async function bewaarNotitie(ref, tekst, titel) {
  const alles = { ...notities() };
  const schoon = String(tekst || "").trim();
  if (schoon) alles[ref] = { tekst: schoon, titel: titel || (alles[ref] && alles[ref].titel) || "", ts: Date.now() };
  else delete alles[ref];
  await setSetting("notities", alles);
}
/* waar hoort een notitie bij, en hoe kom je er terug */
function notitieDoel(ref) {
  const n = notitieVan(ref) || {};
  if (/^U[0-9]{2}-P[0-9]{2}$/.test(ref)) {
    const u = S.unitById[ref.slice(0, 3)];
    const p = u && u.paginas.find(x => x.id === ref);
    return { titel: p ? p.titel : ref, href: u ? "#/blok/" + u.id + "/lezen/" + ref : "#/leren", soort: t("Leespagina") };
  }
  if (/^U[0-9]{2}-Q[0-9]{3,4}$/.test(ref)) {
    const q = S.qById[ref];
    return { titel: q ? q.stam : ref, href: q ? "#/blok/" + q.unit : "#/leren", soort: t("Vraag") };
  }
  return { titel: n.titel || t("Losse notitie"), href: "#/notities", soort: t("Los") };
}
function notitieKnop(ref, titel) {
  const n = notitieVan(ref);
  return `<button class="knop omlijnd notitieknop" data-actie="notitie-open" data-ref="${esc(ref)}" data-titel="${esc(titel || "")}">${I.notitie}${esc(n ? t("Notitie bewerken") : t("Notitie maken"))}</button>`;
}

/* ==== Dagelijks: de bouwstenen van Route ==== */

/* De dagketen van de laatste zeven dagen. Een dag telt als hij minstens een
   afgeronde sessie bevat, en de grens ligt op middernacht hier, niet in UTC.
   Afgeleid uit het logboek en nergens bewaard, net als alle voortgang. */
function weekKeten() {
  const soorten = new Set(["quiz", "herstel", "herhaling", "gemengd", "examen", "lezen"]);
  const dagen = new Set(S.attempts.filter(a => soorten.has(a.kind)).map(a => new Date(a.ts).toDateString()));
  const uit = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    uit.push({ d, gedaan: dagen.has(d.toDateString()), vandaag: i === 0 });
  }
  return uit;
}

/* Hoe lang een sessie ongeveer duurt: het eigen tempo als dat bekend is, en
   anders het tempo van het examen. Liever een eerlijke schatting dan geen. */
function geschatteMinuten(aantal) {
  const eigen = V.tempo(S.attempts.flatMap(a => a.answers || []));
  const sec = eigen && eigen.seconden ? eigen.seconden : V.EXAMENTEMPO;
  return Math.max(1, Math.round(aantal * sec / 60));
}

function weekketenHtml() {
  const keten = weekKeten();
  const streak = V.streak(S.attempts);
  const tegels = keten.map(k => {
    const kort = (isEngels() ? TDAGEN.en : TDAGEN.nl)[k.d.getDay()];
    const cls = k.gedaan ? "gedaan" : k.vandaag ? "nu" : "gemist";
    return `<span class="dag ${cls}">${esc(kort)}</span>`;
  }).join("");
  return `<div class="weekketen" aria-label="${esc(t("De laatste zeven dagen"))}">
    <div class="dagen">${tegels}</div>
    ${streak > 1 ? `<span class="opril">${esc(t("{n} op rij", { n: streak }))}</span>` : ""}</div>`;
}

/* De hoofdkaart: een blok, een knop, en een uitweg voor wie weinig tijd heeft. */
function sessieKaart() {
  const u = currentUnit();
  const act = volgendeActie(u);
  const pool = (S.pools[u.id] || []).length;
  const quiz = act.href.startsWith("#/quiz/");
  const aantal = quiz ? Math.min(u.quiz.lengte, pool) : u.paginas.length;
  const pogingen = S.states[u.id] ? S.states[u.id].pogingen : 0;
  const ronde = [t("eerste ronde"), t("tweede ronde"), t("derde ronde")][Math.min(pogingen, 2)];
  const sub = quiz
    ? t("{n} vragen · blok {b} van 16 · {ronde}", { n: aantal, b: u.volgorde, ronde })
    : t("{n} pagina's · blok {b} van 16", { n: aantal, b: u.volgorde });
  return `<section class="sessie">
    <div class="rij"><span class="wenkbrauw">${esc(t("VANDAAG"))}</span><span class="duur">${esc(quiz ? t("± {n} min", { n: geschatteMinuten(aantal) }) : t("lezen"))}</span></div>
    <h2 class="titel">${esc(u.titel)}</h2>
    <p class="sub">${esc(sub)}</p>
    <a class="startknop" href="${act.href}">${esc(quiz ? t("Begin") : act.knop)} <span aria-hidden="true">→</span></a>
    ${quiz && aantal > 5 ? `<p class="uitweg">${esc(t("Weinig tijd?"))} <a href="${act.href}?kort=5">${esc(t("Doe 5 vragen"))}</a></p>` : ""}
  </section>`;
}

function tellerKaarten() {
  const set = S.boxes.size ? SRS.dailySet(S.boxes, S.qById) : { vragen: [], aantalDue: 0 };
  const fouten = V.foutenlog(S.attempts, S.history, S.qById);
  const kaart = (n, titel, hint, href) => `<a class="teller kaart klik" href="${href}"><span class="cijfer">${n}</span><span class="naam">${esc(titel)}</span><span class="hint">${esc(hint)}</span></a>`;
  return `<div class="tellers">
    ${kaart(set.vragen.length, t("Herhaling"), t("vandaag aan de beurt"), "#/herhaling")}
    ${kaart(fouten.length, t("Fouten"), t("nog niet rechtgezet"), "#/fouten")}
  </div>`;
}

/* De zestien blokken als raster: een blik op waar je staat, en elke tegel is
   een deur naar dat blok. */
function blokkenStrip() {
  const beheerst = S.units.filter(u => S.states[u.id] && S.states[u.id].staat === "beheerst").length;
  const tegels = S.units.map(u => {
    const st = S.states[u.id] ? S.states[u.id].staat : "vergrendeld";
    const cls = st === "beheerst" ? "beheerst" : st === "voorlopig" || st === "oefenen" ? "oefenen" : st === "vergrendeld" ? "dicht" : "lezen";
    return `<a class="bloktegel ${cls}" href="#/blok/${u.id}" aria-label="${esc(t("Blok {n} · {titel}", { n: u.volgorde, titel: u.titel }))}">${String(u.volgorde).padStart(2, "0")}</a>`;
  }).join("");
  return `<section class="blokstrip">
    <div class="rij"><span class="wenkbrauw donker">${esc(t("16 BLOKKEN"))}</span><span class="meta">${esc(t("{n} beheerst", { n: beheerst }))}</span></div>
    <div class="raster">${tegels}</div>
  </section>`;
}

/* De oorzaak die je het laatst bij deze vraag koos. Een fout uit een examen
   heeft er geen, want daar wordt niets gevraagd zolang de klok loopt. */
function laatsteOorzaak(qid) {
  for (let i = S.attempts.length - 1; i >= 0; i -= 1) {
    for (const x of S.attempts[i].answers || []) {
      if (x.q === qid && (!x.goed || x.twijfel) && x.fouttype) return x.fouttype;
    }
  }
  return null;
}
const OORZAKEN = [
  { id: "verkeerd_gelezen", naam: "Verkeerd gelezen", hint: "je wist het, je las het mis" },
  { id: "verkeerd_toegepast", naam: "Verkeerd toegepast", hint: "de regel klopte, de situatie niet" },
  { id: "niet_geweten", naam: "Niet geweten", hint: "hier moet de pagina weer open" },
  { id: "gegokt", naam: "Gegokt", hint: "geraden en misgegokt" },
];

/* De borden die jij verwisselt: een paar uit de nearMiss-lijst waarvan er
   minstens een in je foutenlijst staat. Staat er niets in je foutenlijst, dan
   toont hij het paar dat het vaakst door iedereen verwisseld wordt, en dat is
   gewoon het eerste paar van het manifest. */
function verwarparen() {
  const fout = new Set(V.foutenlog(S.attempts, S.history, S.qById)
    .map(r => S.qById[r.id])
    .filter(Boolean)
    .flatMap(q => [q.media && q.media.bord, ...(q.tags || []).filter(x => x.startsWith("bord-")).map(x => x.slice(5).toUpperCase())])
    .filter(Boolean));
  const paren = [];
  for (const b of allSigns()) {
    if (!hasSymbol(b.code)) continue;
    for (const c of b.nearMiss || []) {
      if (!hasSymbol(c) || b.code > c) continue;
      const raak = fout.has(b.code) || fout.has(c);
      paren.push({ a: b, b: sign(c), raak });
    }
  }
  const mijn = paren.filter(p => p.raak && p.b);
  return (mijn.length ? mijn : paren.filter(p => p.b)).slice(0, 2);
}
function verwarkaart() {
  const paren = verwarparen();
  if (!paren.length) return "";
  return `<div class="verwarkaart">
    <p class="wenkbrauw">${esc(t("DEZE HAAL JE DOOR ELKAAR"))}</p>
    ${paren.map(p => `<div class="paar">
      <button type="button" data-actie="bekijk-bord" data-code="${esc(p.a.code)}">${bordHtml(p.a.code, 40)}</button>
      <span class="vs">vs</span>
      <button type="button" data-actie="bekijk-bord" data-code="${esc(p.b.code)}">${bordHtml(p.b.code, 40)}</button>
      <span class="verschil">${esc(p.a.code)}: ${esc(p.a.betekenis)}<br>${esc(p.b.code)}: ${esc(p.b.betekenis)}</span>
    </div>`).join("")}
  </div>`;
}

const SCREENS = {
  route() {
    const u = currentUnit();
    const st = S.states[u.id];
    const act = volgendeActie(u);
    const vd = V.vandaag(S.attempts);
    const fouten = V.foutenlog(S.attempts, S.history, S.qById);
    const streak = V.streak(S.attempts);
    const kop = laatsteWeek()
      ? laatsteWeekKaart()
      : `<p class="meta">${esc(t("Verder waar je was"))}</p>
      <div class="kaart"><div class="rij"><div class="groei"><span class="bloknr">${u.volgorde}</span><strong>${esc(u.titel)}</strong><br><span class="meta">${esc(act.tekst)}</span></div></div>
        <a class="knop primair groot" style="margin-top:12px" href="${act.href}">${esc(act.knop)}<span class="pijl">${I.pijl}</span></a></div>`;
    const body = `<div class="routeraster">
      <div class="hoofd">
        ${laatsteWeek() ? laatsteWeekKaart() : sessieKaart()}
        ${tellerKaarten()}
        ${blokkenStrip()}
      </div>
      <aside class="zij">
        ${weekketenHtml()}
        ${examenklaarKaart()}
        <p class="meta-3 vandaagregel">${esc(t("Vandaag {vragen} vragen, {minuten} min", { vragen: vd.vragen, minuten: vd.minuten }))}</p>
        <a class="kaart klik" href="#/notities"><div class="rij"><span class="groei">${esc(t("Notities"))}</span><span class="cijfer cijfer-klein">${Object.keys(notities()).length}</span>${I.pijl}</div></a>
      </aside>
    </div>`;
    return { titel: t("Route"), body, onder: "tab", baan: false };
  },
  leren() {
    /* De gemengde quiz staat bovenaan Leren en niet bij een blok, want hij
       hoort juist bij geen enkel blok. Onder de twee vrijgespeelde blokken
       heeft door elkaar oefenen nog niets om door elkaar te halen. */
    const open = S.units.filter(u => S.states[u.id] && S.states[u.id].quizOpen);
    const gedaan = S.attempts.filter(a => a.kind === "gemengd").length;
    const gemengd = open.length < 2 ? "" : `<a class="kaart klik gemengdkaart" href="#/quiz/gemengd/gemengd"><div class="rij"><span class="groei"><strong>${esc(t("Door elkaar oefenen"))}</strong><br><span class="meta">${esc(t("12 vragen uit je {n} vrijgespeelde blokken door elkaar", { n: open.length }))}${gedaan ? esc(t(" · {n} keer gedaan", { n: gedaan })) : ""}</span></span>${I.pijl}</div></a>`;
    const woorden = `<a class="kaart klik" href="#/begrippen"><div class="rij"><div class="groei"><strong>${esc(t("Begrippen"))}</strong><br><span class="meta">${esc(t("Alle woorden uit het boek, met beeld"))}</span></div>${I.pijl}</div></a>`;
    const body = `<h1 class="kop1">${esc(t("Leren"))}</h1>${woorden}<p class="meta" style="margin-bottom:16px">${esc(t("Zestien blokken in leervolgorde. Een blok is gehaald na twee foutloze quizzen."))}</p>${gemengd}` + S.units.map(u => {
      const st = S.states[u.id];
      const n = (S.bank[u.id] || []).length;
      const label = st.staat === "beheerst" ? `<span class="staatlabel goed">${esc(t("Gehaald"))}</span>` : st.staat === "voorlopig" ? `<span class="staatlabel geel">${esc(t("Voorlopig gehaald"))}</span>` : st.staat === "vergrendeld" ? `<span class="staatlabel">${esc(t("Vergrendeld"))}</span>` : (st.staat === "lezen" || !u.quiz.gate) ? `<span class="staatlabel blauw">${esc(t("Lezen"))}</span>` : `<span class="staatlabel blauw">${esc(t("Oefenen"))}</span>`;
      return `<a class="kaart klik" href="#/blok/${u.id}"><div class="rij"><span class="paaltje ${st.staat === "beheerst" ? "groen" : st.staat === "voorlopig" ? "half" : ""}"></span><div class="groei"><span class="bloknr">${u.volgorde}</span><strong>${esc(u.titel)}</strong><br><span class="meta">${n ? esc(t("{n} vragen · ", { n })) : ""}${esc(t("week {n}", { n: u.week }))}</span></div>${label}</div></a>`;
    }).join("");
    return { titel: t("Leren"), body, onder: "tab" };
  },
  blok() {
    const u = S.unitById[S.route.unit];
    if (!u) return SCREENS.route();
    const st = S.states[u.id];
    const pool = S.pools[u.id] || [];
    const gelezen = new Set(S.attempts.filter(a => a.kind === "lezen").map(a => a.ref));
    const stats = V.unitStats(S.attempts, u.id);
    const staat = t({ vergrendeld: "Vergrendeld", lezen: "Lezen", oefenen: u.quiz.gate ? "Oefenen" : "Lezen", voorlopig: "Voorlopig gehaald", beheerst: "Gehaald" }[st.staat]);
    const paginas = u.paginas.map((p, i) => `<a class="kaart klik" href="#/blok/${u.id}/lezen/${p.id}"><div class="rij"><span class="nr meta-3">${i + 1}</span><span class="groei">${esc(p.titel)}</span>${gelezen.has(p.id) ? `<span class="staatlabel goed">${I.vink}</span>` : ""}</div></a>`).join("");
    const bordenRij = u.borden.length ? `<h2 class="kop2">${esc(t("Borden in dit blok"))}</h2><div class="bordrij">${u.borden.filter(hasSymbol).slice(0, 24).map(c => `<figure><button type="button" data-actie="bekijk-bord" data-code="${esc(c)}">${bordHtml(c, 64)}</button><figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>` : "";
    let quizTekst;
    if (!u.quiz.gate) quizTekst = t("Dit blok heeft geen quiz. Lees de pagina en rond af.");
    else if (st.staat === "vergrendeld") quizTekst = t("De quiz opent als het vorige blok gehaald is.");
    else if (st.staat === "lezen") quizTekst = t("Je kunt alvast lezen. De quiz opent als het vorige blok gehaald is.");
    else if (pool.length < u.quiz.lengte) quizTekst = t("De vragen voor dit blok worden nog geschreven ({n} van {van}).", { n: pool.length, van: u.quiz.lengte });
    else quizTekst = t("{lengte} vragen per quiz uit een pool van {pool}.", { lengte: u.quiz.lengte, pool: pool.length }) + (st.pogingen ? t(" {n} pogingen tot nu toe.", { n: st.pogingen }) : "");
    const body = `<p class="meta">${esc(t("Blok {n} · week {week}", { n: u.volgorde, week: u.week }))}</p><h1 class="kop1">${esc(u.titel)}</h1>
      <p class="lees">${esc(u.intro)}</p>
      <div class="kaart"><div class="rij"><span class="paaltje ${st.staat === "beheerst" ? "groen" : st.staat === "voorlopig" ? "half" : ""}"></span><div class="groei"><strong>${staat}</strong><br><span class="meta">${esc(quizTekst)}</span></div></div>
        ${stats.pogingen || stats.minuten ? `<p class="meta-3" style="margin:8px 0 0">${esc(t("{vragen} vragen beantwoord · {minuten} min in dit blok", { vragen: stats.vragen, minuten: stats.minuten }))}</p>` : ""}
        ${tempoRegel(stats.tempo)}</div>
      <h2 class="kop2">${esc(t("Lezen"))}</h2>${paginas}${bordenRij}`;
    const act = volgendeActie(u);
    const onder = `<a class="knop primair groot" href="${act.href}">${esc(act.knop)}<span class="pijl">${I.pijl}</span></a>`;
    return { titel: u.titel, terug: "#/leren", midden: esc(t("Blok {n}", { n: u.volgorde })), body, onder };
  },
  lezen() {
    const u = S.unitById[S.route.unit];
    if (!u) return SCREENS.route();
    const i = Math.max(0, u.paginas.findIndex(p => p.id === S.route.pagina));
    const p = u.paginas[i];
    const st = S.states[u.id];
    const laatste = i === u.paginas.length - 1;
    const body = `<div class="segment"><a class="actief" href="#/blok/${u.id}/lezen/${p.id}">${esc(t("Lezen"))}</a><a href="${st.quizOpen ? "#/quiz/" + u.id : "#/blok/" + u.id}">${esc(t("Quiz"))}${st.staat === "beheerst" ? " " + I.vink : ""}</a></div>
      <p class="meta-3">${esc(t("Pagina {i} van {n}", { i: i + 1, n: u.paginas.length }))}</p>${isEngels() && p.vertaald === false ? `<p class="meta">${esc(t("Deze pagina is nog niet vertaald. Je leest hem in het Nederlands."))}</p>` : ""}${pageHtml(u, p)}<div class="rij notitierij">${notitieKnop(p.id, p.titel)}</div>`;
    let onder;
    if (!laatste) onder = `<div class="rij">${i > 0 ? `<a class="knop omlijnd" href="#/blok/${u.id}/lezen/${u.paginas[i - 1].id}" aria-label="${esc(t("Vorige pagina"))}">${I.terug}</a>` : ""}<a class="knop primair groot" href="#/blok/${u.id}/lezen/${u.paginas[i + 1].id}">${esc(t("Volgende pagina"))}<span class="pijl">${I.pijl}</span></a></div>`;
    else if (!u.quiz.gate) onder = `<div class="rij">${i > 0 ? `<a class="knop omlijnd" href="#/blok/${u.id}/lezen/${u.paginas[i - 1].id}" aria-label="${esc(t("Vorige pagina"))}">${I.terug}</a>` : ""}<button class="knop primair groot" data-actie="klaar-lezen" data-unit="${u.id}">${esc(st.staat === "beheerst" ? t("Gelezen, terug naar route") : t("Klaar met lezen"))}<span class="pijl">${I.pijl}</span></button></div>`;
    else if (st.quizOpen && (S.pools[u.id] || []).length >= u.quiz.lengte) onder = `<div class="rij">${i > 0 ? `<a class="knop omlijnd" href="#/blok/${u.id}/lezen/${u.paginas[i - 1].id}" aria-label="${esc(t("Vorige pagina"))}">${I.terug}</a>` : ""}<a class="knop primair groot" href="#/quiz/${u.id}">${esc(t("Naar de quiz"))}<span class="pijl">${I.pijl}</span></a></div>`;
    else onder = `<div class="rij">${i > 0 ? `<a class="knop omlijnd" href="#/blok/${u.id}/lezen/${u.paginas[i - 1].id}" aria-label="${esc(t("Vorige pagina"))}">${I.terug}</a>` : ""}<a class="knop primair groot" href="#/blok/${u.id}">${esc(t("Terug naar het blok"))}<span class="pijl">${I.pijl}</span></a></div>`;
    return { titel: p.titel, terug: "#/blok/" + u.id, midden: esc(t("Blok {n} · {titel}", { n: u.volgorde, titel: u.titel })), body, onder };
  },
  examen() {
    const run = S.run;
    if (!run || !run.examen) return examenIntro();
    if (run.klaar) return examenUitslagScherm(run);
    if (run.overzicht) return examenOverzicht(run);
    return SCREENS.quiz();
  },
  quiz() {
    const run = S.run;
    const u = S.unitById[run && run.unit ? run.unit : S.route.unit];
    if (!run) return { titel: t("Quiz"), terug: "#/blok/" + S.route.unit, sluit: true, body: `<h1 class="kop1">${esc(t("Nog geen quiz"))}</h1><p class="lees">${esc(t("De vragen voor dit blok zijn er nog niet, of het blok is nog vergrendeld."))}</p>`, onder: `<a class="knop primair groot" href="#/blok/${S.route.unit}">${esc(t("Terug naar het blok"))}</a>` };
    if (run.klaar) return quizEinde(run, u);
    const item = Q.current(run);
    const q = item.q;
    const n = run.items.length;
    const dots = run.examen
      ? examenBalk(run)
      : `<div class="stipjes" aria-hidden="true">${run.items.map((it, i) => { const r = run.resultaten[i]; const c = r ? (r.goed && !r.twijfel ? "goed" : "fout") : i === run.i ? "nu" : ""; return `<span class="${c}"></span>`; }).join("")}</div>`;
    const toon = run.fase === "toon";
    const r = toon ? run.resultaten[run.resultaten.length - 1] : null;
    let media = "";
    if (q.media && q.media.lamp) media = `<div class="plaat beeldplaat ${toon ? "klein" : ""}">${lampHtml(q.media.lamp, toon ? 112 : 176)}</div>`;
    else if (q.media && q.media.bord) media = `<div class="plaat beeldplaat ${toon ? "klein" : ""}"><button type="button" data-actie="bekijk-bord" data-code="${esc(q.media.bord)}" aria-label="${esc(t("Bord vergroten"))}">${bordHtml(q.media.bord, toon ? 112 : 176)}</button></div>`;
    else if (q.media && q.media.scene) { const sc = S.scenes[q.media.scene]; media = sc ? scenePlate(sc, toon) : `<div class="plaat scene-placeholder">${esc(t("Tekening {ref} ontbreekt", { ref: q.media.scene }))}</div>`; }
    else if (q.media && q.media.reeks) {
      const frames = q.media.reeks.map(id => S.scenes[id]).filter(Boolean);
      const f = Math.min(item.frame, frames.length - 1);
      /* In een examen krijg je het beeld net als bij het CBR: het speelt zichzelf
         af en je kunt niet beeldje voor beeldje terug. Zodra het antwoord op
         tafel ligt mag je wel terugbladeren, want dan ben je aan het leren. */
      const stappen = !(run.examen && !toon);
      const stipjes = `<span class="stipjes" aria-hidden="true">${frames.map((x, i) => `<span class="${i === f ? "nu" : ""}"></span>`).join("")}</span>`;
      const stapper = stappen
        ? `<div class="stapper"><button type="button" data-actie="frame" data-n="-1" ${f === 0 ? "disabled" : ""} aria-label="${esc(t("Vorig beeld"))}">${I.terug}</button>${stipjes}<button type="button" data-actie="frame" data-n="1" ${f >= frames.length - 1 ? "disabled" : ""} aria-label="${esc(t("Volgend beeld"))}">${I.pijl}</button><button type="button" data-actie="speel">${esc(t("Speel af"))}</button></div>`
        : `<div class="stapper alleen-stipjes">${stipjes}</div>`;
      media = frames.length ? `<div class="reeks">${scenePlate(frames[f], toon)}${stapper}</div>` : "";
    }
    let opties;
    if (q.type === "hotspot" && q.media && q.media.lampen) {
      opties = `<div class="bordraster lampraster" role="radiogroup" aria-label="${esc(t("Kies een lampje"))}">${item.grid.map(id => {
        const gekozen = run.gekozen.includes(id);
        let cls = gekozen ? "gekozen" : "";
        if (toon) cls = q.correct.includes(id) ? "goed" : gekozen ? "fout" : "dim";
        return `<button type="button" class="bordtegel ${cls}" role="radio" aria-checked="${gekozen}" data-actie="kies" data-id="${esc(id)}" ${toon ? "disabled" : ""}>${lampHtml(id, 112)}</button>`;
      }).join("")}</div>`;
    } else if (q.type === "hotspot") {
      opties = `<div class="bordraster" role="radiogroup" aria-label="${esc(t("Kies een bord"))}">${item.grid.map(code => {
        const gekozen = run.gekozen.includes(code);
        let cls = gekozen ? "gekozen" : "";
        if (toon) cls = q.correct.includes(code) ? "goed" : gekozen ? "fout" : "dim";
        return `<button type="button" class="bordtegel ${cls}" role="radio" aria-checked="${gekozen}" data-actie="kies" data-id="${esc(code)}" ${toon ? "disabled" : ""}>${bordHtml(code, 112)}<span class="bordcode">${esc(code)}</span></button>`;
      }).join("")}</div>`;
    } else if (q.type === "volgorde") {
      opties = `<div class="opties" role="group" aria-label="${esc(t("Zet in volgorde"))}">${item.opties.map(o => {
        const pos = run.gekozen.indexOf(o.id);
        const juist = q.correct.indexOf(o.id);
        let cls = pos >= 0 ? "gekozen" : "", extra = "";
        if (toon) { if (pos === juist) cls = "goed"; else { cls = "fout"; extra = `<span class="stempel goedcijfer" aria-label="${esc(t("goede plaats {n}", { n: juist + 1 }))}">${juist + 1}</span>`; } }
        return `<button type="button" class="optie ${cls}" data-actie="kies" data-id="${esc(o.id)}" ${toon ? "disabled" : ""}><span class="stempel ${pos < 0 ? "leeg" : ""} ${toon ? (pos === juist ? "goedcijfer" : "foutcijfer") : ""}">${pos >= 0 ? pos + 1 : ""}</span><span class="tekst">${esc(o.tekst)}</span>${extra}</button>`;
      }).join("")}</div>`;
    } else if (q.type === "invul") {
      const getikt = run.gekozen[0] || "";
      const goed = Q.isCorrect(q, run.gekozen);
      opties = `<div class="invulveld">
        <input type="text" inputmode="decimal" autocomplete="off" class="getal ${toon ? (goed ? "goed" : "fout") : ""}" value="${esc(getikt)}" data-actie="invul" ${toon ? "disabled" : ""} aria-label="${esc(t("Vul het getal in"))}">
        <span class="eenheid">${esc(q.correct.eenheid)}</span>
      </div>`;
    } else {
      const role = q.type === "meervoudig" ? "checkbox" : "radio";
      const letters = "ABCDEF";
      opties = `<div class="opties ${q.type === "ja_nee" ? "janee" : ""}" role="${q.type === "meervoudig" ? "group" : "radiogroup"}">${item.opties.map((o, i) => {
        const gekozen = run.gekozen.includes(o.id);
        const juist = q.correct.includes(o.id);
        let cls = gekozen ? "gekozen" : "", noot = "";
        if (toon) {
          if (juist && gekozen) cls = "goed";
          else if (juist && !gekozen) { cls = "gemist"; noot = q.type === "meervoudig" ? t("Ook goed") : ""; }
          else if (!juist && gekozen) { cls = "fout"; noot = t("jouw antwoord"); }
          else cls = "dim";
          if (!juist && gekozen && o.feedback) noot = o.feedback.replace(/^Fout[.,:]?\s*/i, "");
          if (juist && !gekozen && q.type !== "meervoudig") noot = t("het goede antwoord");
        }
        return `<button type="button" class="optie ${cls}" role="${role}" aria-checked="${gekozen}" data-actie="kies" data-id="${esc(o.id)}" ${toon ? "disabled" : ""}><span class="letter" aria-hidden="true">${toon && cls === "goed" ? I.vink : toon && cls === "fout" ? I.kruis : letters[i]}</span><span class="tekst">${esc(o.tekst)}${noot ? `<span class="noot">${esc(noot)}</span>` : ""}</span></button>`;
      }).join("")}</div>`;
    }
    const hint = q.type === "invul" ? `<p class="meta">${esc(t("Vul het getal in, in {eenheid}. Een komma mag.", { eenheid: q.correct.eenheid }))}</p>` : q.type === "meervoudig" ? `<p class="meta">${esc(t("Kies er {n}.", { n: q.correct.length }))}</p>` : q.type === "hotspot" ? `<p class="meta">${esc(t("Tik op het bord."))}</p>` : q.type === "volgorde" ? `<p class="meta">${esc(t("Tik in de volgorde waarin ze mogen gaan. Nog een keer tikken wist het nummer."))}</p>` : "";
    let uitleg = "";
    if (toon) {
      const goedOptie = q.opties.find(o => q.correct.includes(o.id));
      const u2 = q.uitleg;
      /* In een gemengde ronde komt elke vraag uit een ander blok, dus de
       leespagina hangt aan de vraag en niet aan de ronde. */
    const uv = S.unitById[q.unit] || u;
    const pagina = uv ? uv.paginas.find(p => p.id === q.pagina) : null;
      const bron = q.bronnen.filter(b => !b.afgeleid).map(b => b.boek ? t("Boek p. {p}", { p: b.boek }) + (b.sectie ? " (§" + b.sectie + ")" : "") : t("SpeedTheorie slide {n}", { n: b.slide })).join(" · ");
      const ft = r.goed && !r.twijfel ? "" : `<div class="blokje"><span class="label">${esc(t("Wat ging er mis?"))}</span><div class="fouttypes">${[["niet_geweten", "Niet geweten"], ["verkeerd_gelezen", "Verkeerd gelezen"], ["verkeerd_toegepast", "Verkeerd toegepast"], ["gegokt", "Gegokt"]].map(([k, l]) => `<button type="button" class="${run.fouttype === k ? "actief" : ""}" data-actie="fouttype" data-type="${k}">${esc(t(l))}</button>`).join("")}</div><span class="meta-3">${esc(t("Komt terug aan het eind."))}</span></div>`;
      uitleg = B.markeer(`<section class="uitleg" aria-live="polite"><span class="staat ${r.goed && !r.twijfel ? "goed" : ""}">${esc(r.goed ? (r.twijfel ? t("Goed, maar getwijfeld") : t("Goed")) : t("Nog niet"))}</span>
        <h2 class="kop2">${esc(t("Waarom"))}</h2><p class="lees">${esc(u2.waarom)}</p>
        ${r && r.redenering ? `<div class="blokje lees jouwwoorden"><span class="label">${esc(t("Wat jij zei"))}</span>${esc(r.redenering)}</div>` : ""}<div class="blokje lees"><span class="label">${esc(t("Regel"))}</span>${esc(u2.regel)}</div>
        ${q.type === "volgorde" ? `<div class="blokje lees"><span class="label">${esc(t("De juiste volgorde"))}</span><ol class="lijst" style="margin:4px 0 0">${q.correct.map(id => { const o = q.opties.find(x => x.id === id); return `<li><strong>${esc(o ? o.tekst : id)}</strong>${o && o.feedback ? `<span class="meta" style="display:block">${esc(o.feedback.replace(VOORVOEGSEL, ""))}</span>` : ""}</li>`; }).join("")}</ol></div>` : q.type === "invul" ? `<div class="blokje lees"><span class="label">${esc(t("Het goede antwoord"))}</span>${esc(String(q.correct.getal).replace(".", ","))} ${esc(q.correct.eenheid)}</div>` : q.type !== "hotspot" && goedOptie ? `<div class="blokje lees"><span class="label">${esc(t("Het goede antwoord"))}</span>${esc(goedOptie.feedback.replace(VOORVOEGSEL, ""))}</div>` : ""}
        <div class="blokje lees"><span class="label">${esc(t("Valkuil"))}</span>${esc(u2.valkuil)}</div>
        ${u2.onthoud ? `<div class="onthoud"><span class="label">${esc(t("Onthoud"))}</span>${esc(u2.onthoud)}</div>` : ""}
        ${ft}
        <p class="meta-3" style="margin:8px 0 0">${esc(bron)}${pagina && uv ? ` · <a href="#/blok/${uv.id}/lezen/${pagina.id}">${esc(t("Lees {pagina} opnieuw", { pagina: kortePaginanaam(pagina) }))}</a>` : ""}</p>
        <button class="knop tekstknop" style="min-height:36px;padding:0" data-actie="meld-fout" data-q="${esc(q.id)}">${esc(S.gemeld.has(q.id) ? t("Gemeld") : t("Klopt deze vraag niet?"))}</button><div class="rij notitierij">${notitieKnop(q.id, q.stam)}</div></section>`, new Set());
    }
    /* Zelf de regel benoemen voordat je hem leest werkt, maar het kost ook een
       handeling per vraag. Daarom alleen waar je toch al weet dat je zwak staat:
       bij het oefenen van je fouten en bij de gemengde ronde. */
    const redeneer = (!toon && (run.ref === "fouten" || run.soort === "gemengd"))
      ? `<label class="redeneer"><span class="meta-3">${esc(t("Welke regel geldt hier? Zeg het eerst zelf."))}</span><input id="redeneerveld" type="text" autocomplete="off" placeholder="${esc(t("In je eigen woorden, mag kort"))}" value="${esc(run.redenering || "")}" data-actie="redeneer"></label>`
      : "";
    const body = `${dots}${media}<p class="vraagtekst">${esc(q.stam)}</p>${hint}${opties}${redeneer}${uitleg}`;
    const onder = toon
      ? `<button class="knop primair groot" data-actie="volgende">${esc(run.i + 1 >= n ? t("Naar de uitslag") : t("Volgende"))}<span class="pijl">${I.pijl}</span></button>`
      : run.examen
        ? `<button type="button" class="vlagrij ${run.gemarkeerd.includes(q0(run).id) ? "aan" : ""}" data-actie="examen-markeer"><span class="wimpel" aria-hidden="true"></span>${esc(run.gemarkeerd.includes(q0(run).id) ? t("Gevlagd, tik om weg te halen") : t("Vlag deze vraag"))}</button>
          <div class="rij"><button class="knop omlijnd" data-actie="examen-ga" data-n="${run.i - 1}" ${run.i === 0 ? "disabled" : ""} aria-label="${esc(t("Vorige vraag"))}">${I.terug}</button><button class="knop primair groot" data-actie="examen-ga" data-n="${run.i + 1}">${esc(run.i + 1 >= n ? t("Naar het overzicht") : t("Volgende"))}<span class="pijl">${I.pijl}</span></button></div>`
        : `<div class="rij"><label class="twijfel"><input type="checkbox" data-actie="twijfel" ${run.twijfel ? "checked" : ""}> ${esc(t("Twijfel"))}</label><button class="knop primair groot" data-actie="controleer" ${Q.ready(run) ? "" : "disabled"}>${esc(t("Controleer"))}</button></div>`;
    const naam = run.examen ? t("Oefenexamen") : run.soort === "quiz" ? t("Quiz") : run.soort === "herhaling" ? t("Herhaling") : run.soort === "gemengd" ? t("Door elkaar") : run.ref === "fouten" ? t("Fouten oefenen") : t("Herstelronde");
    /* In een quiz mag je van taal wisselen, want dat is alleen een ander woord
       voor dezelfde vraag. In een examen niet: daar loopt een klok, en de
       eerste keer overschakelen haalt nog bestanden op. */
    return { titel: naam, terug: run.examen ? "#/examen" : u ? "#/blok/" + u.id : "#/route", sluit: true, midden: esc(t("{naam} · vraag {i} van {n}", { naam, i: run.i + 1, n })), body, onder, baan: !run.examen, kop: !run.examen, taal: false };
  },
  gehaald() {
    const u = S.unitById[S.route.unit];
    if (!u) return SCREENS.route();
    const stats = V.unitStats(S.attempts, u.id);
    const volgende = S.units.find(x => x.volgorde === u.volgorde + 1);
    const lastig = {};
    for (const a of S.attempts) for (const x of a.answers || []) if (x.unit === u.id && !x.goed) lastig[x.pagina] = (lastig[x.pagina] || 0) + 1;
    const rows = Object.entries(lastig).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([pid, n]) => { const p = u.paginas.find(x => x.id === pid); return `<div class="rij" style="padding:4px 0"><span class="groei">${esc(p ? p.titel : pid)}</span><span class="meta">${n}x</span></div>`; }).join("");
    const body = `<span class="paaltje groot groen" aria-hidden="true"></span>
      <h1 class="kop1" style="text-align:center">${esc(t("Blok {n} gehaald", { n: u.volgorde }))}</h1><p class="meta" style="text-align:center">${esc(u.titel)}</p>
      <div class="feiten"><div><span class="cijfer">${stats.vragen}</span><span class="meta">${esc(t("vragen"))}</span></div><div><span class="cijfer">${stats.pogingen}</span><span class="meta">${esc(t("pogingen"))}</span></div><div><span class="cijfer">${stats.minuten}</span><span class="meta">${esc(t("minuten"))}</span></div></div>
      ${rows ? `<h3 class="kop3">${esc(t("Wat je lastig vond"))}</h3>${rows}<p class="meta-3">${esc(t("Deze staan in je foutenlijst."))}</p>` : ""}
      ${volgende ? `<h3 class="kop3">${esc(t("Volgende"))}</h3><p><span class="bloknr">${volgende.volgorde}</span><strong>${esc(volgende.titel)}</strong><br><span class="staatlabel goed">${esc(t("Ontgrendeld"))}</span></p>` : ""}`;
    const onder = volgende ? `<a class="knop primair groot" href="#/blok/${volgende.id}">${esc(t("Verder naar blok {n}", { n: volgende.volgorde }))}<span class="pijl">${I.pijl}</span></a><a class="knop tekstknop" href="#/route">${esc(t("Terug naar route"))}</a>` : `<a class="knop primair groot" href="#/route">${esc(t("Terug naar route"))}</a>`;
    return { titel: t("Gehaald"), body, onder, chip: true };
  },
  borden() {
    const fams = families();
    const zoek = (S.bordzoek || "").trim().toLowerCase();
    /* Zoeken gaat door alle families heen: wie "haaientanden" typt weet niet
       in welke familie dat bord zit, en dat hoeft ook niet. */
    const alle = allSigns().filter(b => !b.zonderCode && hasSymbol(b.code));
    const fam = zoek ? null : (S.route.familie || S.familie || fams[0].letter);
    if (fam) S.familie = fam;
    const list = zoek
      ? alle.filter(b => (b.code + " " + b.betekenis + " " + (b.omschrijving || "")).toLowerCase().includes(zoek))
      : alle.filter(b => b.familie === fam);

    const chips = `<div class="chips bordchips">${fams.map(f => `<a href="#/borden/${f.letter}" class="${f.letter === fam ? "actief" : ""}">${f.letter} ${esc(t(f.naam))}</a>`).join("")}</div>`;
    const veld = `<input class="zoekveld" type="search" inputmode="search" autocomplete="off" value="${esc(S.bordzoek || "")}"
      data-actie="bordzoek" placeholder="${esc(t("Zoek op code of betekenis"))}" aria-label="${esc(t("Zoek op code of betekenis"))}">`;

    const rijen = list.map(b => `<button type="button" class="bordrij2" data-actie="bekijk-bord" data-code="${esc(b.code)}">
      ${bordHtml(b.code, 40)}
      <span class="tekst"><span class="code">${esc(b.code)}</span><span class="betekenis">${esc(b.betekenis)}</span></span></button>`).join("");

    const body = `<h1 class="kop1">${esc(t("Borden"))}</h1>
      ${veld}
      ${zoek ? "" : chips}
      ${zoek ? `<p class="meta">${esc(t("{n} borden gevonden", { n: list.length }))}</p>` : verwarkaart()}
      ${zoek || !fam ? "" : `<h2 class="kop2" style="margin-top:8px">${fam} ${esc(t(familyName(fam)))}</h2>`}
      <div class="bordlijst">${rijen}</div>`;
    return { titel: t("Borden"), body, onder: "tab" };
  },
  bord() {
    const code = S.route.code;
    const b = sign(code);
    if (!b) return SCREENS.borden();
    const near = (b.nearMiss || []).filter(hasSymbol);
    const body = `<div class="plaat beeldplaat"><button type="button" data-actie="bekijk-bord" data-code="${esc(code)}">${bordHtml(code, 176)}</button></div>
      <p class="bordcode">${esc(code)} · ${esc(t(familyName(b.familie)))}</p><h1 class="kop1">${esc(b.betekenis)}</h1><p class="lees meta">${esc(b.omschrijving)}</p>
      ${near.length ? `<h2 class="kop2">${esc(t("Niet verwarren met"))}</h2><div class="bordrij">${near.map(c => `<figure><a href="#/borden/${encodeURIComponent(c)}">${bordHtml(c, 64)}</a><figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>` : ""}
      <p class="bronregel">${esc(t("Boek p. {p}", { p: b.bron ? b.bron.boek : "" }))}</p>`;
    return { titel: code, terug: "#/borden/" + b.familie, midden: esc(t("Bord")), body, onder: "tab" };
  },
  /* 2e uit het ontwerp: de bakken zichtbaar maken, en laten zien dat de
     stapel altijd te doen is. */
  herhaling() {
    const bx = S.boxes;
    const set = bx.size ? SRS.dailySet(bx, S.qById) : { vragen: [], aantalDue: 0 };
    const nu = Date.now();
    const bakken = [1, 2, 3, 4, 5].map(b => {
      const alle = [...bx.entries()].filter(([, v]) => v.box === b);
      return { b, dagen: SRS.INTERVAL[b], n: alle.length, due: alle.filter(([, v]) => v.due <= nu).length };
    });
    const hoogste = Math.max(1, ...bakken.map(x => x.n));
    const staven = bakken.map(x => `<div class="bak">
      <span class="cijfer">${x.n}</span>
      <span class="staaf ${x.due ? "due" : ""}" style="height:${Math.round(28 + 76 * x.n / hoogste)}px"></span>
      <span class="bij">${esc(x.dagen === 1 ? t("1 dag") : t("{n} dagen", { n: x.dagen }))}</span>
    </div>`).join("");

    /* wat er vandaag uit komt, gegroepeerd op blok */
    const perUnit = {};
    for (const id of set.vragen) { const q = S.qById[id]; if (!q) continue; (perUnit[q.unit] = perUnit[q.unit] || []).push(id); }
    const rijen = S.units.filter(u => perUnit[u.id]).map(u => `<div class="kaart herhaalrij"><div class="rij">
      <span class="code">${String(u.volgorde).padStart(2, "0")}</span>
      <span class="groei">${esc(u.titel)}</span>
      <span class="cijfer cijfer-klein">${perUnit[u.id].length}</span></div></div>`).join("");

    const blokken = S.units.filter(u => perUnit[u.id]).map(u => String(u.volgorde).padStart(2, "0"));
    const body = `<p class="wenkbrauw donker">${esc(t("HERHALING"))}</p>
      <h1 class="kop1">${esc(t("{n} vragen aan de beurt", { n: set.vragen.length }))}</h1>
      <p class="meta" style="margin-bottom:16px">${blokken.length ? esc(t("Uit blok {lijst} · ± {min} min", { lijst: blokken.join(", "), min: geschatteMinuten(set.vragen.length) })) : esc(t("Er staat nog niets klaar. Een blok komt in de bakken zodra je het gehaald hebt."))}</p>
      ${bx.size ? `<div class="kaart bakkenkaart">
        <p class="wenkbrauw donker">${esc(t("DE BAKKEN"))}</p>
        <div class="bakken">${staven}</div>
        <p class="meta-3">${esc(t("Goed antwoord schuift een vraag naar de volgende bak. Fout zet hem terug naar een dag."))}</p>
      </div>` : ""}
      ${rijen ? `<p class="wenkbrauw donker">${esc(t("VANDAAG UIT"))}</p>${rijen}` : ""}
      ${bx.size ? `<p class="warmenoot">${esc(t("Er staan er {n} in de bakken. Je ziet er nooit meer dan {max} op een dag.", { n: bx.size, max: 20 }))}</p>` : ""}`;
    const onder = set.vragen.length ? `<a class="knop primair groot" href="#/quiz/herhaling/herhaling">${esc(t("Begin herhaling"))}<span class="pijl">${I.pijl}</span></a>` : "tab";
    return { titel: t("Herhaling"), body, onder, baan: false };
  },
  /* Alle begrippen op alfabet. Wie iets zoekt typt; wie bladert scrolt. */
  begrippen() {
    const zoek = (S.begripzoek || "").trim().toLowerCase();
    const alle = B.alle().slice().sort((a, b) => a.term.localeCompare(b.term, "nl"));
    const lijst = zoek
      ? alle.filter(b => (b.term + " " + (b.varianten || []).join(" ") + " " + b.uitleg + " " + (b.uitleg_en || "")).toLowerCase().includes(zoek))
      : alle;
    const veld = `<input class="zoekveld" type="search" inputmode="search" autocomplete="off" value="${esc(S.begripzoek || "")}"
      data-actie="begripzoek" placeholder="${esc(t("Zoek een woord"))}" aria-label="${esc(t("Zoek een woord"))}">`;
    const metBeeld = b => b.borden || b.bord || b.scene || b.diagram;
    const rijen = lijst.map(b => `<button type="button" class="begriprij" data-actie="begrip" data-term="${esc(b.term)}">
      <span class="tekst"><span class="term">${esc(hoofdletter(b.term))}</span><span class="uit">${esc(isEngels() && b.uitleg_en ? b.uitleg_en : b.uitleg)}</span></span>
      ${metBeeld(b) ? `<span class="beeldje" aria-hidden="true">${b.borden || b.bord ? bordHtml((b.borden || [b.bord])[0], 40) : I.beeld}</span>` : ""}
    </button>`).join("");
    const body = `<h1 class="kop1">${esc(t("Begrippen"))}</h1>
      <p class="meta" style="margin-bottom:12px">${esc(t("Alle woorden die het boek gebruikt, met een tekening of een bord waar dat helpt."))}</p>
      ${veld}
      <p class="meta-3">${esc(zoek ? t("{n} van de {van} woorden", { n: lijst.length, van: alle.length }) : t("{n} woorden, {beeld} met een beeld", { n: alle.length, beeld: alle.filter(metBeeld).length }))}</p>
      <div class="begriplijst">${rijen}</div>`;
    return { titel: t("Begrippen"), body, onder: "tab" };
  },
  fouten() {
    const rows = V.foutenlog(S.attempts, S.history, S.qById);
    const byUnit = {};
    for (const r of rows) (byUnit[r.unit] = byUnit[r.unit] || []).push(r);
    const groups = S.units.filter(u => byUnit[u.id]).map(u => `<h2 class="kop2">${esc(t("Blok {n} {titel}", { n: u.volgorde, titel: u.titel }))} <span class="meta-3" style="float:right">${byUnit[u.id].length}</span></h2>` + byUnit[u.id].map(r => { const p = u.paginas.find(x => x.id === r.pagina); return `<a class="kaart klik" href="#/blok/${u.id}/lezen/${r.pagina}"><div class="rij"><div class="groei">${esc(r.stam.length > 90 ? r.stam.slice(0, 87) + "..." : r.stam)}<br><span class="meta-3">${esc(p ? p.titel : "")}</span></div><span class="meta">${r.fout}x</span></div></a>`; }).join("")).join("");
    const types = { niet_geweten: 0, verkeerd_gelezen: 0, verkeerd_toegepast: 0, gegokt: 0 };
    for (const a of S.attempts) for (const x of a.answers || []) if ((!x.goed || x.twijfel) && x.fouttype && types[x.fouttype] !== undefined) types[x.fouttype] += 1;
    const totaal = Object.values(types).reduce((a, b) => a + b, 0);
    const taxonomie = totaal ? `<div class="feiten" style="margin:8px 0 16px">${[["niet_geweten", "niet geweten"], ["verkeerd_gelezen", "verkeerd gelezen"], ["verkeerd_toegepast", "verkeerd toegepast"], ["gegokt", "gegokt"]].map(([k, l]) => `<div><span class="cijfer cijfer-klein">${types[k]}</span><span class="meta">${esc(t(l))}</span></div>`).join("")}</div>` : "";
    /* Hoe goed schat je jezelf in. Je vinkte "Twijfel" al aan, de app deed er
       alleen nog niets mee behalve het meewegen in een foutloze ronde. */
    const k = V.kalibratie(S.attempts);
    const vak = (n, van, l, sub, cls) => `<div class="kalvak ${cls}"><span class="cijfer cijfer-klein">${n}</span><span class="meta">${esc(l)}</span><span class="meta-3">${esc(sub)}</span></div>`;
    const kalibratie = k.totaal < 20 ? "" : `<h2 class="kop2">${esc(t("Hoe goed schat je jezelf in"))}</h2>
      <div class="kalraster">
        ${vak(k.zekerGoed, k.totaal, t("zeker en goed"), t("zo hoort het"), "goed")}
        ${vak(k.zekerFout, k.totaal, t("zeker en fout"), t("hier let je niet op"), "gevaar")}
        ${vak(k.twijfelGoed, k.totaal, t("getwijfeld en goed"), t("je wist het wel"), "")}
        ${vak(k.twijfelFout, k.totaal, t("getwijfeld en fout"), t("terecht getwijfeld"), "")}
      </div>
      <p class="meta-3" style="margin:6px 0 16px">${esc(k.zekerFout === 0 ? t("Je twijfel klopt: als je zeker was, had je het ook goed.") : t("{n} van de {van} keer dat je zeker was, was het toch fout. Dat is het vakje dat je niet ziet aankomen.", { n: k.zekerFout, van: k.zekerGoed + k.zekerFout }))}</p>`;
    /* rechtgezet: vragen die ooit fout gingen en nu twee keer achter elkaar
       goed zijn, dus uit deze lijst verdwenen */
    let ooitFout = 0;
    for (const [, h] of S.history) if (h.fout > 0) ooitFout += 1;
    const rechtgezet = Math.max(0, ooitFout - rows.length);

    const metOorzaak = rows.map(r => ({ ...r, oorzaak: laatsteOorzaak(r.id) }));
    const zonder = metOorzaak.filter(r => !r.oorzaak).length;
    const open = S.foutgroep || (OORZAKEN.map(o => ({ o, n: metOorzaak.filter(r => r.oorzaak === o.id).length })).sort((a, b) => b.n - a.n)[0] || {}).o?.id;

    const oorzaakrijen = OORZAKEN.map(o => {
      const n = metOorzaak.filter(r => r.oorzaak === o.id).length;
      return `<button type="button" class="oorzaakrij ${o.id} ${n ? "" : "leeg"} ${open === o.id && n ? "open" : ""}" data-actie="foutgroep" data-oorzaak="${o.id}">
        <span class="groei"><strong>${esc(t(o.naam))}</strong><br><span class="meta-3">${esc(t(o.hint))}</span></span>
        <span class="cijfer cijfer-klein">${n}</span></button>`;
    }).join("");

    const groep = metOorzaak.filter(r => r.oorzaak === open);
    const gekozen = OORZAKEN.find(o => o.id === open);
    const uitgeklapt = !groep.length ? "" : `<p class="wenkbrauw donker">${esc(t(gekozen.naam).toUpperCase())} · ${groep.length}</p>` + groep.slice(0, 12).map(r => {
      const u = S.unitById[r.unit];
      const pg = u ? u.paginas.find(x => x.id === r.pagina) : null;
      return `<a class="kaart klik foutkaart" href="#/blok/${r.unit}/lezen/${r.pagina}">
        <p class="stam">${esc(r.stam.length > 120 ? r.stam.slice(0, 117) + "..." : r.stam)}</p>
        <p class="meta-3">${esc(t("Blok {n}", { n: u ? u.volgorde : "" }))} · ${esc(t("{n} keer fout", { n: r.fout }))}${pg ? " · " + esc(pg.titel) : ""}</p></a>`;
    }).join("");

    const body = `<h1 class="kop1">${esc(t("{open} open, {recht} rechtgezet", { open: rows.length, recht: rechtgezet }))}</h1>
      <p class="meta" style="margin-bottom:16px">${esc(t("Een fout is rechtgezet als je hem daarna twee keer goed had"))}</p>
      ${rows.length ? `<div class="oorzaken">${oorzaakrijen}</div>
      ${zonder ? `<p class="meta-3">${esc(t("{n} fouten hebben geen oorzaak, die komen uit een examen", { n: zonder }))}</p>` : ""}
      ${uitgeklapt}
      <p class="meta-3">${esc(t("Een vraag verdwijnt hier na twee keer achter elkaar goed."))}</p>${kalibratie}` : `<p class="lees">${esc(t("Nog geen fouten om te herhalen. Alles wat je fout doet komt hier terecht, met de uitleg erbij."))}</p>${kalibratie}`}`;
    const onder = rows.length ? `<button class="knop primair groot" data-actie="oefen-fouten">${esc(t("Zet {n} fouten recht", { n: Math.min(rows.length, 20) }))}<span class="pijl">${I.pijl}</span></button>` : "";
    return { titel: t("Fouten"), body, onder: onder || "tab" };
  },
  notities() {
    const alles = notities();
    const rijen = Object.entries(alles).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).map(([ref, n]) => {
      const d = notitieDoel(ref);
      return `<div class="kaart"><div class="rij"><span class="groei"><span class="meta-3">${esc(d.soort)}</span><br><strong>${esc(d.titel.length > 70 ? d.titel.slice(0, 67) + "..." : d.titel)}</strong></span><span class="meta">${datum(new Date(n.ts))}</span></div>
        <p class="lees notitietekst">${esc(n.tekst)}</p>
        <div class="rij"><a class="knop tekstknop" href="${d.href}">${esc(t("Ga erheen"))}</a><button class="knop tekstknop" data-actie="notitie-open" data-ref="${esc(ref)}">${esc(t("Bewerken"))}</button></div></div>`;
    }).join("");
    const body = `<h1 class="kop1">${esc(t("Notities"))}</h1>
      <p class="lees">${esc(t("Alles wat je onderweg opschrijft komt hier samen. Een notitie hangt aan de pagina of de vraag waar je hem maakte."))}</p>
      ${rijen || `<div class="kaart"><p style="margin:0">${esc(t("Nog geen notities. Maak er een op een leespagina of onder een vraag, of hieronder."))}</p></div>`}`;
    const onder = `<button class="knop primair groot" data-actie="notitie-open" data-ref="los-${Date.now().toString(36)}">${esc(t("Nieuwe losse notitie"))}</button>`;
    return { titel: t("Notities"), terug: "#/route", body, onder };
  },
  instellingen() {
    const s = S.settings;
    const keuze = (naam, opties) => `<div class="keuzerij">${opties.map(([v, l]) => `<button type="button" class="${s[naam] === v ? "actief" : ""}" data-actie="instelling" data-naam="${naam}" data-waarde="${v}">${l}</button>`).join("")}</div>`;
    const body = `<h1 class="kop1">${esc(t("Instellingen"))}</h1>
      <div class="veld"><label>${esc(t("Taal"))}</label>${keuze("taal", [["nl", t("Nederlands")], ["en", t("Engels")]])}</div>
      <div class="veld"><label>${esc(t("Thema"))}</label>${keuze("thema", [["auto", t("Automatisch")], ["licht", t("Licht")], ["donker", t("Donker")]])}</div>
      <div class="veld"><label>${esc(t("Tekstgrootte"))}</label>${keuze("tekst", [["normaal", t("Normaal")], ["groot", t("Groot")]])}</div>
      <div class="veld"><label for="examendatum">${esc(t("Examendatum"))}</label><input type="date" id="examendatum" data-actie="examendatum" value="${esc(s.examenDatum)}"></div>
      <h2 class="kop2">${esc(t("Koppelen"))}</h2>
      ${sync.configured() ? `<p class="lees">${esc(t("Dit is je koppelcode. Typ hem een keer in op je andere apparaat, dan lopen telefoon en computer gelijk."))}</p>
      <p class="cijfer cijfer-klein" style="font-size:22px;letter-spacing:.04em;user-select:all">${esc(sync.formatCode(S.koppelcode))}</p>
      <div class="knopnaast"><button class="knop omlijnd" data-actie="kopieer-code">${esc(t("Kopieer"))}</button></div>
      <div class="veld" style="margin-top:16px"><label for="koppelcode">${esc(t("Code van je andere apparaat"))}</label><input id="koppelcode" inputmode="latin" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCDE FGHJK ..."><div class="knopnaast"><button class="knop omlijnd" data-actie="koppel">${esc(t("Koppel dit apparaat"))}</button></div></div>
      <p class="meta-3">${esc(sync.state().fout ? t("Laatste poging mislukt: {fout}", { fout: sync.state().fout }) : S.settings.laatsteSync ? t("Laatst gesynchroniseerd {datum} {tijd}", { datum: datum(new Date(S.settings.laatsteSync)), tijd: new Date(S.settings.laatsteSync).toTimeString().slice(0, 5) }) : t("Nog niet gesynchroniseerd"))}${esc(t(" · {n} wachten", { n: S.attempts.filter(a => !a.synced).length }))}</p>
      <button class="knop tekstknop" data-actie="sync-nu">${esc(t("Nu synchroniseren"))}</button>` : `<p class="lees">${esc(t("Koppelen met je computer staat klaar in de code, maar het Supabase-project is nog niet ingevuld. Tot die tijd blijft alles op dit apparaat."))}</p>`}
      <h2 class="kop2">${esc(t("Gegevens"))}</h2>
      <p class="lees">${esc(t("{n} pogingen op dit apparaat.", { n: S.attempts.length }))}</p>
      ${S.gemeld.size ? `<p class="lees">${esc(t(S.gemeld.size === 1 ? "Je meldde {n} vraag als fout: {ids}. Die staan in je export." : "Je meldde {n} vragen als fout: {ids}. Die staan in je export.", { n: S.gemeld.size, ids: [...S.gemeld].join(", ") }))}</p>` : ""}
      <div class="knopnaast"><button class="knop omlijnd" data-actie="exporteer">${esc(t("Exporteer"))}</button><button class="knop omlijnd" data-actie="wis">${esc(t("Wis alles"))}</button></div>
      <h2 class="kop2">${esc(t("Over"))}</h2>
      <p class="meta">${esc(t("Inhoud versie {versie} · {vragen} vragen · {blokken} blokken", { versie: S.index.versie, vragen: Object.keys(S.qById).length, blokken: S.units.length }))}</p>
      <button class="knop tekstknop" data-actie="update">${esc(t("Controleer op een nieuwe versie"))}</button>`;
    return { titel: t("Instellingen"), terug: "#/route", body, onder: "tab" };
  },
};

/* ==== quiz flow ==== */
function startRunIfNeeded() {
  const uid = S.route.unit;
  const u = S.unitById[uid];
  /* een gemengde ronde heeft geen unit, dus die vergelijking gaat daar nooit
     op: herken hem aan zijn soort, anders begint hij bij elke hertekening opnieuw */
  if (S.run && !S.run.klaar && (S.run.unit === uid || (S.route.soort === "gemengd" && S.run.soort === "gemengd"))) return;
  S.run = null;
  if (S.route.soort === "herhaling") {
    const set = SRS.dailySet(S.boxes, S.qById);
    const qs = set.vragen.map(id => S.qById[id]).filter(q => q && Q.SUPPORTED.has(q.type));
    if (qs.length) S.run = Q.newRun({ unit: uid, soort: "herhaling", ref: "herhaling", questions: qs });
    return;
  }
  if (S.route.soort === "gemengd") {
    /* Door elkaar oefenen: hoogstens twee vragen per blok, uit alles wat open
       staat. Dit telt niet mee voor het halen van een blok, want daarvoor moet
       je twee foutloze ronden binnen dat ene blok doen. De antwoorden tellen
       wel mee voor je geschiedenis, en dus voor de dekking van de pool. */
    const perUnit = {};
    for (const u of S.units) if (S.states[u.id] && S.states[u.id].quizOpen) perUnit[u.id] = S.bank[u.id] || [];
    const qs = Q.sampleGemengd(perUnit, S.history, 12);
    if (qs.length >= 4) S.run = Q.newRun({ unit: null, soort: "gemengd", ref: "gemengd", questions: qs });
    return;
  }
  if (S.route.soort === "fouten") {
    const rows = V.foutenlog(S.attempts, S.history, S.qById).slice(0, 20);
    const qs = rows.map(r => S.qById[r.id]).filter(q => Q.SUPPORTED.has(q.type));
    if (qs.length) S.run = Q.newRun({ unit: uid, soort: "herstel", ref: "fouten", questions: qs });
    return;
  }
  if (!u || !S.states[u.id].quizOpen) return;
  const pool = S.bank[u.id] || [];
  if (S.pools[u.id].length < u.quiz.lengte) return;
  const perfect = S.attempts.filter(a => a.kind === "quiz" && a.ref === u.id && a.score === a.total).pop();
  const avoid = perfect ? perfect.answers.map(x => x.q) : [];
  const qs = Q.sample({ pool, history: S.history, lengte: u.quiz.lengte, avoid });
  S.run = Q.newRun({ unit: u.id, soort: "quiz", questions: qs });
}
function herstelronde(run) {
  const s = Q.score(run);
  const inRun = run.items.map(it => it.q.id);
  const qs = [];
  for (const f of s.fouten) {
    const q = S.qById[f.q];
    qs.push(q);
    const sib = Q.sibling(q, S.bank[q.unit] || [], inRun.concat(qs.map(x => x.id)), S.history);
    if (sib) qs.push(sib);
  }
  /* een herstelronde na een gemengde ronde heeft ook geen blok, dus erft hij
     de ref van de ronde waar hij uit voortkomt */
  S.run = Q.newRun({ unit: run.unit, soort: "herstel", questions: qs, ref: run.ref || run.unit });
}
/* Een regel over je tempo, gemeten tegen de 36 seconden die het examen je per
   vraag geeft. Onder de acht antwoorden zegt een mediaan nog niets, dus dan
   blijft de regel weg in plaats van een getal te suggereren dat er niet is. */
function tempoRegel(tp, klasse = "meta-3") {
  if (!tp || tp.n < 8) return "";
  const binnen = tp.seconden <= V.EXAMENTEMPO;
  const oordeel = binnen
    ? t("binnen de {n} seconden die het examen je geeft", { n: V.EXAMENTEMPO })
    : t("het examen geeft je er {n}", { n: V.EXAMENTEMPO });
  return `<p class="${klasse} tempo${binnen ? "" : " traag"}">${esc(t("{s} seconden per vraag", { s: tp.seconden }))} · ${esc(oordeel)}</p>`;
}

function quizEinde(run, u) {
  const s = Q.score(run);
  const st = u ? S.states[u.id] : { staat: "" };
  const fouten = s.fouten.map(f => { const q = S.qById[f.q]; const uq = S.unitById[q.unit] || u; const p = uq ? uq.paginas.find(x => x.id === q.pagina) : null; return `<div class="kaart"><p style="margin:0 0 6px"><strong>${esc(q.stam)}</strong></p><p class="lees" style="margin:0">${esc(q.uitleg.regel)}</p>${p ? `<p class="meta-3" style="margin:6px 0 0"><a href="#/blok/${uq.id}/lezen/${p.id}">${esc(t("Lees {pagina} opnieuw", { pagina: kortePaginanaam(p) }))}</a></p>` : ""}</div>`; }).join("");
  let staatTekst = "";
  if (run.soort === "quiz" && s.gehaald) staatTekst = st.staat === "beheerst" ? t("Blok gehaald.") : st.staat === "voorlopig" ? (st.bevestigd === false && st.runs >= 2 ? t("Nog niet alle vragen uit de pool goed gehad. Nog een quiz, dan is het rond.") : t("Voorlopig gehaald. Doe over minstens 12 uur nog een foutloze quiz, dan is het blok rond.")) : "";
  const body = `<div style="text-align:center;margin:24px 0"><span class="cijfer cijfer-groot">${s.score} <span class="meta-3">${esc(t("van {n}", { n: s.total }))}</span></span><h1 class="kop1" style="margin-top:8px">${esc(s.gehaald ? t("Gehaald") : t("Nog niet"))}</h1><p class="meta">${esc(staatTekst)}</p>${tempoRegel(V.tempo(run.resultaten))}</div>
    ${s.fouten.length ? `<h2 class="kop2">${esc(s.fouten.length === 1 ? t("Deze ging mis") : t("Deze gingen mis"))}</h2>${fouten}` : ""}`;
  const onder = s.fouten.length && run.soort === "quiz"
    ? `<button class="knop primair groot" data-actie="herstel">${esc(t("Alleen de fouten opnieuw"))}<span class="pijl">${I.pijl}</span></button><div class="knopnaast"><button class="knop omlijnd" data-actie="opnieuw">${esc(t("Hele quiz opnieuw"))}</button><a class="knop omlijnd" href="#/blok/${u.id}">${esc(t("Terug naar blok"))}</a></div>`
    : run.soort === "quiz"
      ? `<a class="knop primair groot" href="${st.staat === "beheerst" ? "#/gehaald/" + u.id : "#/blok/" + u.id}">${esc(st.staat === "beheerst" ? t("Blok gehaald") : t("Terug naar blok"))}<span class="pijl">${I.pijl}</span></a>`
      : `<a class="knop primair groot" href="${run.ref === "fouten" ? "#/fouten" : run.soort === "herhaling" ? "#/route" : (run.soort === "gemengd" || !u) ? "#/leren" : "#/blok/" + u.id}">${esc(t("Klaar"))}<span class="pijl">${I.pijl}</span></a>${s.fouten.length && u ? `<button class="knop tekstknop" data-actie="herstel">${esc(t("Nog een herstelronde"))}</button>` : ""}`;
  return { titel: t("Uitslag"), terug: u ? "#/blok/" + u.id : run.soort === "gemengd" ? "#/leren" : "#/route", sluit: true, midden: esc(run.soort === "quiz" ? t("Quiz-einde") : run.soort === "herhaling" ? t("Herhaling") : run.soort === "gemengd" ? t("Door elkaar") : t("Herstelronde")), body, onder };
}
async function afronden() {
  const run = S.run;
  const u = S.unitById[run.unit];
  const voor = u && S.states[u.id] ? S.states[u.id].staat : null;
  await log(Q.toAttempt(run, S.index.versie));
  const na = u && S.states[u.id] ? S.states[u.id].staat : null;
  if (u && run.soort === "quiz" && voor !== "beheerst" && na === "beheerst") { S.run = null; go("gehaald/" + u.id); return; }
  render();
}

/* ==== events ==== */
async function onClick(e) {
  const el = e.target.closest("[data-actie]");
  if (!el) return;
  const a = el.dataset.actie;
  const run = S.run;
  if (a === "open-route") { if (innerWidth >= 1024) go("route"); else { S.sheet = "route"; render(); } return; }
  if (a === "sluit-sheet") { S.sheet = null; render(); return; }
  if (a === "bekijk-bord") { e.preventDefault(); S.viewer = { bord: el.dataset.code }; render(); return; }
  if (a === "bekijk-scene") { e.preventDefault(); S.viewer = { scene: el.dataset.scene }; render(); return; }
  if (a === "notitie-open") { S.schrijf = { ref: el.dataset.ref, titel: el.dataset.titel || "" }; render(); setTimeout(() => { const v = document.getElementById("notitieveld"); if (v) { v.focus(); v.selectionStart = v.value.length; } }, 60); return; }
  if (a === "notitie-annuleer") { S.schrijf = null; render(); return; }
  if (a === "notitie-bewaar") { const v = document.getElementById("notitieveld"); await bewaarNotitie(el.dataset.ref, v ? v.value : "", el.dataset.titel); S.schrijf = null; toast(t("Notitie bewaard")); render(); return; }
  if (a === "notitie-wis") { await bewaarNotitie(el.dataset.ref, "", ""); S.schrijf = null; toast(t("Notitie verwijderd")); render(); return; }
  if (a === "begrip") { e.preventDefault(); const b = B.zoek(el.dataset.term); if (b) { S.viewer = { begrip: b }; render(); } return; }
  if (a === "frame" && run) { const it = Q.current(run); it.frame = Math.max(0, it.frame + parseInt(el.dataset.n, 10)); render(); return; }
  if (a === "speel" && run) { speelReeks(run); return; }
  if (a === "sluit-viewer") { if (e.target.closest("a")) return; S.viewer = null; render(); return; }
  if (a === "toon-antwoord") { const z = el.closest(".zelftest"); z.querySelector(".antwoord").classList.remove("verborgen"); el.classList.add("verborgen"); return; }
  if (a === "start-examen") { startExamen(el.dataset.nr ? parseInt(el.dataset.nr, 10) : null); render(); return; }
  if (a === "examen-markeer" && run && run.examen) { Q.markeer(run); render(); return; }
  if (a === "examen-inleveren" && run && run.examen) { await leverIn(); return; }
  if (a === "examen-ga" && run && run.examen) {
    const n = parseInt(el.dataset.n, 10);
    if (n >= run.items.length) { Q.park(run); run.overzicht = true; }
    else { run.overzicht = false; Q.ga(run, n); }
    render();
    autoSpeel(run);
    return;
  }
  if (a === "kies" && run) { const t = Q.current(run).q.type; Q.choose(run, el.dataset.id); if (t !== "meervoudig" && t !== "volgorde" && run.gekozen.length === 1 && run.gekozen[0] === el.dataset.id && el.classList.contains("gekozen")) { /* second tap on the selected option confirms */ Q.check(run, S.history); } render(); return; }
  if (a === "controleer" && run) { Q.check(run, S.history); render(); return; }
  if (a === "fouttype" && run) { Q.setFouttype(run, el.dataset.type); render(); return; }
  if (a === "redeneer" && run) { run.redenering = el.value; return; }
  if (a === "volgende" && run) { if (Q.next(run)) await afronden(); else { render(); autoSpeel(run); } return; }
  if (a === "herstel" && run) { herstelronde(run); render(); return; }
  if (a === "opnieuw" && run) { S.run = null; startRunIfNeeded(); render(); return; }
  if (a === "foutgroep") { S.foutgroep = S.foutgroep === el.dataset.oorzaak ? null : el.dataset.oorzaak; render(); return; }
  if (a === "oefen-fouten") { S.run = null; go("quiz/fouten/fouten"); return; }
  if (a === "klaar-lezen") { const u = S.unitById[el.dataset.unit]; S.lezenStart = null; await log({ kind: "lezen", ref: u.id, unit: u.id, klaar: true, duration_ms: 0, content_version: S.index.versie, answers: [] }); go("gehaald/" + u.id); return; }
  if (a === "instelling") { await setSetting(el.dataset.naam, el.dataset.waarde); render(); return; }
  if (a === "taal") { if (el.dataset.waarde !== taal()) { await setSetting("taal", el.dataset.waarde); render(); } return; }
  if (a === "meld-fout") {
    const qid = el.dataset.q;
    if (S.gemeld.has(qid)) { toast(t("Deze had je al gemeld")); return; }
    S.gemeld.add(qid);
    await log({ kind: "flag", ref: qid, unit: (S.qById[qid] || {}).unit, content_version: S.index.versie, answers: [] });
    toast(t("Gemeld. Ik kijk ernaar bij de volgende ronde"));
    return;
  }
  if (a === "kopieer-code") { try { await navigator.clipboard.writeText(S.koppelcode); toast(t("Gekopieerd")); } catch (e) { toast(t("Kopieren lukt niet, typ de code over")); } return; }
  if (a === "koppel") { const inp = document.getElementById("koppelcode"); try { S.koppelcode = await sync.setLearnerCode(inp.value); toast(t("Gekoppeld, gegevens worden opgehaald")); const n = await sync.flush(); await refresh(); toast(n ? t("{n} pogingen opgehaald", { n }) : t("Gekoppeld")); render(); } catch (e) { toast(e.message); } return; }
  if (a === "sync-nu") { toast(t("Synchroniseren")); const n = await sync.flush(); await refresh(); toast(sync.state().fout ? t("Mislukt: {fout}", { fout: sync.state().fout }) : n ? t("{n} nieuwe pogingen", { n }) : t("Alles is gelijk")); render(); return; }
  if (a === "wis") {
    if (!confirm(t("Alles wissen en opnieuw beginnen? Dit haalt je pogingen ook van de server, dus je voortgang komt niet terug. Staat er nog een ander apparaat aan de koppelcode, wis daar dan ook."))) return;
    let serverFout = null;
    try { await sync.wipeServer(); } catch (e) { serverFout = e.message; }
    await store.wipe();
    /* de koppelcode zit ook in localStorage en zou de oude rijen zo weer
       binnenhalen, dus die gaat eruit en de app maakt bij de volgende start
       een nieuwe aan */
    for (const k of ["koppelcode", "laatstePull"]) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
    S.koppelcode = await sync.learnerCode();
    await refresh();
    toast(serverFout ? t("Dit apparaat is leeg, maar de server gaf: {fout}", { fout: serverFout }) : t("Alles gewist. Je begint weer bij blok 1."));
    render();
    return;
  }
  if (a === "exporteer") { const blob = new Blob([JSON.stringify({ attempts: S.attempts, settings: S.settings }, null, 1)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "44-van-de-50-" + new Date().toISOString().slice(0, 10) + ".json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); return; }
  if (a === "update") { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.update(); toast(t("Gecontroleerd. Een nieuwe versie laadt bij de volgende start.")); } render(); return; }
  if (a === "herlaad") { location.reload(); return; }
}
/* een invulvraag verzamelt zijn antwoord terwijl je typt, niet pas bij een klik */
function onInput(e) {
  const el = e.target.closest("[data-actie]");
  if (!el) return;
  /* meteen bij het typen onthouden, niet pas bij het verlaten van het veld:
     anders is wat je schreef weg als je het scherm kantelt of wegklikt */
  if (el.dataset.actie === "redeneer" && S.run) { S.run.redenering = el.value; return; }
  /* de snelheidsschuif tekent alleen zijn eigen vlak opnieuw: een hertekening
     van het scherm zou de schuif onder je vinger vandaan halen */
  if (el.dataset.actie === "begripzoek") {
    S.begripzoek = el.value;
    const plek = el.selectionStart;
    render();
    const nieuw = document.querySelector('[data-actie="begripzoek"]');
    if (nieuw) { nieuw.focus(); try { nieuw.setSelectionRange(plek, plek); } catch (e) { /* type search */ } }
    return;
  }
  if (el.dataset.actie === "bordzoek") {
    S.bordzoek = el.value;
    const plek = el.selectionStart;
    render();
    const nieuw = document.querySelector('[data-actie="bordzoek"]');
    if (nieuw) { nieuw.focus(); try { nieuw.setSelectionRange(plek, plek); } catch (e) { /* type search */ } }
    return;
  }
  if (el.dataset.actie === "remweg") {
    const v = parseInt(el.value, 10);
    const fig = el.closest(".diagram");
    if (fig) {
      const vel = fig.querySelector(".diagramvel");
      if (vel) vel.innerHTML = remwegSvg(v);
      const uit = fig.querySelector("[data-remweg-uit]");
      if (uit) uit.textContent = v + " km/u";
    }
    return;
  }
  if (el.dataset.actie !== "invul" || !S.run) return;
  S.run.gekozen = el.value.trim() ? [el.value.trim()] : [];
  const knop = document.querySelector('[data-actie="controleer"]');
  if (knop) knop.disabled = !Q.ready(S.run);
}
function onChange(e) {
  const el = e.target.closest("[data-actie]");
  if (!el) return;
  if (el.dataset.actie === "twijfel" && S.run) { S.run.twijfel = el.checked; return; }
  if (el.dataset.actie === "redeneer" && S.run) { S.run.redenering = el.value; return; }
  if (el.dataset.actie === "examendatum" && /^\d{4}-\d{2}-\d{2}$/.test(el.value)) { setSetting("examenDatum", el.value).then(render); }
}
function onKey(e) {
  if (S.route.name !== "quiz" || !S.run || S.run.klaar) return;
  if (e.target.tagName === "INPUT") {
    const invul = e.target.dataset && e.target.dataset.actie === "invul";
    if (!(invul && e.key === "Enter")) return;
    e.preventDefault();
    if (Q.ready(S.run)) { Q.check(S.run, S.history); render(); }
    return;
  }
  const run = S.run;
  if (e.key === "Enter") { e.preventDefault(); if (run.fase === "kies") { if (run.gekozen.length) { Q.check(run, S.history); render(); } } else { if (Q.next(run)) afronden(); else render(); } return; }
  if (e.key === "Escape") { go("blok/" + run.unit); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9 && run.fase === "kies") {
    const item = Q.current(run);
    const ids = item.q.type === "hotspot" ? item.grid : item.opties.map(o => o.id);
    if (ids[n - 1]) { Q.choose(run, ids[n - 1]); render(); }
  }
}
async function setSetting(naam, waarde) {
  S.settings[naam] = waarde;
  await store.setSetting(naam, waarde);
  await store.setSetting("instellingenAt", Date.now());
  sync.flush();
  if (naam === "thema") { try { localStorage.setItem("thema", waarde); } catch (e) { /* private mode */ } document.documentElement.dataset.theme = waarde === "donker" ? "dark" : waarde === "licht" ? "light" : ""; if (waarde === "auto") delete document.documentElement.dataset.theme; }
  if (naam === "tekst") { try { localStorage.setItem("tekst", waarde); } catch (e) { /* private mode */ } if (waarde === "groot") document.documentElement.dataset.tekst = "groot"; else delete document.documentElement.dataset.tekst; }
  if (naam === "taal") { try { localStorage.setItem("taal", waarde); } catch (e) { /* private mode */ } zetTaal(waarde); await laadVertalingen(); pasTaalToe(); await refresh(); }
}
/* In een examen heeft de vraag geen afspeelknop, dus start het beeld zelf zodra
   je bij zo'n vraag aankomt. Buiten het examen blijft het jouw keuze. */
function autoSpeel(run) {
  if (!run || !run.examen || run.fase === "toon") return;
  const it = Q.current(run);
  if (!it || !it.q.media || !it.q.media.reeks) return;
  speelReeks(run);
}

/* a reeks plays its frames once, 1500 ms apart, like the CBR clip; outside an exam the stepper stays for replays */
function speelReeks(run) {
  const it = Q.current(run);
  const n = (it.q.media.reeks || []).length;
  it.frame = 0; render();
  let i = 0;
  const tick = () => { if (S.run !== run || Q.current(run) !== it) return; i += 1; if (i < n) { it.frame = i; render(); setTimeout(tick, 1500); } };
  setTimeout(tick, 1500);
}
function toast(tekst, knop, actie) { S.toast = { tekst, knop, actie }; render(); setTimeout(() => { if (S.toast && S.toast.tekst === tekst) { S.toast = null; render(); } }, actie ? 15000 : 3000); }

/* ==== service worker ==== */
function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  let had = !!navigator.serviceWorker.controller;
  /* Vraag bij elke start of er een nieuwe versie is, en nog eens als de app na
     een half uur weer op de voorgrond komt. Zonder dat blijft een geinstalleerde
     app op zijn eigen kopie draaien tot de browser er toevallig zin in heeft, en
     dan lees je dagen later nog de oude pagina. */
  navigator.serviceWorker.register("sw.js").then(reg => {
    if (!reg) return;
    reg.update().catch(() => {});
    let laatst = Date.now();
    addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - laatst < 30 * 60000) return;
      laatst = Date.now();
      reg.update().catch(() => {});
    });
  }).catch(() => { /* file:// or unsupported */ });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) toast(t("Nieuwe versie klaar"), t("Herlaad"), "herlaad"); had = true; });
}

boot().catch(err => { app.innerHTML = `<main class="inhoud"><h1 class="kop1">${esc(t("Er ging iets mis bij het laden"))}</h1><p class="lees">${esc(err.message)}</p><p class="meta">${esc(t("Ververs de pagina. Als dat niet helpt: Instellingen, Wis alles."))}</p></main>`; console.error(err); });
