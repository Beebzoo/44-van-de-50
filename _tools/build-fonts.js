/* Fetch the two Barlow faces from Google Fonts and self-host them.

     node _tools/build-fonts.js

   The app is an offline PWA, so the fonts live in assets/fonts/ and the
   service worker precaches them. Barlow and Barlow Semi Condensed are both
   under the SIL Open Font License; the licence text travels with the files
   as assets/fonts/OFL.txt.

   Both latin and latin-ext subsets are fetched so accented Dutch words and
   the odd foreign name never fall back mid-word.

   Safe to re-run. Files already on disk are left alone unless --force. */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const OUT = path.join(REPO, "assets", "fonts");
const FORCE = process.argv.includes("--force");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const FACES = [
  { family: "Barlow", slug: "barlow", weights: [400, 500, 600] },
  { family: "Barlow Semi Condensed", slug: "barlow-semicondensed", weights: [600, 700] },
];
const OFL = "https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt";

const get = async (url, bin) => {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
  return bin ? Buffer.from(await res.arrayBuffer()) : await res.text();
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const rules = [];
  let got = 0, total = 0;
  for (const face of FACES) {
    const axis = face.weights.map(w => "0," + w).join(";");
    const url = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(face.family)
      + ":ital,wght@" + axis + "&display=swap";
    const css = await get(url);
    const blocks = css.split("/*").slice(1).map(b => "/*" + b);
    for (const b of blocks) {
      const subset = (b.match(/^\/\*\s*([a-z-]+)\s*\*\//) || [])[1];
      const weight = (b.match(/font-weight:\s*(\d+)/) || [])[1];
      const src = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
      const range = (b.match(/unicode-range:\s*([^;]+);/) || [])[1];
      if (!subset || !weight || !src || !range) continue;
      if (!["latin", "latin-ext"].includes(subset)) continue;
      const file = `${face.slug}-${weight}-${subset}.woff2`;
      const dest = path.join(OUT, file);
      if (FORCE || !fs.existsSync(dest)) { fs.writeFileSync(dest, await get(src, true)); got++; }
      total++;
      rules.push(`@font-face{font-family:'${face.family}';font-style:normal;font-weight:${weight};`
        + `font-display:swap;src:url(assets/fonts/${file}) format('woff2');unicode-range:${range.trim()}}`);
    }
  }
  if (FORCE || !fs.existsSync(path.join(OUT, "OFL.txt"))) fs.writeFileSync(path.join(OUT, "OFL.txt"), await get(OFL));
  fs.writeFileSync(path.join(OUT, "font-face.css"), rules.join("\n") + "\n");
  const bytes = fs.readdirSync(OUT).filter(f => f.endsWith(".woff2")).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`${total} font files, ${got} downloaded, ${(bytes / 1024).toFixed(0)} KB total. font-face.css written.`);
})().catch(e => { console.error(e); process.exit(1); });
