/* The checker's second pair of eyes: everything a checker used to find by hand
   and that a machine can find faster.

     node _tools/check-scenes.js            the whole bank plus every batch
     node _tools/check-scenes.js U06        one unit
     node _tools/check-scenes.js content/questions/U06/batch-01.json

   This is not a merge gate. validate.js decides what may be merged; this
   script tells a human where to look. Every line it prints is a question for
   the checker, not a verdict. Some are meant to be answered with "yes, I know,
   that is deliberate".

   What it looks for, in the order the checkers of blocks 3, 4 and 5 ran into
   them:

     1 a slide citation that names the first number of a shared block while the
       sentence really sits under a later slide in that block. The validator
       cannot see this: it accepts any anchor from the whole block.
     2 a colour the renderer never draws. You are the white car, every other car
       is grey, the tram is yellow, cyclists are green, pedestrians are ink.
     3 a question that leans on something the renderer cannot draw at all:
       traffic lights, lane arrows, parked cars, trees, a queue.
     4 a volgorde question whose answer does not match its scene.
     5 a reeks whose frames differ in more than a moment in time.
     6 a pedestrian or cyclist on an arm that you never cross, which usually
       means they were put on the arm they come from instead of the one they
       cross.
     7 a question that says "van links" about somebody the drawing puts on your
       right. Three people found a slip like that by hand, and the last one had
       the arm right and the zijde wrong. Only fires when there is one other
       actor and the sentence naming him also names the side, because "kom jij
       van rechts" is about you and "de voorrangsweg komt van links" is about
       the road.
     8 an actor the renderer draws outside the 400 by 300 canvas, so the white
       car and its "jij" mark are simply not there.
     9 an alt that promises something the renderer never drew. The alt is held
       stricter than a stem: a stem may set a scene in words, an alt says this
       is what you see. */
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const CONTENT = path.join(REPO, "content");
const arg = process.argv[2];

