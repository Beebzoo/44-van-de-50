/* Turn the raw sign files into one clean set and one sprite.

     node _tools/build-signs.js import <ndw-dir> <commons-dir>   raw files -> assets/borden/CODE.svg
     node _tools/build-signs.js sprite                            assets/borden -> assets/signs.svg

   Import normalises every file the same way: one viewBox, Inkscape and
   sodipodi baggage gone, the three or four stray reds and blues mapped to
   the NDW palette (red #c1121c, blue #0e518d, black #2a2d2f, white
   #f7fbf5), then svgo with ids prefixed by the code so two signs never
   collide once they share a document. The cleaned per-sign files are
   committed; the raw sources are not.

   Sprite wraps every cleaned file in <symbol id="sign-CODE" viewBox="...">.
   The app fetches assets/signs.svg once, injects it inline, and draws a
   sign with <use href="#sign-B6"/> in a square slot; the symbol's own
   viewBox and xMidYMid meet keep the real aspect. _tools/build.js runs
   the sprite step. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.join(__dirname, "..");
const BORDEN = path.join(REPO, "assets", "borden");
const [mode, ndwDir, commonsDir] = process.argv.slice(2);

const COLOURS = {
  "#e3001b": "#c1121c", "#ff0000": "#c1121c", "#d40000": "#c1121c", "#cc0000": "#c1121c", "#e30613": "#c1121c",
  "#004d9f": "#0e518d", "#0b5cad": "#0e518d", "#004c99": "#0e518d",
  "#000000": "#2a2d2f", "#000": "#2a2d2f", "#231f20": "#2a2d2f",
  "#ffffff": "#f7fbf5", "#fff": "#f7fbf5",
};

function normaliseSvg(raw, code) {
  let s = raw;
  s = s.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/g, "").replace(/<!\u002d\u002d[\s\S]*?\u002d\u002d>/g, "");
  s = s.replace(/<metadata[\s\S]*?<\/metadata>/g, "").replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/g, "");
  s = s.replace(/<title>[\s\S]*?<\/title>/g, "").replace(/<desc>[\s\S]*?<\/desc>/g, "");
  s = s.replace(/\s(inkscape|sodipodi|xmlns:inkscape|xmlns:sodipodi|xmlns:dc|xmlns:cc|xmlns:rdf|xmlns:svg):?[a-zA-Z-]*="[^"]*"/g, "");
  s = s.replace(/\sxml:space="[^"]*"/g, "");
  /* one viewBox per file, derived from width and height when absent */
  const open = s.match(/<svg[^>]*>/);
  if (!open) throw new Error(code + ": geen <svg>");
  let tag = open[0];
  const attr = n => { const m = tag.match(new RegExp("\\s" + n + "=\"([^\"]*)\"")); return m ? m[1] : null; };
  let vb = attr("viewBox");
  const w = parseFloat(attr("width")), h = parseFloat(attr("height"));
  if (!vb) {
    if (!w || !h) throw new Error(code + ": geen viewBox en geen width/height");
    vb = "0 0 " + w + " " + h;
  }
  tag = tag.replace(/\s(width|height|viewBox|x|y|id|version|baseProfile|enable-background)="[^"]*"/g, "");
  tag = tag.replace(/<svg/, '<svg viewBox="' + vb + '"');
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(tag)) tag = tag.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  s = s.replace(open[0], tag);
  /* colours: lowercase every hex, then map the strays onto the palette */
  s = s.replace(/#[0-9A-Fa-f]{3,6}\b/g, m => { const l = m.toLowerCase(); return COLOURS[l] || l; });
  return s.replace(/\n\s*\n/g, "\n").trim() + "\n";
}

