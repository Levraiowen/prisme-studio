// Banc de robustesse : fait passer des tableaux pieges (vides, constants, colineaires, texte, unicode, extremes...)
// dans tout le pipeline du moteur. Un message d'erreur explicite (Error en francais) est accepte ;
// une exception JavaScript (TypeError, RangeError...) ou un resultat non fini est un echec.
//   node tests/robustness.mjs
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = JSON.parse(fs.readFileSync(path.join(root, "src/core/order.json"), "utf8"));
const stubs = `const matchMedia = () => ({ matches: true }), document = { querySelector: () => null, documentElement: { dataset: {} } }, getComputedStyle = () => ({ getPropertyValue: () => "" }), window = {};
const Papa = { parse: (t, o) => { const d = o && o.delimiter || ([",", ";", "\\t", "|"].map(c => [c, t.split("\\n")[0].split(c).length]).sort((a, b) => b[1] - a[1])[0][0]); return { data: t.split(/\\r?\\n/).filter(l => l.trim() !== "").map(l => l.split(d)) }; } };
const state = { axisNames: {} };\n`;
const body = String.raw`
const rnd = mulberry(99), g = () => gauss(rnd), csv = rows => rows.map(r => r.join(",")).join("\n");
const num = (n, p, f = (i, j) => g()) => [range(p).map(j => "V" + (j + 1)), ...range(n).map(i => range(p).map(j => f(i, j)))];
const CASES = {
  "en-têtes seuls": "a,b,c",
  "une ligne": "a,b,c\n1,2,3",
  "deux lignes": "a,b,c\n1,2,3\n4,5,7",
  "trois lignes": "a,b,c\n1,2,3\n4,5,7\n2,9,1",
  "colonne constante": csv(num(30, 4, (i, j) => (j === 2 ? 5 : g()))),
  "deux variables parfaitement corrélées": csv([["x", "y"], ...range(20).map(i => [i * i, 2 * i * i + 1])]),
  "trois variables dont deux identiques": csv([["x", "y", "z"], ...range(30).map(i => { const a = g(); return [a, a, g()]; })]),
  "colonne entièrement vide": csv([["a", "b", "c", "vide"], ...range(25).map(() => [g(), g(), g(), ""])]),
  "colonne __proto__": csv([["__proto__", "constructor", "b", "c"], ...range(25).map(() => [g(), g(), g(), g()])]),
  "unicode et doublons": csv([["Âge 👤", "Âge 👤", "Revenu (€)", "Catégorie", "Ville"], ...range(40).map(i => [20 + i, 30 + i % 7, 1000 + 50 * g(), ["α", "β", "γ"][i % 3], ["Paris", "Lyon"][i % 2]])]),
  "formats métier (virgule, %, €, espaces)": "Produit;Prix;Taux;Marge\n" + range(30).map(i => "P" + i + ";" + (1000 + i * 37) + " €;" + (i % 9) + ",5 %;1 2" + (i % 10) + "4,50").join("\n"),
  "qualitative à une modalité": csv([["a", "b", "c"], ...range(30).map(i => ["X", ["u", "v"][i % 2], ["p", "q", "r"][i % 3]])]),
  "qualitatives fortement fragmentées": csv([["id", "texte", "cat", "cat2", "cat3"], ...range(800).map(i => [i, "libellé " + i, ["a", "b"][i % 2], ["x", "y", "z"][i % 3], ["m", "n"][(i >> 1) % 2]])]),
  "colonne mixte 80 % nombres": csv([["m", "a", "b"], ...range(40).map(i => [i % 5 === 0 ? "n/a" : i, g(), g()])]),
  "tableau croisé 2 x 2": "Ligne,A,B\nL1,10,20\nL2,30,5",
  "tableau croisé avec ligne nulle": "Ligne,A,B,C\nL1,10,20,3\nL2,0,0,0\nL3,5,6,40",
  "tableau croisé avec négatif": "Ligne,A,B\nL1,10,-2\nL2,3,4",
  "valeurs gigantesques": csv(num(40, 3, (i, j) => (j === 0 ? (1 + rnd()) * 1e200 : g()))),
  "valeurs minuscules": csv(num(40, 3, (i, j) => (j === 0 ? rnd() * 1e-200 : g()))),
  "Infinity et NaN textuels": csv([["a", "b", "c"], ...range(30).map(i => [i % 7 === 0 ? "Infinity" : i % 11 === 0 ? "NaN" : g(), g(), g()])]),
  "plus de variables que d'individus": csv(num(12, 40)),
  "150 variables": csv(num(300, 150, (i, j) => (j % 5) * 0.4 * (i % 3) + g())),
  "identifiant numérique": csv([["id", "x", "y", "z"], ...range(50).map(i => [1000 + i, g(), g(), g()])]),
  "index pandas": csv([["Unnamed: 0", "x", "y", "z"], ...range(50).map(i => [i, g(), g(), g()])]),
  "dates ISO": csv([["date", "x", "y", "z"], ...range(50).map(i => ["2024-01-" + String(1 + i % 28).padStart(2, "0"), g(), g(), g()])]),
  "beaucoup de manquants": csv(num(60, 5, (i, j) => (rnd() < 0.45 ? "" : g()))),
  "points identiques": csv(num(20, 3, (i, j) => (i < 18 ? 1 + j : 2 + j * i))),
  "tout qualitatif, 5 variables": csv([["a", "b", "c", "d", "e"], ...range(120).map(i => range(5).map(j => "m" + ((i * (j + 3)) % (j + 2))))]),
  "2 qualitatives seulement": csv([["a", "b"], ...range(80).map(i => ["r" + (i % 4), "c" + (i % 3)])]),
  "1 quantitative seulement": csv([["a", "g"], ...range(30).map(i => [g(), "x" + (i % 2)])]),
};
let fails = 0, checks = 0;
const finiteDeep = (x, d = 0) => { if (d > 3 || x == null) return true; if (typeof x === "number") return !Number.isNaN(x); if (ArrayBuffer.isView(x) || Array.isArray(x)) { for (let i = 0; i < Math.min(x.length, 400); i++) if (!finiteDeep(x[i], d + 1)) return false; return true; } return true; };
const bad = e => !(e instanceof Error) || e.constructor !== Error;   // TypeError, RangeError... = defaut du code
for (const [name, text] of Object.entries(CASES)) {
  const log = []; let t, ty;
  try { t = parseCSV(text, name + ".csv"); ty = detect(t); log.push("types q=" + ty.quanti.length + " l=" + ty.quali.length + (ty.ident ? " id=" + ty.ident : "") + (ty.text && ty.text.length ? " texte=" + ty.text.length : "")); }
  catch (e) { checks++; if (bad(e)) { fails++; console.log("✗", name, "lecture :", e.stack.split("\n").slice(0, 3).join(" | ")); } else console.log("·", name, "→ refusé :", e.message); continue; }
  // qualite, dates, et chaque colonne essayee comme cible (arbre compris)
  checks++;
  try { qualityReport(t, ty); for (const c of t.columns) { try { targetRun(t, { target: c, cols: t.columns.filter(x => x !== c), depth: 3 }); } catch (e) { if (bad(e)) throw e; } }
    const dc = dateColumns(t); if (dc.length) deriveDate({ ...t, rows: t.rows.map(r => ({ ...r })) }, dc[0]); log.push("qualité et cibles ok"); }
  catch (e) { if (bad(e)) { fails++; console.log("✗", name, "qualité/cible :", e.stack.split("\n").slice(0, 4).join(" | ")); } else log.push("qualité/cible refusé : " + e.message); }
  for (const m of ["ACP", "ACM", "AFC", "AFDM"]) {
    checks++;
    try {
      const tab = isContingency(t, ty);
      const params = m === "AFDM" ? { ident: ty.ident, vars: ty.quanti.concat(ty.quali), color: null } : m === "ACP" ? { ident: ty.ident, vars: ty.quanti.slice(), color: ty.quali[0] || null }
        : m === "ACM" ? { ident: ty.ident, vars: ty.quali.slice() }
        : { mode: tab ? "tableau" : "brut", ident: ty.ident, vars: ty.quanti.slice(), rowVar: ty.quali[0] || null, colVar: ty.quali[1] || null };
      const mi = applyMissing(t, m === "ACM" ? "modal" : "pca", params, m), w = mi.table;
      const res = m === "ACP" ? runACP(w, params) : m === "ACM" ? runACM(w, params) : m === "AFDM" ? runAFDM(w, params) : runAFC(w, params);
      if (!(res.nAxes >= 1 && res.nAxes <= res.q)) throw new TypeError("nAxes hors bornes : " + res.nAxes + " / q = " + res.q);
      for (const k of ["vals", "pct", "cum", "F"]) if (!finiteDeep(res[k])) throw new TypeError("valeur non finie dans " + k);
      if (m !== "AFC" && !finiteDeep(res.cos2)) throw new TypeError("cos2 non fini");
      res.supp = supplementary(res, w, [], []); interpret(res); inertiaFlows(res);
      const hc = m !== "AFC" && res.n >= 6 ? hcpc(res) : null; if (hc && !(hc.R2 >= 0 && hc.R2 <= 1 + 1e-9)) throw new TypeError("R² HCPC hors [0,1] : " + hc.R2);
      const sc = m === "ACP" ? scagAll(res) : [];
      if (m === "ACP" || m === "AFDM") { if (res.nAxes < res.q) { const dq = diagTQ(res); if (!Number.isFinite(dq.ucT)) throw new TypeError("limite T² non finie"); } shepard(res, Math.min(2, res.q)); if (res.q >= 2) bootLoadings(res, 5); }
      const ins = buildInsights(res, w, hc, sc);
      if (m !== "AFC") { const sel = new Set(range(Math.max(1, Math.floor(res.n / 3)))); describeSubset(w, res.rowsKept.map(i => w.rows[i]), sel, {}); }
      log.push(m + " ok (" + res.q + " axes, " + ins.length + " insights)");
    } catch (e) { if (bad(e)) { fails++; console.log("✗", name, m, ":", e.stack.split("\n").slice(0, 4).join(" | ")); } else log.push(m + " refusé : " + e.message); }
  }
  console.log("·", name, "→", log.join(" · "));
}
console.log("\n" + (checks - fails) + " cas sans défaut, " + fails + " défaut(s) sur " + checks);
if (fails) process.exitCode = 1;
`;
const file = path.join(os.tmpdir(), "prisme_robust.mjs");
fs.writeFileSync(file, stubs + CORE.map(f => fs.readFileSync(path.join(root, "src/core", f), "utf8")).join("\n").replace(/"use strict";/g, "") + body);
await import(pathToFileURL(file).href);
