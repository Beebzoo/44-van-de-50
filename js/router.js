/* Hash router. Routes are plain strings after #/ and every screen is
   reachable by URL, so the phone's back button and a bookmark both work.

     #/route                 home
     #/leren                 all units
     #/blok/U01              unit overview
     #/blok/U01/lezen/U01-P02  a reading page
     #/quiz/U01              a quiz for the unit (or herstel, fouten)
     #/borden                catalogue
     #/borden/B6             one sign
     #/fouten                error log
     #/notities              your notes
     #/instellingen          settings */
export function parse(hash) {
  const parts = (hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const [a, b, c, d] = parts;
  if (!a || a === "route") return { name: "route" };
  if (a === "leren") return { name: "leren" };
  if (a === "blok" && b && c === "lezen") return { name: "lezen", unit: b, pagina: d || null };
  if (a === "blok" && b) return { name: "blok", unit: b };
  if (a === "quiz" && b) return { name: "quiz", unit: b, soort: c || "quiz" };
  if (a === "borden" && b) return { name: "bord", code: decodeURIComponent(b) };
  if (a === "borden") return { name: "borden", familie: b || null };
  if (a === "examen") return { name: "examen" };
  if (a === "fouten") return { name: "fouten" };
  if (a === "notities") return { name: "notities" };
  if (a === "instellingen") return { name: "instellingen" };
  if (a === "gehaald" && b) return { name: "gehaald", unit: b };
  return { name: "route" };
}
export const go = hash => { location.hash = hash.startsWith("#") ? hash : "#/" + hash; };
export const replace = hash => history.replaceState(null, "", "#/" + hash.replace(/^#\/?/, ""));
export function listen(fn) {
  addEventListener("hashchange", () => fn(parse(location.hash)));
  fn(parse(location.hash));
}
