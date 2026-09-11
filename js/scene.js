/* The scene renderer: a scene JSON to an SVG string.

   Top-down, 4:3, viewBox 0 0 400 300. Asphalt, road-marking white, and
   the actor colours from the plan: you are the white car with a small
   blue "jij" mark, other cars grey, the tram yellow, cyclists green,
   pedestrians ink. Signs come from the sprite by <use>. Nothing here is
   themed: the drawing looks the same in light and dark.

   Minimal cut for Phase 1: plus and T junctions, a single roundabout, a
   driveway (uitrit), a straight road; cars, vans, trucks, buses, trams,
   motorbikes, mopeds, bicycles, pedestrians, a horse rider, an emergency
   vehicle, a column; haaientanden, stop line, zebra, cycle crossing, hump,
   block marking, rails; a sign on a post per arm; traffic lights per arm,
   for traffic, for cyclists and for pedestrians; intended-path arrows;
   numbered order badges. See content/schema/SCENES.md for the language. */
const W = 400, H = 300, CX = 200, CY = 150;
const ROAD = 64;            /* width of a two-lane road */
const LANE = ROAD / 2;
const ASFALT = "#2A2F36", ASFALT_ZAND = "#8C7B5C", MARK = "#F7F7F4", BERM = "#B9C3A8", STOEP = "#D6D5CE", FIETSPAD = "#B84A3A";
const KLEUR = { auto: "#8A9099", bestelauto: "#8A9099", vrachtauto: "#7A8088", bus: "#7A8088", tram: "#F2B705", motorfiets: "#6B7178", bromfiets: "#6B7178", fiets: "#1E7F4F", voetganger: "#15181C", ruiter: "#7A5A3A", hulpdienst: "#F7F7F4", colonne: "#5C6B4A" };
const BLAUW = "#0B5CAD";
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* every arm as a direction: unit vector from the centre outward, and
   the heading (degrees, 0 is up) of traffic approaching the centre */
const ARM = {
  noord: { dx: 0, dy: -1, heading: 180 },
  oost: { dx: 1, dy: 0, heading: 270 },
  zuid: { dx: 0, dy: 1, heading: 0 },
  west: { dx: -1, dy: 0, heading: 90 },
};
/* turning left from arm X you leave via LEFT_OF[X], seen from the driver approaching the centre */
const LEFT_OF = { noord: "oost", oost: "zuid", zuid: "west", west: "noord" };
const RIGHT_OF = { noord: "west", oost: "noord", zuid: "oost", west: "zuid" };
const OPPOSITE = { noord: "zuid", oost: "west", zuid: "noord", west: "oost" };
const rot = (x, y, deg) => { const r = deg * Math.PI / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; };

/* a point on an arm: t is the distance from the centre along the arm,
   s the sideways offset (positive is the right-hand side for traffic
   approaching the centre on that arm) */
function pt(arm, t, s) {
  const a = ARM[arm];
  /* the driver approaches the centre along (-dx, -dy); their right-hand
     side, with y pointing down on screen, is (dy, -dx) */
  const rx = a.dy, ry = -a.dx;
  return [CX + a.dx * t + rx * s, CY + a.dy * t + ry * s];
}
const armLength = arm => (arm === "noord" || arm === "zuid") ? CY : CX;

function roadRect(arm, width, colour, extra = "") {
  /* a rectangle from the centre to the edge along the arm */
  const len = armLength(arm) + 2;
  const [x1, y1] = pt(arm, 0, -width / 2), [x2, y2] = pt(arm, len, -width / 2), [x3, y3] = pt(arm, len, width / 2), [x4, y4] = pt(arm, 0, width / 2);
  return `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="${colour}" ${extra}/>`;
}
function line(p1, p2, stroke, width, dash) {
  return `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linecap="butt"/>`;
}

