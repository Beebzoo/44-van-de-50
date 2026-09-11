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
import { t, taal, zetTaal, isEngels, DAGEN as TDAGEN, MAANDEN as TMAANDEN } from "./taal.js";

const app = document.getElementById("app");
const S = {
  route: { name: "route" }, index: null, units: [], unitsNl: [], vertalingen: null, unitById: {}, bank: {}, qById: {}, pools: {}, scenes: {},
  attempts: [], history: new Map(), states: {}, settings: {}, boxes: new Map(),
  run: null, sheet: null, viewer: null, toast: null, gemeld: new Set(), familie: null, lezenStart: null, zojuistGehaald: null,
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
  route: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 21V9M12 9h6l2-2.5L18 4h-6M12 13H7l-2 2 2 2h5"/></svg>',
  leren: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/></svg>',
  borden: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 4l9 15H3z"/></svg>',
  fouten: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  vink: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  kruis: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  vergroot: '<svg class="ico" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>',
};

/* ==== boot ==== */
async function boot() {
  store.persist(); /* not awaited: a permission prompt must never block the start */
  S.settings = { thema: "auto", tekst: "normaal", taal: "nl", examenDatum: null, ...(await store.allSettings()) };
  zetTaal(S.settings.taal);
  S.koppelcode = await sync.learnerCode();
  S.index = await fetch("content/index.json").then(r => r.json());
  if (!S.settings.examenDatum) S.settings.examenDatum = S.index.examenDatum;
  await loadSigns();
  const units = await Promise.all(S.index.units.map(u => fetch(u.bestand).then(r => r.json())));
  S.unitsNl = units.sort((a, b) => a.volgorde - b.volgorde);
  await laadVertalingen();
  pasTaalToe();
  await Promise.all(S.index.units.map(async u => {
    S.bank[u.id] = [];
    for (const f of u.bank) { const b = await fetch(f).then(r => r.json()); S.bank[u.id].push(...b.vragen); }
  }));
  for (const qs of Object.values(S.bank)) for (const q of qs) S.qById[q.id] = q;
  await Promise.all((S.index.scenes || []).map(async id => { S.scenes[id] = await fetch("content/scenes/" + id + ".json").then(r => r.json()); }));
  setScenes(S.scenes);
  for (const u of S.units) S.pools[u.id] = (S.bank[u.id] || []).filter(q => !q.reserve && Q.SUPPORTED.has(q.type)).map(q => q.id);
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
  const uit = {};
  await Promise.all(S.index.units.map(async u => {
    try { const r = await fetch("content/units-en/" + u.id + ".json"); uit[u.id] = r.ok ? await r.json() : null; }
    catch (e) { uit[u.id] = null; }
  }));
  S.vertalingen = uit;
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
  S.units = isEngels() && S.vertalingen ? S.unitsNl.map(u => voegSamen(u, S.vertalingen[u.id])) : S.unitsNl;
  S.unitById = {};
  for (const u of S.units) S.unitById[u.id] = u;
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
  S.sheet = null; S.viewer = null;
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
  return `<button class="chip ${cls}" data-actie="open-route" aria-label="${esc(t("{d} dagen tot je examen", { d }))}">${esc(d < 0 ? t("examen geweest") : t("{d} d", { d }))}</button>`;
}
function taalknop() {
  const nu = taal();
  return `<div class="taalknop" role="group" aria-label="${esc(t("Taal"))}">${["nl", "en"].map(x => `<button type="button" class="${x === nu ? "actief" : ""}" data-actie="taal" data-waarde="${x}" aria-pressed="${x === nu}" aria-label="${esc(x === "en" ? t("Schakel naar het Engels") : t("Schakel naar het Nederlands"))}">${x.toUpperCase()}</button>`).join("")}</div>`;
}
function header(v) {
  const nav = ["route", "leren", "borden", "fouten"].map(n => `<a href="#/${n}" class="${S.route.name === n || (n === "leren" && ["blok", "lezen"].includes(S.route.name)) ? "actief" : ""}">${esc(t({ route: "Route", leren: "Leren", borden: "Borden", fouten: "Fouten" }[n]))}</a>`).join("");
  const links = v.terug ? `<a class="ikoonknop" href="${esc(v.terug)}" aria-label="${esc(t(v.sluit ? "Sluiten" : "Terug"))}">${v.sluit ? I.sluit : I.terug}</a>` : `<a class="merk" href="#/route">44 van de 50</a>`;
  return `<header class="kopbalk">${links}<nav class="nav">${nav}</nav><div class="midden">${v.midden || ""}</div>${v.taal === false ? "" : taalknop()}${v.chip === false ? "" : countdownChip()}</header>`;
}
function lane() {
  const cur = currentUnit();
  return `<div class="baan" aria-hidden="true">${S.units.map(u => { const st = S.states[u.id]; const c = st.staat === "beheerst" ? "vol" : st.staat === "voorlopig" ? "half" : ""; return `<span class="streep ${c} ${cur && cur.id === u.id ? "nu" : ""}"></span>`; }).join("")}</div>`;
}
function tabbar() {
  const tabs = [["route", t("Route"), I.route], ["leren", t("Leren"), I.leren], ["borden", t("Borden"), I.borden], ["fouten", t("Fouten"), I.fouten]];
  const act = n => S.route.name === n || (n === "leren" && ["blok", "lezen", "gehaald"].includes(S.route.name)) || (n === "borden" && S.route.name === "bord");
  return `<nav class="onderbalk tab"><div class="tabbalk">${tabs.map(([n, l, ic]) => `<a href="#/${n}" class="${act(n) ? "actief" : ""}">${ic}<span>${l}</span></a>`).join("")}</div></nav>`;
}
function actionbar(html) { return `<div class="onderbalk"><div class="actiebalk">${html}</div></div>`; }
function overlays() {
  let h = "";
  if (S.sheet === "route") h += `<div class="scrim" data-actie="sluit-sheet"></div><div class="sheet" role="dialog" aria-label="Route"><div class="handvat"></div>${countdownBlock()}${timeline()}</div>`;
  if (S.viewer && S.viewer.bord) {
    const code = S.viewer.bord, b = sign(code);
    h += `<div class="viewer" data-actie="sluit-viewer" role="dialog" aria-label="${esc(code)}">${bordHtml(code, 176)}<div class="naam"><span class="bordcode">${esc(code)}</span><br>${b ? esc(b.betekenis) : ""}</div><a class="knop tekstknop" href="#/borden/${encodeURIComponent(code)}">${esc(t("Bekijk in Borden"))}</a></div>`;
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
  app.innerHTML = `${header(v)}${v.baan === false ? "" : lane()}<div class="romp"><main class="inhoud ${v.onder ? "" : "geen-balk"}">${v.body}</main>${S.route.name === "route" ? "" : `<aside class="rail">${timeline(true)}</aside>`}</div>${onder}${overlays()}`;
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

function startExamen() {
  const pool = [];
  for (const u of S.units) {
    if (!S.states[u.id] || !S.states[u.id].quizOpen) continue;
    for (const q of S.bank[u.id] || []) pool.push(q);
  }
  if (pool.length < Q.EXAMEN.getoond) return;
  S.run = Q.newExamen(Q.sampleExamen(pool, S.history));
  startKlok();
}
async function leverIn() {
  const run = S.run;
  if (!run || !run.examen || run.klaar) return;
  stopKlok();
  Q.sluitExamen(run, S.history);
  await log(Q.toAttempt(run, S.index.versie));
  render();
}

function examenIntro() {
  const open = S.units.filter(u => S.states[u.id] && S.states[u.id].quizOpen);
  const pool = open.reduce((a, u) => a + (S.bank[u.id] || []).length, 0);
  const sims = S.attempts.filter(a => a.kind === "examen");
  const laatste = sims.slice(-5).reverse();
  const genoeg = pool >= Q.EXAMEN.getoond;
  const body = `<h1 class="kop1">${esc(t("Oefenexamen"))}</h1>
    <p class="lees">${esc(t("{getoond} vragen waarvan er {telt} tellen, {minuten} minuten, en je haalt het bij {halen} goed. Net als bij het CBR krijg je onderweg niets te zien: je antwoordt, je mag terug, en je ziet alles pas als je inlevert.", { getoond: Q.EXAMEN.getoond, telt: Q.EXAMEN.telt, minuten: Q.EXAMEN.minuten, halen: Q.EXAMEN.halen }))}</p>
    ${genoeg ? "" : `<div class="kaart"><p style="margin:0">${esc(t("Er zijn nog {n} vragen te weinig vrijgespeeld. Rond eerst wat blokken af.", { n: Q.EXAMEN.getoond - pool }))}</p></div>`}
    ${laatste.length ? `<h2 class="kop2">${esc(t("Je vorige simulaties"))}</h2>${laatste.map(a => `<div class="kaart"><div class="rij"><span class="cijfer">${a.score}<span class="meta-3"> ${esc(t("van {n}", { n: a.total }))}</span></span><div class="groei"><strong>${esc(a.score >= Q.EXAMEN.halen ? t("Gehaald") : t("Niet gehaald"))}</strong><br><span class="meta">${datum(new Date(a.created_at || a.ts))}</span></div></div></div>`).join("")}` : ""}`;
  const onder = genoeg
    ? `<button class="knop primair groot" data-actie="start-examen">${esc(sims.length ? t("Nog een simulatie") : t("Begin het oefenexamen"))}<span class="pijl">${I.pijl}</span></button>`
    : `<a class="knop omlijnd groot" href="#/route">${esc(t("Terug naar Route"))}</a>`;
  return { titel: t("Oefenexamen"), terug: "#/route", sluit: true, body, onder };
}

function examenOverzicht(run) {
  const n = run.items.length;
  const beantwoord = run.items.filter(it => (run.antwoorden[it.q.id] || []).length).length;
  const hokjes = run.items.map((it, i) => {
    const heeft = (run.antwoorden[it.q.id] || []).length > 0;
    const vlag = run.gemarkeerd.includes(it.q.id);
    return `<button type="button" class="vraaghokje ${heeft ? "beantwoord" : ""} ${vlag ? "gemarkeerd" : ""}" data-actie="examen-ga" data-n="${i}">${i + 1}</button>`;
  }).join("");
  const body = `<div class="examenbalk groot"><span class="klok" id="examenklok">${klokTekst(Q.seconden(run))}</span><span class="meta">${esc(t("{beantwoord} van {n} beantwoord", { beantwoord, n }))}</span></div>
    <h1 class="kop1">${esc(t("Overzicht"))}</h1>
    <p class="lees">${esc(t("Tik op een nummer om terug te gaan. Een blauw randje betekent dat je hem gemarkeerd hebt."))}</p>
    <div class="vraagraster">${hokjes}</div>
    ${beantwoord < n ? `<p class="meta">${esc(t("Je hebt er nog {n} niet beantwoord. Onbeantwoord telt als fout.", { n: n - beantwoord }))}</p>` : ""}`;
  return { titel: t("Oefenexamen"), terug: "#/examen", sluit: true, midden: esc(t("Oefenexamen")), taal: false, body, onder: `<button class="knop primair groot" data-actie="examen-inleveren">${esc(t("Inleveren en nakijken"))}<span class="pijl">${I.pijl}</span></button>` };
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
  const body = `<div style="text-align:center;margin:24px 0"><span class="cijfer cijfer-groot">${u.score} <span class="meta-3">${esc(t("van {n}", { n: u.totaal }))}</span></span><h1 class="kop1" style="margin-top:8px">${esc(u.gehaald ? t("Gehaald") : t("Niet gehaald"))}</h1><p class="meta">${esc(t("Je haalt het bij {halen} goed", { halen: u.halen }))}${u.onbeantwoord ? esc(t(", en je liet er {n} open", { n: u.onbeantwoord })) : ""}.</p></div>
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
const SCREENS = {
  route() {
    const u = currentUnit();
    const st = S.states[u.id];
    const act = volgendeActie(u);
    const vd = V.vandaag(S.attempts);
    const fouten = V.foutenlog(S.attempts, S.history, S.qById);
    const streak = V.streak(S.attempts);
    const body = `${countdownBlock()}
      <p class="meta">${esc(t("Verder waar je was"))}</p>
      <div class="kaart"><div class="rij"><div class="groei"><span class="bloknr">${u.volgorde}</span><strong>${esc(u.titel)}</strong><br><span class="meta">${esc(act.tekst)}</span></div></div>
        <a class="knop primair groot" style="margin-top:12px" href="${act.href}">${esc(act.knop)}<span class="pijl">${I.pijl}</span></a></div>
      <p class="meta-3">${esc(t("Vandaag {vragen} vragen, {minuten} min", { vragen: vd.vragen, minuten: vd.minuten }))}${streak > 1 ? esc(t(" · {n} dagen op rij", { n: streak })) : ""}</p>
      ${herhalingKaart()}
      ${examenklaarKaart()}
      ${timeline()}
      <a class="kaart klik" href="#/fouten"><div class="rij"><span class="groei">${esc(t("Fouten om te herhalen"))}</span><span class="cijfer cijfer-klein">${fouten.length}</span>${I.pijl}</div></a>`;
    return { titel: t("Route"), body, onder: "tab" };
  },
  leren() {
    const body = `<h1 class="kop1">${esc(t("Leren"))}</h1><p class="meta" style="margin-bottom:16px">${esc(t("Zestien blokken in leervolgorde. Een blok is gehaald na twee foutloze quizzen."))}</p>` + S.units.map(u => {
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
        ${stats.pogingen || stats.minuten ? `<p class="meta-3" style="margin:8px 0 0">${esc(t("{vragen} vragen beantwoord · {minuten} min in dit blok", { vragen: stats.vragen, minuten: stats.minuten }))}</p>` : ""}</div>
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
      <p class="meta-3">${esc(t("Pagina {i} van {n}", { i: i + 1, n: u.paginas.length }))}</p>${isEngels() && p.vertaald === false ? `<p class="meta">${esc(t("Deze pagina is nog niet vertaald. Je leest hem in het Nederlands."))}</p>` : ""}${pageHtml(u, p)}`;
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
      ? `<div class="examenbalk"><span class="klok" id="examenklok">${klokTekst(Q.seconden(run))}</span><button type="button" class="knop tekstknop ${run.gemarkeerd.includes(q0(run).id) ? "actief" : ""}" data-actie="examen-markeer">${esc(run.gemarkeerd.includes(q0(run).id) ? t("Gemarkeerd") : t("Markeer"))}</button></div>`
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
      media = frames.length ? `<div class="reeks">${scenePlate(frames[f], toon)}<div class="stapper"><button type="button" data-actie="frame" data-n="-1" ${f === 0 ? "disabled" : ""} aria-label="${esc(t("Vorig beeld"))}">${I.terug}</button><span class="stipjes" aria-hidden="true">${frames.map((x, i) => `<span class="${i === f ? "nu" : ""}"></span>`).join("")}</span><button type="button" data-actie="frame" data-n="1" ${f >= frames.length - 1 ? "disabled" : ""} aria-label="${esc(t("Volgend beeld"))}">${I.pijl}</button><button type="button" data-actie="speel">${esc(t("Speel af"))}</button></div></div>` : "";
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
      const pagina = u.paginas.find(p => p.id === q.pagina);
      const bron = q.bronnen.filter(b => !b.afgeleid).map(b => b.boek ? t("Boek p. {p}", { p: b.boek }) + (b.sectie ? " (§" + b.sectie + ")" : "") : t("SpeedTheorie slide {n}", { n: b.slide })).join(" · ");
      const ft = r.goed && !r.twijfel ? "" : `<div class="blokje"><span class="label">${esc(t("Wat ging er mis?"))}</span><div class="fouttypes">${[["niet_geweten", "Niet geweten"], ["verkeerd_gelezen", "Verkeerd gelezen"], ["verkeerd_toegepast", "Verkeerd toegepast"], ["gegokt", "Gegokt"]].map(([k, l]) => `<button type="button" class="${run.fouttype === k ? "actief" : ""}" data-actie="fouttype" data-type="${k}">${esc(t(l))}</button>`).join("")}</div><span class="meta-3">${esc(t("Komt terug aan het eind."))}</span></div>`;
      uitleg = `<section class="uitleg" aria-live="polite"><span class="staat ${r.goed && !r.twijfel ? "goed" : ""}">${esc(r.goed ? (r.twijfel ? t("Goed, maar getwijfeld") : t("Goed")) : t("Nog niet"))}</span>
        <h2 class="kop2">${esc(t("Waarom"))}</h2><p class="lees">${esc(u2.waarom)}</p>
        <div class="blokje lees"><span class="label">${esc(t("Regel"))}</span>${esc(u2.regel)}</div>
        ${q.type === "volgorde" ? `<div class="blokje lees"><span class="label">${esc(t("De juiste volgorde"))}</span><ol class="lijst" style="margin:4px 0 0">${q.correct.map(id => { const o = q.opties.find(x => x.id === id); return `<li><strong>${esc(o ? o.tekst : id)}</strong>${o && o.feedback ? `<span class="meta" style="display:block">${esc(o.feedback.replace(/^(Goed|Fout)[.,:]?\s*/i, ""))}</span>` : ""}</li>`; }).join("")}</ol></div>` : q.type === "invul" ? `<div class="blokje lees"><span class="label">${esc(t("Het goede antwoord"))}</span>${esc(String(q.correct.getal).replace(".", ","))} ${esc(q.correct.eenheid)}</div>` : q.type !== "hotspot" && goedOptie ? `<div class="blokje lees"><span class="label">${esc(t("Het goede antwoord"))}</span>${esc(goedOptie.feedback.replace(/^Goed[.,:]?\s*/i, ""))}</div>` : ""}
        <div class="blokje lees"><span class="label">${esc(t("Valkuil"))}</span>${esc(u2.valkuil)}</div>
        ${u2.onthoud ? `<div class="onthoud"><span class="label">${esc(t("Onthoud"))}</span>${esc(u2.onthoud)}</div>` : ""}
        ${ft}
        <p class="meta-3" style="margin:8px 0 0">${esc(bron)}${pagina ? ` · <a href="#/blok/${u.id}/lezen/${pagina.id}">${esc(t("Lees {pagina} opnieuw", { pagina: kortePaginanaam(pagina) }))}</a>` : ""}</p>
        <button class="knop tekstknop" style="min-height:36px;padding:0" data-actie="meld-fout" data-q="${esc(q.id)}">${esc(S.gemeld.has(q.id) ? t("Gemeld") : t("Klopt deze vraag niet?"))}</button></section>`;
    }
    const body = `${dots}${media}<p class="vraagtekst">${esc(q.stam)}</p>${hint}${opties}${uitleg}`;
    const onder = toon
      ? `<button class="knop primair groot" data-actie="volgende">${esc(run.i + 1 >= n ? t("Naar de uitslag") : t("Volgende"))}<span class="pijl">${I.pijl}</span></button>`
      : run.examen
        ? `<div class="rij"><button class="knop omlijnd" data-actie="examen-ga" data-n="${run.i - 1}" ${run.i === 0 ? "disabled" : ""} aria-label="${esc(t("Vorige vraag"))}">${I.terug}</button><button class="knop primair groot" data-actie="examen-ga" data-n="${run.i + 1}">${esc(run.i + 1 >= n ? t("Naar het overzicht") : t("Volgende"))}<span class="pijl">${I.pijl}</span></button></div>`
        : `<div class="rij"><label class="twijfel"><input type="checkbox" data-actie="twijfel" ${run.twijfel ? "checked" : ""}> ${esc(t("Twijfel"))}</label><button class="knop primair groot" data-actie="controleer" ${Q.ready(run) ? "" : "disabled"}>${esc(t("Controleer"))}</button></div>`;
    const naam = run.examen ? t("Oefenexamen") : run.soort === "quiz" ? t("Quiz") : run.soort === "herhaling" ? t("Herhaling") : run.ref === "fouten" ? t("Fouten oefenen") : t("Herstelronde");
    return { titel: naam, terug: run.examen ? "#/examen" : u ? "#/blok/" + u.id : "#/route", sluit: true, midden: esc(t("{naam} · vraag {i} van {n}", { naam, i: run.i + 1, n })), body, onder, baan: true, taal: false };
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
    const fam = S.route.familie || S.familie || fams[0].letter;
    S.familie = fam;
    const list = allSigns().filter(b => b.familie === fam && !b.zonderCode && hasSymbol(b.code));
    const chips = `<div class="chips">${fams.map(f => `<a href="#/borden/${f.letter}" style="text-decoration:none"><button type="button" class="${f.letter === fam ? "actief" : ""}">${f.letter} ${esc(t(f.naam))}</button></a>`).join("")}</div>`;
    const grid = `<div class="bordraster">${list.map(b => `<button type="button" class="bordtegel" data-actie="bekijk-bord" data-code="${esc(b.code)}">${bordHtml(b.code, 112)}<span class="bordcode">${esc(b.code)}</span><span class="naam">${esc(b.betekenis.length > 60 ? b.betekenis.slice(0, 57) + "..." : b.betekenis)}</span></button>`).join("")}</div>`;
    return { titel: t("Borden"), body: `<h1 class="kop1">${esc(t("Borden"))}</h1>${chips}<h2 class="kop2" style="margin-top:8px">${fam} ${esc(t(familyName(fam)))}</h2>${grid}`, onder: "tab" };
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
  fouten() {
    const rows = V.foutenlog(S.attempts, S.history, S.qById);
    const byUnit = {};
    for (const r of rows) (byUnit[r.unit] = byUnit[r.unit] || []).push(r);
    const groups = S.units.filter(u => byUnit[u.id]).map(u => `<h2 class="kop2">${esc(t("Blok {n} {titel}", { n: u.volgorde, titel: u.titel }))} <span class="meta-3" style="float:right">${byUnit[u.id].length}</span></h2>` + byUnit[u.id].map(r => { const p = u.paginas.find(x => x.id === r.pagina); return `<a class="kaart klik" href="#/blok/${u.id}/lezen/${r.pagina}"><div class="rij"><div class="groei">${esc(r.stam.length > 90 ? r.stam.slice(0, 87) + "..." : r.stam)}<br><span class="meta-3">${esc(p ? p.titel : "")}</span></div><span class="meta">${r.fout}x</span></div></a>`; }).join("")).join("");
    const types = { niet_geweten: 0, verkeerd_gelezen: 0, verkeerd_toegepast: 0, gegokt: 0 };
    for (const a of S.attempts) for (const x of a.answers || []) if ((!x.goed || x.twijfel) && x.fouttype && types[x.fouttype] !== undefined) types[x.fouttype] += 1;
    const totaal = Object.values(types).reduce((a, b) => a + b, 0);
    const taxonomie = totaal ? `<div class="feiten" style="margin:8px 0 16px">${[["niet_geweten", "niet geweten"], ["verkeerd_gelezen", "verkeerd gelezen"], ["verkeerd_toegepast", "verkeerd toegepast"], ["gegokt", "gegokt"]].map(([k, l]) => `<div><span class="cijfer cijfer-klein">${types[k]}</span><span class="meta">${esc(t(l))}</span></div>`).join("")}</div>` : "";
    const body = `<h1 class="kop1">${esc(t("Fouten"))} <span class="cijfer cijfer-klein" style="float:right">${rows.length}</span></h1>${taxonomie}
      ${rows.length ? `<button class="knop primair groot" data-actie="oefen-fouten" style="margin-bottom:16px">${esc(t("Oefen deze {n}", { n: Math.min(rows.length, 20) }))}<span class="pijl">${I.pijl}</span></button>${groups}<p class="meta-3">${esc(t("Een vraag verdwijnt hier na twee keer achter elkaar goed."))}</p>` : `<p class="lees">${esc(t("Nog geen fouten om te herhalen. Alles wat je fout doet komt hier terecht, met de uitleg erbij."))}</p>`}`;
    return { titel: t("Fouten"), body, onder: "tab" };
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
  if (S.run && S.run.unit === uid && !S.run.klaar) return;
  S.run = null;
  if (S.route.soort === "herhaling") {
    const set = SRS.dailySet(S.boxes, S.qById);
    const qs = set.vragen.map(id => S.qById[id]).filter(q => q && Q.SUPPORTED.has(q.type));
    if (qs.length) S.run = Q.newRun({ unit: uid, soort: "herhaling", ref: "herhaling", questions: qs });
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
  S.run = Q.newRun({ unit: run.unit, soort: "herstel", questions: qs });
}
function quizEinde(run, u) {
  const s = Q.score(run);
  const st = u ? S.states[u.id] : { staat: "" };
  const fouten = s.fouten.map(f => { const q = S.qById[f.q]; const uq = S.unitById[q.unit] || u; const p = uq ? uq.paginas.find(x => x.id === q.pagina) : null; return `<div class="kaart"><p style="margin:0 0 6px"><strong>${esc(q.stam)}</strong></p><p class="lees" style="margin:0">${esc(q.uitleg.regel)}</p>${p ? `<p class="meta-3" style="margin:6px 0 0"><a href="#/blok/${uq.id}/lezen/${p.id}">${esc(t("Lees {pagina} opnieuw", { pagina: kortePaginanaam(p) }))}</a></p>` : ""}</div>`; }).join("");
  let staatTekst = "";
  if (run.soort === "quiz" && s.gehaald) staatTekst = st.staat === "beheerst" ? t("Blok gehaald.") : st.staat === "voorlopig" ? (st.bevestigd === false && st.runs >= 2 ? t("Nog niet alle vragen uit de pool goed gehad. Nog een quiz, dan is het rond.") : t("Voorlopig gehaald. Doe over minstens 12 uur nog een foutloze quiz, dan is het blok rond.")) : "";
  const body = `<div style="text-align:center;margin:24px 0"><span class="cijfer cijfer-groot">${s.score} <span class="meta-3">${esc(t("van {n}", { n: s.total }))}</span></span><h1 class="kop1" style="margin-top:8px">${esc(s.gehaald ? t("Gehaald") : t("Nog niet"))}</h1><p class="meta">${esc(staatTekst)}</p></div>
    ${s.fouten.length ? `<h2 class="kop2">${esc(s.fouten.length === 1 ? t("Deze ging mis") : t("Deze gingen mis"))}</h2>${fouten}` : ""}`;
  const onder = s.fouten.length && run.soort === "quiz"
    ? `<button class="knop primair groot" data-actie="herstel">${esc(t("Alleen de fouten opnieuw"))}<span class="pijl">${I.pijl}</span></button><div class="knopnaast"><button class="knop omlijnd" data-actie="opnieuw">${esc(t("Hele quiz opnieuw"))}</button><a class="knop omlijnd" href="#/blok/${u.id}">${esc(t("Terug naar blok"))}</a></div>`
    : run.soort === "quiz"
      ? `<a class="knop primair groot" href="${st.staat === "beheerst" ? "#/gehaald/" + u.id : "#/blok/" + u.id}">${esc(st.staat === "beheerst" ? t("Blok gehaald") : t("Terug naar blok"))}<span class="pijl">${I.pijl}</span></a>`
      : `<a class="knop primair groot" href="${run.ref === "fouten" ? "#/fouten" : run.soort === "herhaling" ? "#/route" : "#/blok/" + u.id}">${esc(t("Klaar"))}<span class="pijl">${I.pijl}</span></a>${s.fouten.length && u ? `<button class="knop tekstknop" data-actie="herstel">${esc(t("Nog een herstelronde"))}</button>` : ""}`;
  return { titel: t("Uitslag"), terug: u ? "#/blok/" + u.id : "#/route", sluit: true, midden: esc(run.soort === "quiz" ? t("Quiz-einde") : run.soort === "herhaling" ? t("Herhaling") : t("Herstelronde")), body, onder };
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
  if (a === "frame" && run) { const it = Q.current(run); it.frame = Math.max(0, it.frame + parseInt(el.dataset.n, 10)); render(); return; }
  if (a === "speel" && run) { speelReeks(run); return; }
  if (a === "sluit-viewer") { if (e.target.closest("a")) return; S.viewer = null; render(); return; }
  if (a === "toon-antwoord") { const z = el.closest(".zelftest"); z.querySelector(".antwoord").classList.remove("verborgen"); el.classList.add("verborgen"); return; }
  if (a === "start-examen") { startExamen(); render(); return; }
  if (a === "examen-markeer" && run && run.examen) { Q.markeer(run); render(); return; }
  if (a === "examen-inleveren" && run && run.examen) { await leverIn(); return; }
  if (a === "examen-ga" && run && run.examen) {
    const n = parseInt(el.dataset.n, 10);
    if (n >= run.items.length) { Q.park(run); run.overzicht = true; }
    else { run.overzicht = false; Q.ga(run, n); }
    render();
    return;
  }
  if (a === "kies" && run) { const t = Q.current(run).q.type; Q.choose(run, el.dataset.id); if (t !== "meervoudig" && t !== "volgorde" && run.gekozen.length === 1 && run.gekozen[0] === el.dataset.id && el.classList.contains("gekozen")) { /* second tap on the selected option confirms */ Q.check(run, S.history); } render(); return; }
  if (a === "controleer" && run) { Q.check(run, S.history); render(); return; }
  if (a === "fouttype" && run) { Q.setFouttype(run, el.dataset.type); render(); return; }
  if (a === "volgende" && run) { if (Q.next(run)) await afronden(); else render(); return; }
  if (a === "herstel" && run) { herstelronde(run); render(); return; }
  if (a === "opnieuw" && run) { S.run = null; startRunIfNeeded(); render(); return; }
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
  if (a === "wis") { if (confirm(t("Alle pogingen en instellingen op dit apparaat wissen?"))) { await store.wipe(); await refresh(); toast(t("Gewist")); render(); } return; }
  if (a === "exporteer") { const blob = new Blob([JSON.stringify({ attempts: S.attempts, settings: S.settings }, null, 1)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "44-van-de-50-" + new Date().toISOString().slice(0, 10) + ".json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); return; }
  if (a === "update") { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.update(); toast(t("Gecontroleerd. Een nieuwe versie laadt bij de volgende start.")); } render(); return; }
  if (a === "herlaad") { location.reload(); return; }
}
/* een invulvraag verzamelt zijn antwoord terwijl je typt, niet pas bij een klik */
function onInput(e) {
  const el = e.target.closest("[data-actie]");
  if (!el || el.dataset.actie !== "invul" || !S.run) return;
  S.run.gekozen = el.value.trim() ? [el.value.trim()] : [];
  const knop = document.querySelector('[data-actie="controleer"]');
  if (knop) knop.disabled = !Q.ready(S.run);
}
function onChange(e) {
  const el = e.target.closest("[data-actie]");
  if (!el) return;
  if (el.dataset.actie === "twijfel" && S.run) { S.run.twijfel = el.checked; return; }
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
/* a reeks plays its frames once, 1500 ms apart, like the CBR clip; the stepper stays for replays */
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
  navigator.serviceWorker.register("sw.js").catch(() => { /* file:// or unsupported */ });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) toast(t("Nieuwe versie klaar"), t("Herlaad"), "herlaad"); had = true; });
}

boot().catch(err => { app.innerHTML = `<main class="inhoud"><h1 class="kop1">${esc(t("Er ging iets mis bij het laden"))}</h1><p class="lees">${esc(err.message)}</p><p class="meta">${esc(t("Ververs de pagina. Als dat niet helpt: Instellingen, Wis alles."))}</p></main>`; console.error(err); });