function importAll() {
  if (!ndwDir || !commonsDir) { console.error("gebruik: node _tools/build-signs.js import <ndw-dir> <commons-dir>"); process.exit(1); }
  fs.mkdirSync(BORDEN, { recursive: true });
  const sources = {};
  for (const [dir, label] of [[ndwDir, "ndw"], [commonsDir, "commons"]]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".svg")) continue;
      let code = path.basename(f, ".svg");
      if (code === "onbekend") continue;
      code = code.replace(/^c22b$/, "C22b");
      /* Commons wins for the codes we fetched on purpose; NDW for the rest */
      if (sources[code] && label === "ndw") continue;
      sources[code] = { file: path.join(dir, f), from: label };
    }
  }
  let n = 0;
  for (const [code, src] of Object.entries(sources)) {
    try {
      fs.writeFileSync(path.join(BORDEN, code + ".svg"), normaliseSvg(fs.readFileSync(src.file, "utf8"), code));
      n++;
    } catch (e) { console.log("  overgeslagen " + code + ": " + e.message); }
  }
  console.log(n + " borden genormaliseerd naar assets/borden");

  /* svgo: keep the viewBox, prefix ids with the code, two decimals */
  const cfg = path.join(REPO, "_tools", "svgo.config.js");
  fs.writeFileSync(cfg, `module.exports = {
  multipass: true,
  plugins: [
    { name: "preset-default", params: { overrides: { removeViewBox: false, cleanupIds: { minify: false }, convertPathData: { floatPrecision: 2 }, cleanupNumericValues: { floatPrecision: 2 } } } },
    { name: "prefixIds", params: { prefix: (node, info) => require("path").basename(info.path, ".svg").replace(/[^A-Za-z0-9]/g, "_"), delim: "-" } },
    "removeDimensions",
  ],
};
`);
  execFileSync("npx", ["--yes", "svgo@3.3.2", "--config", cfg, "-f", BORDEN, "-o", BORDEN, "--quiet"], { stdio: "inherit", cwd: REPO });
  const bytes = fs.readdirSync(BORDEN).filter(f => f.endsWith(".svg")).reduce((a, f) => a + fs.statSync(path.join(BORDEN, f)).size, 0);
  console.log("svgo klaar, " + (bytes / 1024).toFixed(0) + " KB in " + Object.keys(sources).length + " bestanden");

  /* licence note for the Commons files */
  const licFile = path.join(commonsDir, "licences.json");
  if (fs.existsSync(licFile)) {
    const lic = JSON.parse(fs.readFileSync(licFile, "utf8"));
    const rows = Object.entries(lic).sort().map(([c, l]) => "| " + c + " | " + l.file.replace(/_/g, " ") + " | " + l.licence + " | " + l.artist.replace(/\|/g, "/").slice(0, 60) + " |");
    const sep = "|" + Array(4).fill("-".repeat(3)).join("|") + "|";
    fs.writeFileSync(path.join(BORDEN, "LICENTIES.md"), "# Herkomst van de borden\n\nDe meeste borden komen uit de MIT-gelicentieerde set van NDW (github.com/ndwnu/qgis-verkeersborden-style). De onderstaande bestanden komen van Wikimedia Commons, met de licentie zoals Commons die vermeldt. Verkeersborden zijn in Nederland vrij van auteursrecht (Auteurswet artikel 11); de licentie geldt voor de tekening.\n\n| Code | Bestand op Commons | Licentie | Maker |\n" + sep + "\n" + rows.join("\n") + "\n");
  }
}

function sprite() {
  const files = fs.readdirSync(BORDEN).filter(f => f.endsWith(".svg")).sort();
  const symbols = [];
  for (const f of files) {
    const code = path.basename(f, ".svg");
    const s = fs.readFileSync(path.join(BORDEN, f), "utf8");
    const open = s.match(/<svg[^>]*>/);
    const vb = (open[0].match(/viewBox="([^"]*)"/) || [])[1];
    if (!vb) { console.log("  geen viewBox: " + f); continue; }
    const inner = s.slice(open.index + open[0].length).replace(/<\/svg>\s*$/, "").trim();
    symbols.push('<symbol id="sign-' + code + '" viewBox="' + vb + '">' + inner + "</symbol>");
  }
  const out = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:none" aria-hidden="true">\n' + symbols.join("\n") + "\n</svg>\n";
  fs.writeFileSync(path.join(REPO, "assets", "signs.svg"), out);
  const manifestFile = path.join(REPO, "content", "signs", "manifest.json");
  if (fs.existsSync(manifestFile)) {
    const m = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const have = new Set(files.map(f => path.basename(f, ".svg")));
    const coded = m.borden.filter(b => !b.zonderCode);
    const missing = coded.filter(b => !have.has(b.code)).map(b => b.code);
    const extra = [...have].filter(c => !m.borden.some(b => b.code === c));
    console.log("sprite: " + symbols.length + " symbolen, " + (out.length / 1024).toFixed(0) + " KB; " + (coded.length - missing.length) + " van " + coded.length + " gecodeerde borden uit het boek hebben een tekening");
    if (missing.length) console.log("  zonder tekening: " + missing.join(", "));
    if (extra.length) console.log("  in sprite maar niet in het boek: " + extra.join(", "));
  }
  return symbols.length;
}

if (require.main === module) {
  if (mode === "import") importAll();
  else if (mode === "sprite") sprite();
  else { console.error("gebruik: node _tools/build-signs.js import <ndw> <commons> | sprite"); process.exit(1); }
}
module.exports = { sprite };