/* ==== roads ==== */
function drawJunction(s) {
  const arms = s.armen;
  const hoofd = new Set(s.hoofdweg || []);
  const onverhard = new Set(s.onverhard || []);
  const fietspad = new Set(s.fietspad || []);
  let out = "";
  /* verges and cycle paths first, then the roads over them */
  for (const arm of arms) {
    if (fietspad.has(arm)) {
      out += roadRect(arm, ROAD + 44, BERM);
      const [a1, b1] = [pt(arm, ROAD / 2 + 4, ROAD / 2 + 12), pt(arm, armLength(arm) + 2, ROAD / 2 + 12)];
      const [a2, b2] = [pt(arm, ROAD / 2 + 4, -ROAD / 2 - 12), pt(arm, armLength(arm) + 2, -ROAD / 2 - 12)];
      out += line(a1, b1, FIETSPAD, 10) + line(a2, b2, FIETSPAD, 10);
    }
  }
  for (const arm of arms) out += roadRect(arm, ROAD + (hoofd.has(arm) ? 6 : 0), onverhard.has(arm) ? ASFALT_ZAND : ASFALT);
  /* the junction square itself */
  out += `<rect x="${CX - ROAD / 2}" y="${CY - ROAD / 2}" width="${ROAD}" height="${ROAD}" fill="${ASFALT}"/>`;
  /* centre lines: dashed, stopping short of the junction; solid edge lines on the priority road */
  for (const arm of arms) {
    if (onverhard.has(arm)) continue;
    out += line(pt(arm, ROAD / 2 + 6, 0), pt(arm, armLength(arm) + 2, 0), MARK, 1.5, "10 8");
  }
  return out;
}
function drawRoundabout(s) {
  const R = 58, ISLAND = 28;
  let out = "";
  const fietspad = new Set(s.fietspad || []);
  for (const arm of s.armen) {
    if (fietspad.has(arm)) {
      out += roadRect(arm, ROAD + 44, BERM);
      out += line(pt(arm, R + 2, ROAD / 2 + 12), pt(arm, armLength(arm) + 2, ROAD / 2 + 12), FIETSPAD, 10);
      out += line(pt(arm, R + 2, -ROAD / 2 - 12), pt(arm, armLength(arm) + 2, -ROAD / 2 - 12), FIETSPAD, 10);
    }
  }
  if (fietspad.size) out += `<circle cx="${CX}" cy="${CY}" r="${R + 26}" fill="none" stroke="${FIETSPAD}" stroke-width="10"/>`;
  for (const arm of s.armen) out += roadRect(arm, ROAD, ASFALT);
  out += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${ASFALT}"/>`;
  out += `<circle cx="${CX}" cy="${CY}" r="${ISLAND}" fill="${BERM}" stroke="${MARK}" stroke-width="2"/>`;
  for (const arm of s.armen) out += line(pt(arm, R + 4, 0), pt(arm, armLength(arm) + 2, 0), MARK, 1.5, "10 8");
  return out;
}
function drawUitrit(s) {
  /* a through road north-south, a driveway leaving to the east through a sidewalk */
  let out = roadRect("noord", ROAD + 40, STOEP) + roadRect("zuid", ROAD + 40, STOEP);
  out += roadRect("noord", ROAD, ASFALT) + roadRect("zuid", ROAD, ASFALT);
  out += `<rect x="${CX - ROAD / 2}" y="${CY - ROAD / 2}" width="${ROAD}" height="${ROAD}" fill="${ASFALT}"/>`;
  out += line(pt("noord", ROAD / 2, 0), pt("noord", CY + 2, 0), MARK, 1.5, "10 8") + line(pt("zuid", ROAD / 2, 0), pt("zuid", CY + 2, 0), MARK, 1.5, "10 8");
  /* the sidewalk runs on across the driveway over a raised kerb, which is how
     the book draws it on p. 109 and how you recognise an uitrit from a junction */
  out += `<rect x="${CX + ROAD / 2}" y="${CY - 20}" width="${CX + 2}" height="40" fill="#5A606A"/>`;
  out += `<rect x="${CX + ROAD / 2}" y="${CY - 22}" width="20" height="44" fill="${STOEP}" opacity=".6"/>`;
  return out;
}
function drawStraight(s) {
  /* A straight road takes fietspad like a junction arm does. It used to ignore
     the field, so every question about a cyclist on a separate path next to you
     had to lose its drawing or move to a junction it did not need. */
  const fietspad = new Set(s.fietspad || []);
  let out = "";
  for (const arm of ["noord", "zuid"]) {
    out += roadRect(arm, ROAD + (fietspad.has(arm) ? 44 : 40), BERM);
  }
  out += roadRect("noord", ROAD, ASFALT) + roadRect("zuid", ROAD, ASFALT);
  for (const arm of ["noord", "zuid"]) {
    if (!fietspad.has(arm)) continue;
    out += line(pt(arm, 0, ROAD / 2 + 12), pt(arm, armLength(arm) + 2, ROAD / 2 + 12), FIETSPAD, 10);
    out += line(pt(arm, 0, -ROAD / 2 - 12), pt(arm, armLength(arm) + 2, -ROAD / 2 - 12), FIETSPAD, 10);
  }
  out += line(pt("noord", 0, 0), pt("noord", CY + 2, 0), MARK, 1.5, "10 8") + line(pt("zuid", 0, 0), pt("zuid", CY + 2, 0), MARK, 1.5, "10 8");
  return out;
}