const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const exists = f => fs.existsSync(f);
const listJson = dir => exists(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => path.join(dir, f)) : [];
const normalise = s => String(s == null ? "" : s).normalize("NFD").replace(new RegExp("[\u0300-\u036f]", "g"), "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const meldingen = [];
const meld = (waar, soort, tekst) => meldingen.push({ waar, soort, tekst });

/* ==== the scenes and the questions ==== */
const SCENES = {};
for (const f of listJson(path.join(CONTENT, "scenes"))) SCENES[path.basename(f, ".json")] = readJson(f);

function alleVragen() {
  const uit = [], gezien = new Set();
  /* A merged question sits in the bank and in its batch file at the same time.
     The bank wins, so the same mistake is not reported twice. A batch that is
     being written right now may be half-saved json: skip it and say so. */
  const pak = f => {
    let b;
    try { b = readJson(f); }
    catch (e) { meld(path.relative(REPO, f), "leesfout", "kon dit bestand niet lezen, wordt er misschien net aan geschreven: " + e.message); return; }
    for (const q of b.vragen || []) {
      if (gezien.has(q.id)) continue;
      gezien.add(q.id);
      uit.push({ q, bestand: path.relative(REPO, f) });
    }
  };
  if (arg && arg.endsWith(".json")) { pak(path.resolve(arg)); return uit; }
  for (const f of listJson(path.join(CONTENT, "bank"))) pak(f);
  for (const f of listJson(path.join(CONTENT, "generated"))) pak(f);
  const qdir = path.join(CONTENT, "questions");
  if (exists(qdir)) for (const u of fs.readdirSync(qdir)) for (const f of listJson(path.join(qdir, u))) pak(f);
  return arg ? uit.filter(x => x.q.unit === arg || x.q.id.startsWith(arg)) : uit;
}

/* ==== 1: which slide does an anchor really sit under ==== */
function laadCursus() {
  const cfgPad = path.join(__dirname, "sources.json");
  if (!exists(cfgPad)) return null;
  const cfg = readJson(cfgPad);
  const kies = v => (Array.isArray(v) ? v : [v]).find(f => f && exists(f)) || null;
  const pad = kies(cfg.cursus);
  if (!pad) return null;
  const regels = fs.readFileSync(pad, "utf8").split("\n");

  /* every "## Slide A t/m B" block, with the "### Slide N" subheadings inside it */
  const koppen = [];
  regels.forEach((l, i) => { if (/^#{1,2} /.test(l)) koppen.push(i); });
  const blokken = [];
  koppen.forEach((start, idx) => {
    const m = regels[start].match(/^## Slide (\d+)(?:\s*(?:t\/m|en|tot en met)\s*(\d+))?/);
    if (!m) return;
    const a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
    if (a === b) return; /* a block for one slide cannot be confused */
    const eind = idx + 1 < koppen.length ? koppen[idx + 1] : regels.length;
    const sub = [];
    for (let i = start; i < eind; i++) {
      const s = regels[i].match(/^#{3,} Slide (\d+)/);
      if (s) sub.push({ nummer: parseInt(s[1], 10), regel: i });
    }
    if (sub.length) blokken.push({ van: a, tot: b, start, eind, sub, regels });
  });
  return blokken;
}
const CURSUSBLOKKEN = laadCursus();

function echteSlide(slide, anker) {
  if (!CURSUSBLOKKEN) return null;
  const blok = CURSUSBLOKKEN.find(b => slide >= b.van && slide <= b.tot);
  if (!blok) return null;
  const naald = normalise(anker);
  if (!naald) return null;
  /* walk the subsections and see which one contains the anchor */
  const treffers = [];
  for (let i = 0; i < blok.sub.length; i++) {
    const van = blok.sub[i].regel;
    const tot = i + 1 < blok.sub.length ? blok.sub[i + 1].regel : blok.eind;
    const tekst = " " + normalise(blok.regels.slice(van, tot).join("\n")) + " ";
    if (tekst.includes(" " + naald + " ")) treffers.push(blok.sub[i].nummer);
  }
  if (!treffers.length) return null;            /* sits in the block intro, fine */
  if (treffers.includes(slide)) return null;    /* already right */
  return treffers;
}

/* ==== 2 and 3: words the drawing cannot back up ==== */
const VOERTUIG = "auto|autos|bestelauto|vrachtauto|vrachtwagen|bus|lijnbus|motor|motorfiets|bromfiets|snorfiets|fiets|scooter";
const VERKEERDE_KLEUR = new RegExp("\\b(rode|rood|blauwe|blauw|zwarte|zwart|bruine|oranje|paarse|zilveren|zilvergrijze)\\s+(" + VOERTUIG + ")\\b", "i");

const NIET_TEKENBAAR = [
  [/\bverkeerslicht|stoplicht|\bgroen licht|\brood licht|licht (?:springt|wordt) (?:op )?groen/i, "verkeerslicht, de renderer tekent er geen"],
  [/voorsorteerstro|voorsorteervak|pijl(?:en)? op het wegdek|voorsorteerpijl/i, "voorsorteerstrook of pijl op het wegdek, de renderer tekent die niet"],
  [/geparkeerde (?:auto|wagen)/i, "geparkeerde auto's, de renderer tekent die niet"],
  [/\bbomen\b|\bboom\b|\bheg\b|struiken|gebouw(?:en)?|huizen|flat/i, "landschap of bebouwing, de renderer tekent dat niet"],
  [/\bin een file\b|\bde file\b|rij stilstaande|auto's voor je staan stil/i, "een file, de renderer tekent maar een paar voertuigen"],
  /* "beide rijstroken" van een gewone weg is prima; het gaat om meer dan een
     strook per richting, en dat kent de renderer niet */
  [/matrixbord|vluchtstrook|invoegstrook|uitvoegstrook|spitsstrook|(?:meerdere|twee|drie|extra|tweede|derde)\s+rijstro/i, "meerdere rijstroken of snelwegonderdelen, de renderer kent die niet"],
  [/turborotonde|dubbele rotonde/i, "turborotonde, de renderer kent alleen de enkele rotonde"],
  [/\bmist\b|\bregen\b|\bsneeuw\b|\bnacht\b|in het donker|gladheid/i, "weer of licht, de tekening is altijd droog daglicht"],
];

/* ==== the geometry the renderer uses ==== */
const LINKS_VAN = { noord: "oost", oost: "zuid", zuid: "west", west: "noord" };
const RECHTS_VAN = { noord: "west", oost: "noord", zuid: "oost", west: "zuid" };
const TEGENOVER = { noord: "zuid", oost: "west", zuid: "noord", west: "oost" };

const ARMEN = ["noord", "oost", "zuid", "west"];

/* Where does this actor stand, seen from behind your own steering wheel?

   A vehicle on the arm you would leave by when turning left is on your left.
   Someone crossing your own arm is placed by zijde, where right is the right
   hand side of traffic approaching the junction on that arm, so on your own arm
   that is simply your right. */
function kantVanEgo(ego, a) {
  if (!ARMEN.includes(a.arm)) return null;
  const oversteker = a.soort === "voetganger" || (a.zijde && (a.soort === "fiets" || a.soort === "bromfiets"));
  if (oversteker) {
    if (a.arm !== ego.arm) return null;            /* op een andere arm zegt links of rechts niets */
    return a.zijde === "links" ? "links" : "rechts";
  }
  if (a.arm === ego.arm) return null;              /* voor of achter je, niet links of rechts */
  if (a.arm === LINKS_VAN[ego.arm]) return "links";
  if (a.arm === RECHTS_VAN[ego.arm]) return "rechts";
  if (a.arm === TEGENOVER[ego.arm]) return "tegemoet";
  return null;
}

function uitgangVan(actor) {
  if (!actor || !actor.arm || actor.arm === "rotonde" || actor.arm === "uitrit") return null;
  if (actor.richting === "links") return LINKS_VAN[actor.arm];
  if (actor.richting === "rechts") return RECHTS_VAN[actor.arm];
  if (actor.richting === "rechtdoor") return TEGENOVER[actor.arm];
  return null;
}

/* ==== the checks ==== */
function checkVraag(q, bestand) {
  const waar = q.id + "  (" + bestand + ")";
  const teksten = [q.stam, q.uitleg && q.uitleg.regel, q.uitleg && q.uitleg.waarom, q.uitleg && q.uitleg.valkuil, q.uitleg && q.uitleg.onthoud,
    ...(q.opties || []).flatMap(o => [o.tekst, o.feedback])].filter(t => typeof t === "string");

  /* 1: a slide number that names the block instead of the slide */
  for (const br of q.bronnen || []) {
    if (br.slide === undefined || !br.anker) continue;
    const echt = echteSlide(br.slide, br.anker);
    if (echt) meld(waar, "slide", "citeert slide " + br.slide + " maar de zin staat onder slide " + echt.join(" of ") + ": " + JSON.stringify(br.anker));
  }

  const heeftTekening = !!(q.media && (q.media.scene || q.media.reeks));
  const scenes = q.media && q.media.scene ? [q.media.scene] : (q.media && q.media.reeks) || [];

  if (heeftTekening) {
    /* A colour is wrong wherever it stands: the uitleg may not name a red car
       either, because the learner is looking at a grey one. */
    for (const t of teksten) {
      const m = t.match(VERKEERDE_KLEUR);
      if (m) meld(waar, "kleur", "noemt " + JSON.stringify(m[0]) + " terwijl de renderer alleen wit (jij), grijs, gele tram en groene fietser tekent");
    }
    /* Something the drawing cannot carry is only a problem where the question
       claims the learner sees it: in the stem and in the answers. The uitleg
       quotes the book and may name whatever the book names. A denial is fine
       too: "een kruispunt zonder verkeerslichten" asks for nothing to be drawn. */
    const beweringen = [q.stam, ...(q.opties || []).map(o => o.tekst)].filter(t => typeof t === "string");
    for (const t of beweringen) for (const [re, uitleg] of NIET_TEKENBAAR) {
      const m = t.match(re);
      if (!m) continue;
      const voor = t.slice(Math.max(0, m.index - 22), m.index).toLowerCase();
      if (/\b(geen|zonder|niet)\b\s*$/.test(voor)) continue;
      meld(waar, "tekenbaar", uitleg + ": " + JSON.stringify(t.slice(0, 90)));
      break;
    }
  }

  for (const sid of scenes) {
    const s = SCENES[sid];
    if (!s) { meld(waar, "tekening", "verwijst naar " + sid + " en die bestaat niet"); continue; }

    /* 4: a volgorde question must match its scene exactly */
    if (q.type === "volgorde") {
      if (!s.volgorde) meld(waar, "volgorde", sid + " heeft geen volgorde terwijl de vraag ernaar vraagt");
      else {
        const antwoord = (q.correct || []).join(">");
        if (antwoord !== s.volgorde.join(">")) meld(waar, "volgorde", "antwoord " + antwoord + " wijkt af van de volgorde in " + sid + ": " + s.volgorde.join(">"));
        const actoren = (s.actoren || []).map(a => a.id).sort().join(",");
        const opties = (q.opties || []).map(o => o.id).sort().join(",");
        if (actoren !== opties) meld(waar, "volgorde", "de opties (" + opties + ") zijn niet de actoren van " + sid + " (" + actoren + ")");
      }
      if (s.toonVolgorde !== false) meld(waar, "volgorde", sid + " toont de nummerbollen terwijl de vraag juist om de volgorde vraagt");
    }

    /* 7: does "van links" in the question agree with where the renderer puts him

       Three people have now found a left-right slip by hand, and the last one
       was the subtle kind: the arm was right and the zijde was wrong, so the
       pedestrian crossed from the far side while the explanation said he came
       from the right. This only speaks up when there is one other actor and the
       question says plainly which side he is on, because with two of them the
       words could be about either. */
    const egoActor = (s.actoren || []).find(a => a.id === "ego");
    if (egoActor && ARMEN.includes(egoActor.arm) && (s.vorm === "plus" || s.vorm === "T" || s.vorm === "recht")) {
      const anderen = (s.actoren || []).filter(a => a.id !== "ego");
      if (anderen.length === 1) {
        const a = anderen[0];
        const kant = kantVanEgo(egoActor, a);
        /* Only a sentence that names this actor says anything about him. "Op een
           gelijkwaardig kruispunt kom jij van rechts" is about you, and "de
           voorrangsweg komt van links" is about the road; both used to set this
           check off. */
        const woorden = [a.soort, ...String(a.label || "").split(/\s+/)]
          .map(w => normalise(w)).filter(w => w && w.length > 2 && !["de", "het", "een"].includes(w));
        for (const zin of q.stam.split(/(?<=[.?!])\s+/)) {
          const n = " " + normalise(zin) + " ";
          if (!woorden.some(w => n.includes(" " + w + " "))) continue;
          const zegt = /\bvan links\b/i.test(zin) ? "links"
            : /\bvan rechts\b/i.test(zin) ? "rechts"
              : /\bvan voren\b|\btegemoetkomend|\btegenligger\b/i.test(zin) ? "tegemoet" : null;
          if (!zegt || !kant || zegt === kant) continue;
          const woord = { links: "links van je", rechts: "rechts van je", tegemoet: "tegenover je" }[kant] || kant;
          meld(waar, "kant", sid + ": de zin " + JSON.stringify(zin.trim().slice(0, 60)) + " zet " + a.id + " " + zegt + ", maar de tekening zet hem " + woord);
        }
      }
    }

    /* 6: a pedestrian or cyclist on an arm you never cross */
    const ego = (s.actoren || []).find(a => a.id === "ego");
    const egoUit = uitgangVan(ego);
    if (ego && egoUit && (s.vorm === "plus" || s.vorm === "T")) {
      for (const a of s.actoren || []) {
        const oversteker = a.soort === "voetganger" || (a.zijde && (a.soort === "fiets" || a.soort === "bromfiets"));
        if (!oversteker || a.arm === "rotonde" || a.arm === "uitrit" || a.arm === "fietspad") continue;
        if (a.arm !== ego.arm && a.arm !== egoUit) {
          meld(waar, "arm", sid + ": " + a.id + " steekt arm " + a.arm + " over, maar jij komt van " + ego.arm + " en gaat naar " + egoUit + ", dus je kruist hem nooit");
        }
      }
    }
  }

  /* 5: the frames of a reeks may only differ in the moment */
  if (q.media && q.media.reeks && q.media.reeks.length > 1) {
    const frames = q.media.reeks.map(id => SCENES[id]).filter(Boolean);
    if (frames.length === q.media.reeks.length) {
      const eerste = frames[0];
      for (const f of frames.slice(1)) {
        if ((f.armen || []).join(",") !== (eerste.armen || []).join(",")) meld(waar, "reeks", f.id + " heeft andere armen dan " + eerste.id);
        const ids = x => (x.actoren || []).map(a => a.id).sort().join(",");
        if (ids(f) !== ids(eerste)) meld(waar, "reeks", f.id + " heeft andere actoren dan " + eerste.id);
        for (const a of f.actoren || []) {
          const b = (eerste.actoren || []).find(x => x.id === a.id);
          if (!b) continue;
          for (const veld of ["soort", "arm", "zijde", "uitgang"]) {
            if (a[veld] !== b[veld]) meld(waar, "reeks", f.id + ": " + a.id + " heeft een ander veld " + veld + " dan in " + eerste.id + ", een reeks mag alleen in de tijd verschillen");
          }
        }
      }
    }
  }
}

/* ==== scenes nobody uses ==== */
function checkWezen(vragen, units) {
  const gebruikt = new Set();
  for (const { q } of vragen) {
    if (q.media && q.media.scene) gebruikt.add(q.media.scene);
    if (q.media && q.media.reeks) for (const s of q.media.reeks) gebruikt.add(s);
  }
  for (const u of units) for (const p of u.paginas || []) for (const b of p.body || []) if (b.type === "scene" && b.ref) gebruikt.add(b.ref);
  for (const id of Object.keys(SCENES)) {
    if (arg && !arg.endsWith(".json") && !id.startsWith("S-" + arg)) continue;
    if (!gebruikt.has(id)) meld(id, "wees", "deze tekening wordt door geen enkele vraag of leespagina gebruikt");
  }
}

/* Findings a checker has looked at and deliberately left alone. Without this
   list the script cries wolf and stops being read. Every entry needs a reason,
   so the next checker can disagree with it on purpose instead of by accident. */
function laadUitzonderingen() {
  const f = path.join(__dirname, "check-scenes-ack.json");
  if (!exists(f)) return [];
  const lijst = readJson(f);
  return Array.isArray(lijst) ? lijst : lijst.uitzonderingen || [];
}

/* Render every drawing with the real renderer and look at where things land.
   A north or south arm is only 150 long, so an actor at afstand 3 used to be
   drawn below the bottom of the canvas and simply was not there: no white car,
   no "jij" mark, and an intention arrow coming out of nowhere. Nobody notices
   that by reading json, so the machine looks instead. */
async function checkBuitenBeeld() {
  const bestand = path.join(REPO, "js", "scene.js");
  if (!exists(bestand)) return;
  let sceneSvg;
  try { ({ sceneSvg } = await import(require("url").pathToFileURL(bestand).href)); }
  catch (e) { meld("js/scene.js", "render", "kon de renderer niet laden: " + e.message); return; }
  for (const [id, s] of Object.entries(SCENES)) {
    if (arg && !arg.endsWith(".json") && !id.startsWith("S-" + arg)) continue;
    let svg;
    try { svg = sceneSvg(s); }
    catch (e) { meld(id, "render", "de renderer struikelt over deze tekening: " + e.message); continue; }
    if (/NaN|Infinity/.test(svg)) meld(id, "render", "de tekening bevat NaN of Infinity, er is ergens door nul gedeeld of een veld ontbreekt");
    for (const m of svg.matchAll(/translate\(([-\d.]+),([-\d.]+)\) rotate/g)) {
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      if (x < -8 || x > 408 || y < -8 || y > 308) meld(id, "render", "een actor wordt getekend op x " + x.toFixed(0) + " y " + y.toFixed(0) + ", buiten het doek van 400 bij 300");
    }
  }
}

/* The alt of a drawing is a promise: this is what you see. So it is held to a
   stricter standard than a question stem, which may set a scene in words. An
   alt that names a traffic light, an onderbord or a row of parked cars is
   describing something the renderer never put there. */
function checkAlt() {
  for (const [id, s] of Object.entries(SCENES)) {
    if (arg && !arg.endsWith(".json") && !id.startsWith("S-" + arg)) continue;
    const alt = s.alt || "";
    for (const [re, uitleg] of NIET_TEKENBAAR) {
      const m = alt.match(re);
      if (!m) continue;
      const voor = alt.slice(Math.max(0, m.index - 22), m.index).toLowerCase();
      if (/\b(geen|zonder|niet)\b\s*$/.test(voor)) continue;
      meld(id, "alt", uitleg + ", maar de alt zegt: " + JSON.stringify(alt.slice(Math.max(0, m.index - 30), m.index + 40).trim()));
      break;
    }
  }
}

async function main() {
  const vragen = alleVragen();
  const units = listJson(path.join(CONTENT, "units")).map(readJson);
  for (const { q, bestand } of vragen) checkVraag(q, bestand);
  checkWezen(vragen, units);
  checkAlt();
  await checkBuitenBeeld();

  if (!CURSUSBLOKKEN) console.log("  let op: de cursustranscriptie is niet gevonden, de slidecontrole is overgeslagen");

  const ack = laadUitzonderingen();
  const isBekend = m => ack.some(u => u.soort === m.soort && (m.waar === u.id || m.waar.startsWith(u.id + " ")));
  const open = meldingen.filter(m => !isBekend(m));
  const bekend = meldingen.length - open.length;

  const perSoort = {};
  for (const m of open) (perSoort[m.soort] = perSoort[m.soort] || []).push(m);
  const volgorde = ["leesfout", "render", "slide", "volgorde", "reeks", "arm", "kant", "kleur", "tekenbaar", "alt", "tekening", "wees"];
  for (const soort of volgorde) {
    if (!perSoort[soort]) continue;
    console.log("\n== " + soort + " (" + perSoort[soort].length + ")");
    for (const m of perSoort[soort]) console.log("  " + m.waar + "\n     " + m.tekst);
  }
  const telwoord = n => n === 1 ? "1 ding" : n + " dingen";
  const uitzondering = n => n === 1 ? "1 bekende uitzondering die is overgeslagen" : n + " bekende uitzonderingen die zijn overgeslagen";
  console.log("\n" + vragen.length + " vragen bekeken, " + telwoord(open.length) + " om naar te kijken" +
    (bekend ? ", plus " + uitzondering(bekend) : "") + ".");
  console.log("Dit is geen poort. Elke melding is een vraag aan de checker, geen oordeel.");
  console.log("Bewust zo gelaten? Zet hem met een reden in _tools/check-scenes-ack.json.");
}
main();