/* ==== markings ==== */
function drawMarkering(s) {
  const edge = s.vorm === "rotonde" ? 60 : ROAD / 2;
  let out = "";
  for (const m of s.markering || []) {
    const arm = m.arm;
    switch (m.soort) {
      case "haaientanden": {
        /* a row of triangles across the approaching lane, points toward the junction */
        for (let i = 0; i < 4; i++) {
          const sPos = 4 + i * 7;
          const [ax, ay] = pt(arm, edge + 10, sPos), [bx, by] = pt(arm, edge + 10, sPos + 5), [cx, cy] = pt(arm, edge + 3, sPos + 2.5);
          out += `<polygon points="${ax},${ay} ${bx},${by} ${cx},${cy}" fill="${MARK}"/>`;
        }
        break;
      }
      case "stopstreep": out += line(pt(arm, edge + 6, 1), pt(arm, edge + 6, LANE - 1), MARK, 4); break;
      case "zebrapad": for (let i = 0; i < 6; i++) { const sPos = -LANE + 3 + i * 10.5; out += line(pt(arm, edge + 14, sPos), pt(arm, edge + 14, sPos + 6), MARK, 12); } break;
      case "fietsoversteek": {
        const t = s.vorm === "rotonde" ? edge + 26 : edge + 22;
        for (let i = 0; i < 8; i++) { const sPos = -LANE - 2 + i * 8.5; out += `<rect x="0" y="0" width="4" height="4" fill="${MARK}" transform="translate(${pt(arm, t, sPos)[0]},${pt(arm, t, sPos)[1]}) rotate(${ARM[arm].heading})"/>`; }
        for (let i = 0; i < 8; i++) { const sPos = -LANE - 2 + i * 8.5; out += `<rect x="0" y="0" width="4" height="4" fill="${MARK}" transform="translate(${pt(arm, t + 8, sPos)[0]},${pt(arm, t + 8, sPos)[1]}) rotate(${ARM[arm].heading})"/>`; }
        break;
      }
      case "drempel": out += line(pt(arm, edge + 30, -LANE), pt(arm, edge + 30, LANE), MARK, 3, "6 4") + line(pt(arm, edge + 38, -LANE), pt(arm, edge + 38, LANE), MARK, 3, "6 4"); break;
      case "blokmarkering": for (let i = 0; i < 5; i++) out += line(pt(arm, edge + 10 + i * 14, LANE - 3), pt(arm, edge + 18 + i * 14, LANE - 3), MARK, 6); break;
      case "fietsstrook": out += line(pt(arm, edge, LANE - 5), pt(arm, armLength(arm) + 2, LANE - 5), FIETSPAD, 9) + line(pt(arm, edge, LANE - 10), pt(arm, armLength(arm) + 2, LANE - 10), MARK, 1, "6 6"); break;
      case "fietsstrook-doorgetrokken": out += line(pt(arm, edge, LANE - 5), pt(arm, armLength(arm) + 2, LANE - 5), FIETSPAD, 9) + line(pt(arm, edge, LANE - 10), pt(arm, armLength(arm) + 2, LANE - 10), MARK, 1.4); break;
      case "rails": {
        for (const off of [-LANE / 2 - 4, -LANE / 2 + 4, LANE / 2 - 4, LANE / 2 + 4]) out += line(pt(arm, 0, off), pt(arm, armLength(arm) + 2, off), "#9AA0A6", 1.2);
        break;
      }
      case "verdrijvingsvlak": for (let i = 0; i < 6; i++) out += line(pt(arm, edge + 6 + i * 10, -6), pt(arm, edge + 14 + i * 10, 6), MARK, 2); break;
    }
  }
  return out;
}

/* The little white plate under a sign. So far the language only knows one kind,
   "verloop voorrangsweg", and that is exactly the one the exam leans on: it is
   how you tell an afbuigende voorrangsweg from a straight one. The plate draws
   the same bend the map already shows, by following the hoofdweg arms, which is
   what the real sign does too.

   It used to be ignored in silence, so five drawings had an alt that promised a
   plate nobody drew, and three questions leaned on it in their stem. */
function onderbordPlaatje(s, b, x, yTop) {
  if (!b.onderbord) return "";
  const hoofd = (s.hoofdweg || []).filter(a => ARM[a]);
  const w = 26, h = 16, cy = yTop + h / 2;
  let uit = `<g class="scene-onderbord"><rect x="${(x - w / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${w}" height="${h}" rx="1.5" fill="${MARK}" stroke="#15181C" stroke-width="1"/>`;
  if (hoofd.length) {
    for (const arm of hoofd) {
      const a = ARM[arm];
      uit += `<line x1="${x.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(x + a.dx * 9).toFixed(1)}" y2="${(cy + a.dy * 5.5).toFixed(1)}" stroke="#15181C" stroke-width="3" stroke-linecap="round"/>`;
    }
  }
  return uit + "</g>";
}

/* ==== signs on posts ==== */
/* ==== traffic lights ====

   Signal colours, not the colours of the interface: a light is red, amber
   or green because that is what it is, and inside a quiz that says nothing
   about your answer. A pedestrian light has two lamps, everything else
   three, and the head sits on the right-hand side of the arm it governs. */
const LICHT = { rood: "#E02020", geel: "#F2B705", groen: "#2FA84F" };
const LICHT_UIT = "#20242A";
function lichtKop(x, y, kleur, soort) {
  const twee = soort === "voetganger";
  const w = twee ? 9 : 10, h = twee ? 17 : 24;
  const lampen = (twee ? ["rood", "groen"] : ["rood", "geel", "groen"]).map((k, i) => {
    const r = twee ? 3 : 3.2;
    const cy = y - h / 2 + (twee ? 5 : 5) + i * (twee ? 8 : 7);
    const aan = k === kleur;
    return `<circle cx="${x}" cy="${cy}" r="${r}" fill="${aan ? LICHT[k] : LICHT_UIT}" ${aan ? `stroke="${LICHT[k]}" stroke-opacity=".45" stroke-width="2.5"` : ""}/>`;
  }).join("");
  return `<g class="scene-licht"><rect x="${x - 1}" y="${y}" width="2" height="10" fill="#555"/><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="2" fill="#15181C" stroke="#3A404A"/>${lampen}</g>`;
}
function drawLichten(s) {
  let out = "";
  const edge = s.vorm === "rotonde" ? 60 : ROAD / 2;
  /* elk soort licht staat op zijn eigen plek langs de arm, anders tekenen
     twee lichten op dezelfde arm over elkaar heen: het autolicht vlak voor
     de streep, het fietslicht daarnaast, het voetgangerslicht bij de stoep */
  for (const l of s.lichten || []) {
    const soort = l.voor || "verkeer";
    const langs = soort === "voetganger" ? edge + 10 : soort === "fiets" ? edge + 26 : edge + 34;
    const zij = soort === "verkeer" ? LANE + 9 : LANE + 23;
    const [x, y] = pt(l.arm, langs, zij);
    out += lichtKop(x, y, l.kleur, soort);
  }
  return out;
}

function drawSigns(s) {
  let out = "";
  const edge = s.vorm === "rotonde" ? 60 : ROAD / 2;
  for (const b of s.borden || []) {
    let x, y;
    if (b.arm === "rotonde") { [x, y] = [CX, CY]; }
    else { [x, y] = pt(b.arm, edge + 24, LANE + 10); }
    const size = 22;
    out += `<g class="scene-bord"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 2}" stroke="#555" stroke-width="2"/><rect x="${x - size / 2 - 1.5}" y="${y - size / 2 - 1.5}" width="${size + 3}" height="${size + 3}" rx="2" fill="${MARK}"/><svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><use href="#sign-${esc(b.code)}" width="100" height="100"/></svg></g>`;
    out += onderbordPlaatje(s, b, x, y + size / 2 + 2);
  }
  return out;
}

/* ==== actors ==== */
const SIZE = { auto: [14, 26], bestelauto: [15, 30], vrachtauto: [16, 44], bus: [16, 48], tram: [14, 64], motorfiets: [7, 18], bromfiets: [6, 14], fiets: [5, 14], voetganger: [8, 8], ruiter: [8, 20], hulpdienst: [14, 28], colonne: [16, 44] };
function actorSymbol(a) {
  const [w, h] = SIZE[a.soort] || SIZE.auto;
  const ego = a.id === "ego";
  const fill = ego ? "#FFFFFF" : (KLEUR[a.soort] || KLEUR.auto);
  let body;
  switch (a.soort) {
    case "voetganger": body = `<circle r="4.2" fill="${fill}"/><circle cy="-1.2" r="1.8" fill="#F2F1EC"/>`; break;
    case "fiets": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="2.5" fill="${fill}"/><circle cy="-3" r="2" fill="#F2F1EC"/>`; break;
    case "motorfiets": case "bromfiets": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="${fill}"/><circle cy="-2" r="2.4" fill="#F2F1EC"/>`; break;
    case "tram": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="#7A5C00" stroke-width="1"/><line x1="${-w / 2 + 2}" y1="${-h / 2 + 10}" x2="${w / 2 - 2}" y2="${-h / 2 + 10}" stroke="#7A5C00" stroke-width="1"/><line x1="${-w / 2 + 2}" y1="${h / 2 - 10}" x2="${w / 2 - 2}" y2="${h / 2 - 10}" stroke="#7A5C00" stroke-width="1"/>`; break;
    case "ruiter": body = `<ellipse rx="${w / 2}" ry="${h / 2}" fill="${fill}"/><circle cy="-4" r="2.4" fill="#F2F1EC"/>`; break;
    case "colonne": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="${fill}"/><rect x="${-w / 2}" y="${-h / 2 - 50}" width="${w}" height="${h}" rx="3" fill="${fill}" opacity=".85"/><rect x="${-w / 2 + 3}" y="${-h / 2 + 4}" width="${w - 6}" height="5" fill="${BLAUW}"/>`; break;
    default: {
      const stroke = ego ? "#5A6068" : "none";
      body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/><rect x="${-w / 2 + 2}" y="${-h / 2 + 6}" width="${w - 4}" height="6" rx="1" fill="rgba(20,24,30,.35)"/><rect x="${-w / 2 + 2}" y="${h / 2 - 9}" width="${w - 4}" height="4" rx="1" fill="rgba(20,24,30,.25)"/>`;
      if (a.soort === "hulpdienst") body += `<rect x="-3" y="-2" width="6" height="4" rx="1" fill="${BLAUW}"/>`;
    }
  }
  if (ego) body += `<circle cy="2" r="2.6" fill="${BLAUW}"/>`;
  /* an indicator: a small yellow block on the side */
  if (a.signaal === "links") body += `<rect x="${-w / 2 - 2}" y="${-h / 2 + 2}" width="3" height="5" fill="#F2B705"/>`;
  if (a.signaal === "rechts") body += `<rect x="${w / 2 - 1}" y="${-h / 2 + 2}" width="3" height="5" fill="#F2B705"/>`;
  return body;
}
/* How far from the centre an actor at afstand 1, 2 or 3 stands on a given arm.

   afstand is an order, not a measurement, so the spacing follows the longest
   vehicle on that arm: a car behind a tram used to be drawn inside it, because
   every actor spaced itself by its own length. And a north or south arm is only
   150 long, so three car lengths ran off the bottom of the 400 by 300 canvas
   and took the white car with them. The step therefore shrinks until the
   furthest actor fits. If the arm is too short to do both, staying in frame
   wins: a few pixels of overlap is a smaller lie than a car nobody can see. */
function armGap(s, arm, dist, h, edge) {
  if (!ARM[arm]) return edge + 13 + h / 2 + (dist - 1) * (h + 22);
  const inBaan = x => !(x.soort === "voetganger" || (x.zijde && (x.soort === "fiets" || x.soort === "bromfiets")));
  const opArm = (s.actoren || []).filter(x => x.arm === arm && inBaan(x));
  const langste = Math.max(SIZE.auto[1], ...opArm.map(x => (SIZE[x.soort] || SIZE.auto)[1]));
  const verste = Math.max(1, ...opArm.map(x => x.afstand || 1));
  const basis = edge + 8 + langste / 2;
  const ruimte = armLength(arm) - langste / 2 - 4;
  const stapNodig = langste + 12;
  const stapPast = verste > 1 ? (ruimte - basis) / (verste - 1) : stapNodig;
  const stap = Math.max(10, Math.min(stapNodig, stapPast));
  return Math.min(basis + (dist - 1) * stap, ruimte);
}
function actorPlace(s, a) {
  /* returns [x, y, heading] */
  const edge = s.vorm === "rotonde" ? 60 : ROAD / 2;
  const [w, h] = SIZE[a.soort] || SIZE.auto;
  if (a.arm === "rotonde") {
    const R = 58 - LANE / 2 - 2;
    const rad = ((a.hoek || 0) - 90) * Math.PI / 180;
    const x = CX + R * Math.cos(rad), y = CY + R * Math.sin(rad);
    /* on a Dutch roundabout traffic runs counter-clockwise: the tangent heading is hoek minus 90 */
    return [x, y, (a.hoek || 0) - 90];
  }
  if (a.arm === "uitrit") {
    const dist = a.afstand || 1;
    return [CX + ROAD / 2 + 22 + (dist - 1) * 30, CY, 270];
  }
  if (s.vorm === "rotonde" && (a.soort === "fiets" || a.soort === "bromfiets" || a.soort === "voetganger") && (a.zijde || a.arm === "fietspad")) {
    /* on the ring path just before the crossing of that arm, riding counter-clockwise like the cars */
    const armAngle = { noord: 0, oost: 90, zuid: 180, west: 270 }[a.arm] || 0;
    const ang = armAngle + 22 + ((a.afstand || 1) - 1) * 18;
    const R = 58 + 26;
    const rad = (ang - 90) * Math.PI / 180;
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad), ang - 90];
  }
  const dist = a.afstand || 1;
  const gap = armGap(s, a.arm, dist, h, edge);
  let side = LANE / 2;
  if (a.soort === "voetganger" || (a.zijde && (a.soort === "fiets" || a.soort === "bromfiets"))) {
    const fp = (s.fietspad || []).includes(a.arm);
    const off = a.soort === "voetganger" ? (fp ? ROAD / 2 + 32 : ROAD / 2 + 10) : ROAD / 2 + 12;
    side = a.zijde === "links" ? -off : off;
    if (a.soort === "voetganger" && !a.zijde) side = off;
  } else if (a.arm === "fietspad") {
    side = ROAD / 2 + 12;
  }
  const [x, y] = pt(a.arm, gap, side);
  return [x, y, ARM[a.arm].heading];
}
function pathArrow(s, a, x, y, heading) {
  if (a.richting === "stil" || a.soort === "voetganger" && !a.richting) return "";
  const edge = s.vorm === "rotonde" ? 60 : ROAD / 2;
  const colour = a.id === "ego" ? BLAUW : (a.soort === "tram" ? "#B08500" : a.soort === "fiets" ? "#1E7F4F" : "#AEB5BD");
  let pts = [];
  if (a.arm === "rotonde") {
    /* along the ring to the exit */
    const R = 58 - LANE / 2 - 2;
    const start = a.hoek || 0;
    const exitAngle = a.uitgang ? { noord: 0, oost: 90, zuid: 180, west: 270 }[a.uitgang] : (start + 270) % 360;
    let ang = start;
    let steps = 0;
    const delta = ((exitAngle - start + 720) % 360) || 360;
    /* counter-clockwise: angles decrease */
    const total = 360 - delta;
    while (steps <= total && steps < 361) {
      const rad = ((start - steps) - 90) * Math.PI / 180;
      pts.push([CX + R * Math.cos(rad), CY + R * Math.sin(rad)]);
      steps += 12;
      ang = start - steps;
    }
    if (a.uitgang) { const e = pt(a.uitgang, 58 + 26, -LANE / 2); pts.push(e); }
  } else if (s.vorm === "rotonde" && (a.soort === "fiets" || a.soort === "bromfiets" || a.soort === "voetganger") && (a.zijde || a.arm === "fietspad")) {
    const armAngle = { noord: 0, oost: 90, zuid: 180, west: 270 }[a.arm] || 0;
    const start = armAngle + 22 + ((a.afstand || 1) - 1) * 18;
    const R = 58 + 26;
    for (let ang = start; ang >= armAngle - 30; ang -= 8) { const rad = (ang - 90) * Math.PI / 180; pts.push([CX + R * Math.cos(rad), CY + R * Math.sin(rad)]); }
  } else if (a.arm === "uitrit") {
    pts = [[x - 14, y], [CX + ROAD / 2 - 6, y], a.richting === "rechts" ? pt("noord", 30, -LANE / 2) : pt("zuid", 30, LANE / 2)];
    if (a.richting === "rechts") pts = [[x - 14, y], [CX + LANE / 2, y], pt("noord", 40, -LANE / 2)];
    else pts = [[x - 14, y], [CX - LANE / 2, y], pt("zuid", 40, -LANE / 2)];
  } else {
    const arm = a.arm;
    const lane = LANE / 2;
    const [w, h] = SIZE[a.soort] || SIZE.auto;
    const front = pt(arm, Math.max(edge + 2, Math.hypot(x - CX, y - CY) - h / 2 - 2), lane);
    if (a.soort === "voetganger" || a.zijde) {
      /* crossing the arm on the sidewalk or cycle path: straight across */
      const side = a.zijde === "links" ? -1 : 1;
      const t = Math.hypot(x - CX, y - CY);
      pts = [[x, y], pt(arm, t, side * 6), pt(arm, t, -side * (Math.abs(pt(arm, 0, 1)[0] - CX) ? 0 : 0) - side * (ROAD / 2 + 14))];
      pts = [[x, y], pt(arm, t, -side * (ROAD / 2 + 14))];
    } else if (a.richting === "rechtdoor") {
      if (s.vorm === "rotonde") pts = [front, pt(arm, 62, lane), pt(arm, 40, -8), pt(OPPOSITE[arm], 40, 8), pt(OPPOSITE[arm], 80, -lane)];
      else pts = [front, pt(arm, -edge - 16, lane), pt(OPPOSITE[arm], edge + 26, -lane)];
    } else if (a.richting === "rechts") {
      const to = RIGHT_OF[arm];
      pts = [front, pt(arm, edge - 8, lane), pt(to, edge + 4, -lane), pt(to, edge + 26, -lane)];
    } else if (a.richting === "links") {
      const to = LEFT_OF[arm];
      pts = [front, pt(arm, edge - 10, lane), pt(arm, -4, lane), pt(to, edge - 2, -lane), pt(to, edge + 26, -lane)];
    } else if (a.richting === "keren") {
      pts = [front, pt(arm, edge - 12, lane), pt(arm, -6, 0), pt(arm, edge - 12, -lane), pt(arm, edge + 20, -lane)];
    }
  }
  if (pts.length < 2) return "";
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180 / Math.PI;
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/><polygon points="0,-4 8,0 0,4" fill="${colour}" transform="translate(${last[0].toFixed(1)},${last[1].toFixed(1)}) rotate(${ang.toFixed(1)})"/>`;
}
function drawActors(s) {
  let paths = "", bodies = "", badges = "";
  const order = s.toonVolgorde === false ? [] : (s.volgorde || []);
  for (const a of s.actoren) {
    const [x, y, heading] = actorPlace(s, a);
    paths += pathArrow(s, a, x, y, heading);
    bodies += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${heading})">${actorSymbol(a)}</g>`;
    if (a.id === "ego") {
      const [w] = SIZE[a.soort] || SIZE.auto;
      const lx = x + w / 2 + 6, anchor = lx > W - 30 ? "end" : "start";
      bodies += `<text x="${(anchor === "end" ? x - w / 2 - 6 : lx).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="12" fill="${BLAUW}">jij</text>`;
    }
    const n = order.indexOf(a.id);
    if (n >= 0) badges += `<g transform="translate(${(x - 16).toFixed(1)},${(y - 14).toFixed(1)})"><circle r="8" fill="${BLAUW}"/><text y="3.5" text-anchor="middle" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="11" fill="#fff">${n + 1}</text></g>`;
  }
  return paths + bodies + badges;
}

/* ==== the whole scene ==== */
export function sceneSvg(s, attrs = "") {
  let roads;
  if (s.vorm === "rotonde") roads = drawRoundabout(s);
  else if (s.vorm === "uitrit") roads = drawUitrit(s);
  else if (s.vorm === "recht") roads = drawStraight(s);
  else roads = drawJunction(s);
  return `<svg viewBox="0 0 ${W} ${H}" class="scene" role="img" aria-label="${esc(s.alt)}" ${attrs}>
<rect width="${W}" height="${H}" fill="${BERM}"/>
${roads}${drawMarkering(s)}${drawSigns(s)}${drawLichten(s)}${drawActors(s)}
</svg>`;
}

/* a plate with the scene inside, plus the enlarge control */
export function scenePlate(s, small) {
  return `<div class="plaat beeldplaat scene-plaat ${small ? "klein" : ""}"><button type="button" class="scene-knop" data-actie="bekijk-scene" data-scene="${esc(s.id)}" aria-label="Tekening vergroten">${sceneSvg(s)}</button></div>`;
}
