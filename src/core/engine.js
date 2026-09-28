"use strict";
/* ============================================================================
   Prisme : ACP, ACM et AFC dans le navigateur, avec espace factoriel 3D.
   Regles de lecture du cours : Kaiser + coude, contributions > seuil moyen,
   cote de l'axe donne par le signe, cos2 pour la qualite de representation.
   ============================================================================ */

/* ------------------------------------------------------------------ exemples */
const EXEMPLES = {
  luxe: { label: "Vêtements de luxe", sub: "50 pièces × 7 mesures", m: "ACP", file: "vetements_luxe.csv", csv:
`Piece,Famille,Prix_kEUR,Poids_g,Heures_fabrication,Pct_travail_main,Nb_matieres_premieres,Production_annuelle,Delai_attente_mois
Foulard_soie_01,Foulard soie,0.55,141,2.8,21,2,8220,1.4
Foulard_soie_02,Foulard soie,0.37,210,3.5,25,3,12280,0.8
Foulard_soie_03,Foulard soie,0.19,113,3.1,19,2,7130,0.0
Foulard_soie_04,Foulard soie,0.24,130,2.1,5,2,20070,0.4
Foulard_soie_05,Foulard soie,0.29,112,4.7,51,2,3720,0.0
Foulard_soie_06,Foulard soie,0.56,89,5.2,39,2,4650,1.5
Denim_capsule_01,Denim capsule,1.84,950,7.0,22,3,3600,8.9
Denim_capsule_02,Denim capsule,2.06,970,6.9,30,4,2270,6.6
Denim_capsule_03,Denim capsule,0.73,1420,4.0,7,4,13790,4.1
Denim_capsule_04,Denim capsule,1.35,1030,7.2,16,3,5330,4.6
Denim_capsule_05,Denim capsule,0.65,840,3.9,18,4,9010,3.9
Denim_capsule_06,Denim capsule,1.18,1560,5.9,13,5,4790,8.7
Chemise_sur_mesure_01,Chemise sur mesure,0.52,340,16.6,66,3,830,0.0
Chemise_sur_mesure_02,Chemise sur mesure,0.61,280,11.4,47,1,1150,0.7
Chemise_sur_mesure_03,Chemise sur mesure,0.39,270,14.4,66,1,940,0.0
Chemise_sur_mesure_04,Chemise sur mesure,1.44,290,38.6,91,2,220,1.1
Chemise_sur_mesure_05,Chemise sur mesure,1.04,360,22.5,82,2,470,1.6
Chemise_sur_mesure_06,Chemise sur mesure,0.8,183,14.7,69,1,800,1.1
Escarpins_01,Escarpins,3.14,470,10.4,37,1,1890,8.2
Escarpins_02,Escarpins,2.85,710,11.9,49,4,4220,7.6
Escarpins_03,Escarpins,2.06,470,11.5,45,3,2710,6.8
Escarpins_04,Escarpins,4.06,660,34.0,91,4,430,4.9
Escarpins_05,Escarpins,1.56,980,11.9,46,5,1430,2.2
Escarpins_06,Escarpins,3.17,660,14.3,46,3,1330,6.4
Sac_cuir_01,Sac cuir,10.27,1170,22.9,91,4,2060,7.0
Sac_cuir_02,Sac cuir,11.11,1510,25.7,67,5,1890,7.1
Sac_cuir_03,Sac cuir,9.96,1790,15.4,59,5,2120,11.7
Sac_cuir_04,Sac cuir,7.33,760,11.7,51,2,5380,11.3
Sac_cuir_05,Sac cuir,7.85,1060,15.0,46,4,3130,11.2
Sac_cuir_06,Sac cuir,10.9,1100,31.9,82,4,460,7.9
Sac_cuir_07,Sac cuir,5.34,1170,32.2,75,4,1650,3.3
Sac_cuir_08,Sac cuir,15.84,1040,17.4,70,4,2070,15.1
Costume_sur_mesure_01,Costume sur mesure,21.32,1150,30.7,84,3,210,10.3
Costume_sur_mesure_02,Costume sur mesure,2.08,950,37.0,67,3,970,0.7
Costume_sur_mesure_03,Costume sur mesure,5.3,890,47.9,81,3,107,1.8
Costume_sur_mesure_04,Costume sur mesure,4.07,930,57.0,83,4,260,0.8
Costume_sur_mesure_05,Costume sur mesure,3.41,1110,35.2,80,3,320,1.2
Costume_sur_mesure_06,Costume sur mesure,5.15,1350,34.5,74,3,400,2.8
Manteau_fourrure_01,Manteau fourrure,11.59,2480,48.2,81,6,183,2.3
Manteau_fourrure_02,Manteau fourrure,7.62,2250,46.5,56,4,320,1.7
Manteau_fourrure_03,Manteau fourrure,5.33,1950,20.6,55,4,480,0.3
Manteau_fourrure_04,Manteau fourrure,7.09,1470,26.9,58,4,270,0.8
Manteau_fourrure_05,Manteau fourrure,4.22,1970,24.9,44,4,600,1.0
Manteau_fourrure_06,Manteau fourrure,11.76,2060,34.3,65,4,480,3.2
Robe_haute_couture_01,Robe haute couture,12.4,500,68.1,100,2,14,3.1
Robe_haute_couture_02,Robe haute couture,16.26,660,77.2,100,2,23,3.8
Robe_haute_couture_03,Robe haute couture,26.77,1340,70.0,85,4,52,11.8
Robe_haute_couture_04,Robe haute couture,45.83,670,52.7,80,2,37,10.5
Robe_haute_couture_05,Robe haute couture,27.62,500,66.1,94,1,29,9.6
Robe_haute_couture_06,Robe haute couture,24.14,520,48.5,80,2,47,7.8` },
  clients: { label: "Clients du luxe", sub: "90 clients × 5 questions", m: "ACM", file: "clients_luxe.csv", csv: null },
  ventes: { label: "Ventes par région", sub: "8 familles × 5 régions", m: "AFC", file: "ventes_familles_regions.csv", csv:
`Famille,Europe,Amérique du Nord,Chine,Japon,Moyen-Orient
Foulards soie,925,617,788,859,259
Denim capsule,658,1308,483,370,117
Chemises sur mesure,512,279,207,164,92
Escarpins,544,471,406,488,196
Sacs cuir,698,694,1121,378,382
Costumes sur mesure,547,265,208,121,94
Manteaux fourrure,236,301,315,69,35
Robes haute couture,103,93,111,39,97` },
};
EXEMPLES.clients.csv = (() => {   // 4 profils de clientele, reponse typique avec une probabilite de 0,7
  const MOD = { Age: ["18-30 ans", "31-45 ans", "46-60 ans", "Plus de 60 ans"], Canal: ["Réseaux sociaux", "Site web", "Boutique", "Personal shopper"],
    Achat_prefere: ["Sneakers et denim", "Sacs", "Haute couture", "Accessoires"], Frequence: ["Régulière", "Occasionnelle", "Rare"],
    Motivation: ["Tendance", "Statut", "Savoir-faire", "Cadeau"] };
  const PROF = [[25, ["18-30 ans", "Réseaux sociaux", "Sneakers et denim", "Régulière", "Tendance"]], [25, ["31-45 ans", "Boutique", "Sacs", "Occasionnelle", "Statut"]],
    [20, ["Plus de 60 ans", "Personal shopper", "Haute couture", "Rare", "Savoir-faire"]], [20, ["46-60 ans", "Site web", "Accessoires", "Rare", "Cadeau"]]];
  let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const keys = Object.keys(MOD), lines = [];
  PROF.forEach(([eff, typ]) => { for (let i = 0; i < eff; i++) lines.push(keys.map((k, j) => { if (rnd() < 0.7) return typ[j]; const o = MOD[k].filter(m => m !== typ[j]); return o[Math.floor(rnd() * o.length)]; })); });
  for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  return ["Client," + keys.join(",")].concat(lines.map((l, i) => `C${String(i + 1).padStart(2, "0")},` + l.join(","))).join("\n");
})();

/* ------------------------------------------------------------------ utilitaires */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fr = (x, d = 2) => { x = +x; if (!isFinite(x)) return "—"; if (Math.abs(x) < 0.5 * 10 ** -d) x = 0; return x.toFixed(d).replace(".", ",").replace("-", "−"); };
const frs = (x, d = 2) => (+(+x).toFixed(d) > 0 ? "+" : "") + fr(x, d);
const pc = (x, d = 1) => fr(x, d) + " %";
const pl = (n, s, p) => `${n} ${n <= 1 ? s : (p || s + "s")}`;
const liste = (a, maxi = 4, total = null) => { a = [...a]; if (!a.length) return "aucune"; const N = total ?? a.length; if (N > maxi) { const r = N - Math.min(maxi, a.length); return a.slice(0, maxi).join(", ") + ` et ${r} ${r === 1 ? "autre" : "autres"}`; } return a.length === 1 ? a[0] : a.slice(0, -1).join(", ") + " et " + a.at(-1); };
const sci = x => { if (!isFinite(x) || x === 0) return "0"; const e = Math.floor(Math.log10(Math.abs(x))), m = x / 10 ** e; return `${fr(m, 1)}·10${String(e).split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c] ?? (c === "-" ? "⁻" : c)).join("")}`; };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const range = n => Array.from({ length: n }, (_, i) => i);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = a => a.reduce((x, y) => x + y, 0);
// propriete calculee a la premiere lecture puis gardee en cache
function lazy(o, k, f) { let v; Object.defineProperty(o, k, { get() { return (v ??= f()); }, enumerable: true, configurable: true }); }
// maximum / minimum sans passer par l'etalement d'arguments (qui depasse la pile au-dela d'environ 100 000 valeurs) ; NaN ignores
const maxOf = (...parts) => { let m = -Infinity; for (const p of parts) { if (p != null && typeof p === "object") { for (let i = 0; i < p.length; i++) if (p[i] > m) m = p[i]; } else if (p > m) m = p; } return m; };
const minOf = (...parts) => { let m = Infinity; for (const p of parts) { if (p != null && typeof p === "object") { for (let i = 0; i < p.length; i++) if (p[i] < m) m = p[i]; } else if (p < m) m = p; } return m; };
const cumsum = a => { let s = 0; return a.map(x => (s += x)); };
const isDark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(rnd) { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }
function niceStep(x) { const e = 10 ** Math.floor(Math.log10(x)), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }

/* ------------------------------------------------------------------ lecture des donnees */
function toNum(v) {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  if (typeof v === "string" && v !== "") { const c = v.charCodeAt(0); if ((c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46) { const x = +v; if (x === x && !(v.length > 2 && (v[1] === "x" || v[1] === "X" || v[1] === "b" || v[1] === "o"))) return x; } }   // voie rapide : nombre au format standard
  // formats courants des exports metier : espaces de milliers, virgule decimale, symbole monetaire ou % en fin de valeur
  const s = String(v).trim().replace(/[  \s]/g, "").replace(/^[€$£]|[€$£%]$/g, "").replace(",", ".");
  return s !== "" && /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? parseFloat(s) : NaN;
}
// marqueurs de valeur manquante reconnus a la lecture (R, pandas, Excel, exports metier)
const MISSING = new Set(["na", "n/a", "nan", "null", "none", "nil", "#n/a", "#na", "#div/0!", "#value!", "#valeur!", "#ref!", "#num!", "#nombre!", "-", "--", "?", "missing", "inf", "-inf", "+inf", "infinity", "-infinity", "+infinity"]);
function tableFromMatrix(matrix, name) {
  const rows = matrix.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
  if (rows.length < 2) throw new Error("Le fichier doit contenir une ligne d'en-têtes et au moins une ligne de données.");
  // noms reserves par les objets JavaScript renommes (une colonne "__proto__" ne serait pas stockee)
  let cols = rows[0].map((c, i) => { const s = String(c ?? "").trim() || `Colonne ${i + 1}`; return s === "__proto__" || s === "constructor" || s === "prototype" ? s + " " : s; });
  const seen = {}; cols = cols.map(c => (seen[c] = (seen[c] || 0) + 1) > 1 ? `${c} (${seen[c]})` : c);
  const nC = cols.length, nR = rows.length - 1, empty = v => v === undefined || v === null || (typeof v === "string" && (v.trim() === "" || (v.length < 10 && MISSING.has(v.trim().toLowerCase()))));
  // typage de chaque colonne AVANT de construire les lignes (numerique si au moins 90 % de nombres ; decision sur 5 000 lignes reparties au-dela de 50 000)
  const probe = nR > 50000 ? range(5000).map(k => 1 + Math.floor(k * nR / 5000)) : range(nR).map(k => k + 1), isNum = new Array(nC).fill(false), used = new Array(nC).fill(false);
  for (let c = 0; c < nC; c++) { let ok = 0, nn = 0; for (const i of probe) { const v = rows[i][c]; if (empty(v)) continue; nn++; if (Number.isFinite(toNum(v))) ok++; } isNum[c] = nn > 0 && ok >= 0.9 * nn; }
  const data = new Array(nR);
  for (let i = 0; i < nR; i++) { const r = rows[i + 1], o = {}; for (let c = 0; c < nC; c++) { const v = r[c]; let x = null; if (!empty(v)) { if (isNum[c]) { const t = toNum(v); x = Number.isFinite(t) ? t : null; } else x = v; } if (x !== null) used[c] = true; o[cols[c]] = x; } data[i] = o; }
  return { name, columns: cols.filter((c, k) => used[k]), rows: data, numeric: new Set(cols.filter((c, k) => isNum[k])) };
}
function parseCSV(text, name) {
  const res = Papa.parse(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  return tableFromMatrix(res.data, name);
}
let xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  return xlsxLoading ??= new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = () => ko(new Error("Impossible de charger le lecteur Excel (connexion internet nécessaire).")); document.head.appendChild(s); });
}
// tableau d'objets (JSON, Parquet, API) : colonnes = union des cles, puis meme typage que pour un CSV
function tableFromObjects(arr, name) {
  if (!Array.isArray(arr) || !arr.length) throw new Error("Les données doivent être un tableau d'objets (une ligne par objet).");
  const cols = [], seen = new Set(); for (const o of arr.slice(0, 5000)) for (const k of Object.keys(o || {})) if (!seen.has(k)) { seen.add(k); cols.push(k); }
  const conv = v => (typeof v === "bigint" ? Number(v) : v instanceof Date ? v.toISOString().slice(0, 10) : v !== null && typeof v === "object" ? JSON.stringify(v) : v);
  return tableFromMatrix([cols, ...arr.map(o => cols.map(c => conv(o?.[c] ?? null)))], name);
}
// lecture d'un contenu binaire selon son extension : CSV / TSV / TXT, Excel, JSON, Parquet
async function readBuffer(buf, name) {
  if (/\.(xlsx|xls|xlsm)$/i.test(name)) { await loadXLSX(); const wb = XLSX.read(buf, { type: "array" }); return tableFromMatrix(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true }), name); }
  if (/\.parquet$/i.test(name)) {
    let pq; try { pq = await import("https://cdn.jsdelivr.net/npm/hyparquet@1.31.2/+esm"); } catch (e) { throw new Error("Impossible de charger le lecteur Parquet (connexion internet nécessaire)."); }
    return tableFromObjects(await pq.parquetReadObjects({ file: buf }), name);
  }
  let text = new TextDecoder("utf-8").decode(buf); if (text.includes(String.fromCharCode(0xFFFD))) text = new TextDecoder("windows-1252").decode(buf);
  if (/\.json$/i.test(name) || /^\s*[[{]/.test(text.slice(0, 200))) { let d; try { d = JSON.parse(text); } catch (e) { if (/\.json$/i.test(name)) throw new Error("Fichier JSON illisible."); } if (d !== undefined) return tableFromObjects(Array.isArray(d) ? d : d.data || d.rows || d.records, name); }
  return parseCSV(text, name);
}
async function readFile(file) { return readBuffer(await file.arrayBuffer(), file.name); }
async function readURL(url) {
  const r = await fetch(url, { credentials: "omit" }); if (!r.ok) throw new Error(`Chargement impossible (${r.status}) : ${url}`);
  const name = decodeURIComponent(new URL(url, location.href).pathname.split("/").pop() || "donnees.csv"), ct = r.headers.get("content-type") || "";
  return readBuffer(await r.arrayBuffer(), /\.\w+$/.test(name) ? name : name + (ct.includes("json") ? ".json" : ".csv"));
}
function detect(t) {
  const quanti = [], quali = [];
  for (const c of t.columns) {   // les colonnes numeriques sont deja converties en nombres a la lecture
    if (t.numeric instanceof Set) { (t.numeric.has(c) ? quanti : quali).push(c); continue; }
    let nn = 0, ok = 0; for (const r of t.rows) { const v = r[c]; if (v === null || v === undefined) continue; nn++; if (typeof v === "number" ? Number.isFinite(v) : Number.isFinite(toNum(v))) ok++; }
    (nn && ok >= 0.9 * nn ? quanti : quali).push(c);
  }
  let ident = null; const n = t.rows.length;
  for (const c of quali) { const s = new Set(); let full = true; for (const r of t.rows) { const x = r[c]; if (x === null || x === undefined || s.has(x)) { full = false; break; } s.add(x); } if (full && n > 1) { ident = c; break; } }
  // identifiant numerique (id, code, numero, index exporte par pandas...) : entiers tous distincts, exclus des variables actives
  const idName = /^(id|ids|index|idx|key|cl[ée]|code|num|num[ée]ro|no|n°|#|rowid|row_id)$|^id[_\s.-]|[_\s.-]id$|^unnamed/i;
  const isIdCol = c => { const seq = t.rows.every((r, i) => r[c] === i || r[c] === i + 1); if (seq) return true; if (!idName.test(c.trim())) return false;
    const s = new Set(); for (const r of t.rows) { const x = r[c]; if (!Number.isInteger(x) || s.has(x)) return false; s.add(x); } return n > 1; };
  let numId = null; for (const c of quanti) if (isIdCol(c)) { numId = c; break; }
  if (numId && !ident) ident = numId;
  // colonnes texte a trop de modalites (libelles, adresses, dates...) : ni en ACM, ni en couleur, ni en AFC par defaut
  const text = [], qual = [];
  for (const c of quali) { if (c === ident) continue; const s = new Set(); for (const r of t.rows) { const x = r[c]; if (x !== null && x !== undefined) { s.add(x); if (s.size > 100) break; } } (s.size > 100 ? text : qual).push(c); }
  return { quanti: quanti.filter(c => c !== numId), quali: qual, ident, text, numId };
}
function isContingency(t, ty) {
  if (!ty.ident || ty.quali.length || ty.quanti.length < 2 || t.rows.length > 60) return false;
  return t.rows.every(r => ty.quanti.every(c => { const x = toNum(r[c]); return isFinite(x) && x >= 0 && Math.abs(x - Math.round(x)) < 1e-9; }));
}
function suggest(t, ty) {
  const nq = ty.quanti.length, nl = ty.quali.length;
  if (isContingency(t, ty)) return ["AFC", "le fichier ressemble à un tableau croisé d'effectifs"];
  if (nq >= 3 && nq >= nl) return ["ACP", `${nq} variables quantitatives`];
  if (nl >= 3) return ["ACM", `${nl} variables qualitatives`];
  if (nl === 2) return ["AFC", "deux variables qualitatives à croiser"];
  return ["ACP", nq >= 2 ? `${nq} variables quantitatives` : "méthode par défaut"];
}

/* ------------------------------------------------------------------ algebre lineaire */
// valeurs et vecteurs propres d'une matrice symetrique, tries par valeur decroissante
// jusqu'a 32 x 32 : Jacobi cyclique (tres precis, valide contre numpy) ; au-dela : Householder + QL implicite (JAMA / EISPACK tred2-tql2), 10 fois plus rapide
function eigSym(A) {
  const n = A.length; if (n > 32) return eigTQL(A);
  const a = A.map(r => Array.from(r)), V = range(n).map(i => range(n).map(j => +(i === j)));
  let sweeps = 0, scale = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) scale += a[i][j] * a[i][j];
  for (; sweeps < 120; sweeps++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off <= 1e-24 * scale) break;   // critere relatif : independant de l'echelle de la matrice
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  const idx = range(n).sort((i, j) => a[j][j] - a[i][i]);
  return { values: idx.map(i => Math.max(a[i][i], 0)), vectors: range(n).map(r => idx.map(i => V[r][i])), sweeps, alg: "Jacobi" };
}
function eigTQL(A) {
  const n = A.length, V = A.map(r => Float64Array.from(r)), d = new Float64Array(n), e = new Float64Array(n);
  // tred2 : reduction de Householder a une matrice tridiagonale
  for (let j = 0; j < n; j++) d[j] = V[n - 1][j];
  for (let i = n - 1; i > 0; i--) {
    let scale = 0, h = 0; for (let k = 0; k < i; k++) scale += Math.abs(d[k]);
    if (scale === 0) { e[i] = d[i - 1]; for (let j = 0; j < i; j++) { d[j] = V[i - 1][j]; V[i][j] = 0; V[j][i] = 0; } }
    else {
      for (let k = 0; k < i; k++) { d[k] /= scale; h += d[k] * d[k]; }
      let f = d[i - 1], g = Math.sqrt(h); if (f > 0) g = -g;
      e[i] = scale * g; h -= f * g; d[i - 1] = f - g; for (let j = 0; j < i; j++) e[j] = 0;
      for (let j = 0; j < i; j++) { f = d[j]; V[j][i] = f; g = e[j] + V[j][j] * f; for (let k = j + 1; k <= i - 1; k++) { g += V[k][j] * d[k]; e[k] += V[k][j] * f; } e[j] = g; }
      f = 0; for (let j = 0; j < i; j++) { e[j] /= h; f += e[j] * d[j]; }
      const hh = f / (h + h); for (let j = 0; j < i; j++) e[j] -= hh * d[j];
      for (let j = 0; j < i; j++) { f = d[j]; g = e[j]; for (let k = j; k <= i - 1; k++) V[k][j] -= f * e[k] + g * d[k]; d[j] = V[i - 1][j]; V[i][j] = 0; }
    }
    d[i] = h;
  }
  for (let i = 0; i < n - 1; i++) {
    V[n - 1][i] = V[i][i]; V[i][i] = 1; const h = d[i + 1];
    if (h !== 0) { for (let k = 0; k <= i; k++) d[k] = V[k][i + 1] / h; for (let j = 0; j <= i; j++) { let g = 0; for (let k = 0; k <= i; k++) g += V[k][i + 1] * V[k][j]; for (let k = 0; k <= i; k++) V[k][j] -= g * d[k]; } }
    for (let k = 0; k <= i; k++) V[k][i + 1] = 0;
  }
  for (let j = 0; j < n; j++) { d[j] = V[n - 1][j]; V[n - 1][j] = 0; } V[n - 1][n - 1] = 1; e[0] = 0;
  // tql2 : algorithme QL implicite avec decalages
  for (let i = 1; i < n; i++) e[i - 1] = e[i]; e[n - 1] = 0;
  let f = 0, tst1 = 0, iters = 0; const eps = 2 ** -52;
  for (let l = 0; l < n; l++) {
    tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l])); let m = l; while (m < n && Math.abs(e[m]) > eps * tst1) m++;
    if (m > l) {
      let it = 0;
      do {
        it++; iters++;
        let g = d[l], p = (d[l + 1] - g) / (2 * e[l]), r = Math.hypot(p, 1); if (p < 0) r = -r;
        d[l] = e[l] / (p + r); d[l + 1] = e[l] * (p + r); const dl1 = d[l + 1]; let h = g - d[l];
        for (let i = l + 2; i < n; i++) d[i] -= h; f += h;
        p = d[m]; let c = 1, c2 = 1, c3 = 1, s = 0, s2 = 0; const el1 = e[l + 1];
        for (let i = m - 1; i >= l; i--) {
          c3 = c2; c2 = c; s2 = s; g = c * e[i]; h = c * p; r = Math.hypot(p, e[i]); e[i + 1] = s * r; s = e[i] / r; c = p / r; p = c * d[i] - s * g; d[i + 1] = h + s * (c * g + s * d[i]);
          for (let k = 0; k < n; k++) { const Vk = V[k]; h = Vk[i + 1]; Vk[i + 1] = s * Vk[i] + c * h; Vk[i] = c * Vk[i] - s * h; }
        }
        p = -s * s2 * c3 * el1 * e[l] / dl1; e[l] = s * p; d[l] = c * p;
      } while (Math.abs(e[l]) > eps * tst1 && it < 60);
    }
    d[l] += f; e[l] = 0;
  }
  const idx = range(n).sort((i, j) => d[j] - d[i]);
  return { values: idx.map(i => Math.max(d[i], 0)), vectors: range(n).map(r => idx.map(i => V[r][i])), sweeps: iters, alg: "Householder-QL" };
}
function orthoErr(V) { const n = V.length, m = V[0].length; let e = 0; for (let i = 0; i < m; i++) for (let j = i; j < m; j++) { let s = 0; for (let k = 0; k < n; k++) s += V[k][i] * V[k][j]; e = Math.max(e, Math.abs(s - (i === j ? 1 : 0))); } return e; }
const coude = vals => { if (vals.length < 3) return 1; let best = 1, bd = -1; for (let k = 1; k < vals.length - 1; k++) { const d = vals[k] - vals[k + 1]; if (d > bd) { bd = d; best = k + 1; } } return best; };
const nInterp = (rule, qmax, choice) => Math.min(qmax, choice ? Math.max(choice, 2) : clamp(Math.max(rule, 2), 2, 3));
function orient(M, others) {   // signe arbitraire : l'element le plus marque de chaque axe passe du cote +
  for (let k = 0; k < M[0].length; k++) { let j = 0; M.forEach((r, i) => { if (Math.abs(r[k]) > Math.abs(M[j][k])) j = i; }); if (M[j][k] < 0) [M, ...others].forEach(X => X.forEach(r => (r[k] = -r[k]))); }
}
// log Gamma : approximation de Lanczos (g = 7, 9 coefficients), precision relative de l'ordre de 1e-15 ; reflexion pour x < 1/2
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gammln(x) { if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - gammln(1 - x); x -= 1; let a = LANCZOS[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i); return 0.9189385332046727 + (x + 0.5) * Math.log(t) - t + Math.log(a); }
function chi2sf(x, k) {
  if (x <= 0) return 1; const a = k / 2, z = x / 2;
  if (z < a + 1) { let ap = a, s = 1 / a, del = s; for (let i = 0; i < 1000; i++) { ap++; del *= z / ap; s += del; if (Math.abs(del) < Math.abs(s) * 1e-14) break; } return 1 - s * Math.exp(-z + a * Math.log(z) - gammln(a)); }
  let b = z + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
  return Math.exp(-z + a * Math.log(z) - gammln(a)) * h;
}
// Decomposition de S (m x J) via les valeurs propres de S'S : U, s, V sur q axes
function svdFromGram(S, q) {
  const J = S[0].length, G = range(J).map(i => range(J).map(j => { let v = 0; for (const r of S) v += r[i] * r[j]; return v; }));
  const e = eigSym(G); const s = e.values.slice(0, q).map(Math.sqrt), V = e.vectors.map(r => r.slice(0, q));
  const U = S.map(r => range(q).map(k => { let v = 0; for (let j = 0; j < J; j++) v += r[j] * V[j][k]; return s[k] > 1e-12 ? v / s[k] : 0; }));
  return { U, s, V, sweeps: e.sweeps, alg: e.alg, ortho: orthoErr(e.vectors), all: e.values };
}
function corrOf(X) {   // matrice des correlations d'un tableau n x p
  const n = X.length, p = X[0].length, mu = range(p).map(j => X.reduce((s, r) => s + r[j], 0) / n);
  const sd = range(p).map(j => Math.sqrt(X.reduce((s, r) => s + (r[j] - mu[j]) ** 2, 0) / n) || 1e-12);
  const Z = X.map(r => r.map((x, j) => (x - mu[j]) / sd[j]));
  return range(p).map(i => range(p).map(j => { let s = 0; for (const r of Z) s += r[i] * r[j]; return s / n; }));
}

/* ------------------------------------------------------------------ methodes */
function runACP(t, p) {
  const vars = p.vars; if (vars.length < 2) throw new Error("Choisissez au moins deux variables quantitatives.");
  const all = t.rows.map(r => vars.map(v => toNum(r[v])));
  const keep = range(all.length).filter(i => all[i].every(isFinite)), X = keep.map(i => all[i]), n = X.length, P = vars.length;
  if (n < 3) throw new Error("Il faut au moins 3 individus complets.");
  const t0 = performance.now(), mu = new Array(P).fill(0), ss = new Array(P).fill(0), mn = new Array(P).fill(Infinity), mx = new Array(P).fill(-Infinity);
  for (const r of X) for (let j = 0; j < P; j++) { const x = r[j]; mu[j] += x; if (x < mn[j]) mn[j] = x; if (x > mx[j]) mx[j] = x; }
  for (let j = 0; j < P; j++) mu[j] /= n;
  const sc = range(P).map(j => Math.max(mx[j] - mu[j], mu[j] - mn[j]) || 1);   // echelle de chaque variable : evite debordement et sous-depassement des carres
  for (const r of X) for (let j = 0; j < P; j++) ss[j] += ((r[j] - mu[j]) / sc[j]) ** 2;
  const sd = ss.map((s, j) => sc[j] * Math.sqrt(s / n)), cst = vars.filter((_, j) => !(sd[j] > 0) || mx[j] === mn[j]); if (cst.length) throw new Error(`Variable constante à retirer : ${cst.join(", ")}.`);
  // matrice des correlations accumulee ligne a ligne : le tableau centre-reduit n'est pas stocke
  const C = new Float64Array(P * P), z = new Float64Array(P);
  for (const r of X) { for (let j = 0; j < P; j++) z[j] = (r[j] - mu[j]) / sd[j]; for (let a = 0; a < P; a++) { const za = z[a]; for (let b = a; b < P; b++) C[a * P + b] += za * z[b]; } }
  const R = range(P).map(a => range(P).map(b => (a <= b ? C[a * P + b] : C[b * P + a]) / n));
  const e = eigSym(R); const ms = performance.now() - t0;
  const q = e.values.filter(v => v > 1e-10).length, vals = e.values.slice(0, q), V = e.vectors.map(r => r.slice(0, q));
  orient(V, []);
  const F = X.map(r => { for (let j = 0; j < P; j++) z[j] = (r[j] - mu[j]) / sd[j]; const f = new Array(q); for (let k = 0; k < q; k++) { let s = 0; for (let j = 0; j < P; j++) s += z[j] * V[j][k]; f[k] = s; } return f; });
  const coord = V.map(r => r.map((v, k) => v * Math.sqrt(vals[k])));
  const kaiser = vals.filter(v => v >= 1 - 1e-9).length;
  const res = { method: "ACP", n, p: P, removed: all.length - n, vars, names: keep.map(i => p.ident ? String(t.rows[i][p.ident]) : `#${i + 1}`), rowsKept: keep, R, vals, q,
    pct: vals.map(v => v / P * 100), cum: cumsum(vals).map(v => v / P * 100),
    threshold: 1, thresholdLabel: "Kaiser · λ = 1", rule: kaiser, coude: coude(vals), nAxes: nInterp(kaiser, q, p.nAxes),
    F, V, coord, vcos2: coord.map(r => r.map(c => c * c)), vctr: coord.map(r => r.map((c, k) => c * c / vals[k] * 100)),
    groups: p.color ? keep.map(i => String(t.rows[i][p.color] ?? "—")) : null, color: p.color,
    X, mu, sdPop: sd, sd: ss.map((s, j) => sc[j] * Math.sqrt(s / (n - 1))), min: mn, max: mx,
    engine: { alg: e.alg, mat: `R ${P}×${P}`, sweeps: e.sweeps, ms, trace: sum(e.values), traceRef: P, ortho: orthoErr(e.vectors) } };
  // matrices derivees calculees a la premiere lecture (memoire economisee sur les grands tableaux) ; ||z_i||^2 = somme des F_ik^2 sur les q axes
  lazy(res, "Z", () => X.map(r => r.map((x, j) => (x - mu[j]) / sd[j])));
  lazy(res, "cos2", () => F.map(r => { let d = 0; for (const f of r) d += f * f; d = d || 1e-12; return r.map(f => f * f / d); }));
  lazy(res, "ctr", () => F.map(r => r.map((f, k) => f * f / (n * vals[k]) * 100)));
  return res;
}
// ACM creuse : le tableau disjonctif n x M n'est jamais construit. La matrice de Gram S'S se deduit du tableau de Burt :
// (S'S)_ab = [B_ab / (n K^2) - c_a c_b] / sqrt(c_a c_b), puis F_ik = sqrt(n) (sum_{a de la ligne i} V_ak / (n K sqrt(c_a / n)) - sum_a sqrt(c_a / n) V_ak).
function acmCore(answers, vars) {
  const n = answers.length, K = vars.length, mods = [], idx = new Int32Array(n * K);
  vars.forEach((v, j) => [...new Set(answers.map(a => a[j]))].sort((a, b) => a.localeCompare(b, "fr")).forEach(m => mods.push({ v, j, m })));
  const M = mods.length, pos = vars.map((_, j) => new Map(mods.map((md, a) => [md, a]).filter(([md]) => md.j === j).map(([md, a]) => [md.m, a])));
  const eff = new Array(M).fill(0), B = new Float64Array(M * M);
  for (let i = 0; i < n; i++) { for (let j = 0; j < K; j++) { const a = pos[j].get(answers[i][j]); idx[i * K + j] = a; eff[a]++; } for (let u = 0; u < K; u++) { const a = idx[i * K + u]; for (let w = 0; w < K; w++) B[a * M + idx[i * K + w]]++; } }
  const r = 1 / n, c = eff.map(e => e / (n * K)), G = range(M).map(a => range(M).map(b => (B[a * M + b] / (n * K * K) - c[a] * c[b]) / Math.sqrt(c[a] * c[b])));
  const e = eigSym(G), q = Math.max(1, Math.min(M - K, e.values.filter(v => v > 1e-12).length)), s = e.values.slice(0, q).map(v => Math.sqrt(Math.max(v, 0))), V = e.vectors.map(row => row.slice(0, q));
  const sq = c.map(x => Math.sqrt(x / n)), cst = range(q).map(k => V.reduce((acc, row, a) => acc + sq[a] * row[k], 0)), wv = V.map((row, a) => row.map(v => v / (n * K * sq[a]))), rn = Math.sqrt(n);
  const F = new Array(n); for (let i = 0; i < n; i++) { const f = new Array(q).fill(0); for (let j = 0; j < K; j++) { const w = wv[idx[i * K + j]]; for (let k = 0; k < q; k++) f[k] += w[k]; } for (let k = 0; k < q; k++) f[k] = rn * (f[k] - cst[k]); F[i] = f; }
  return { n, K, M, mods, eff, r, c, q, s, V, F, sweeps: e.sweeps, alg: e.alg, ortho: orthoErr(V), all: e.values };
}
function runACM(t, p) {
  const vars = p.vars; if (vars.length < 2) throw new Error("Choisissez au moins deux variables qualitatives.");
  const keep = range(t.rows.length).filter(i => vars.every(v => t.rows[i][v] !== null)), n = keep.length, K = vars.length;
  if (n < 3) throw new Error("Il faut au moins 3 individus complets.");
  const answers = keep.map(i => vars.map(v => String(t.rows[i][v])));
  // garde-fous : une variable a une seule modalite n'apporte rien ; au-dela de 1 000 modalites la diagonalisation devient trop lourde
  const card = vars.map((v, j) => { const s = new Set(); for (const a of answers) { s.add(a[j]); if (s.size > 1000) break; } return s.size; });
  const one = vars.filter((v, j) => card[j] < 2); if (one.length) throw new Error(`Variable à une seule modalité, à retirer : ${one.join(", ")}.`);
  if (sum(card) > 1000) { const big = vars.map((v, j) => [v, card[j]]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, c]) => `${v} (${c > 1000 ? "plus de 1 000" : c})`); throw new Error(`Trop de modalités pour une ACM (${sum(card)}${card.some(c => c > 1000) ? " et plus" : ""}, 1 000 au plus). Retirez les variables les plus fragmentées : ${big.join(", ")}.`); }
  const t0 = performance.now(); const core = acmCore(answers, vars); const ms = performance.now() - t0;
  const { M, mods, eff, r, c, q, s, V, F } = core, vals = s.map(x => x * x);
  const G = V.map((row, j) => row.map((v, k) => v * s[k] / Math.sqrt(c[j])));
  orient(G, [F]);
  const tot = sum(vals), ctrm = G.map((g, j) => g.map((x, k) => c[j] * x * x / vals[k] * 100));
  const eta2 = vars.map(v => range(q).map(k => mods.reduce((a, md, j) => a + (md.v === v ? ctrm[j][k] : 0), 0) / 100 * K * vals[k]));
  const rule = vals.filter(v => v > 1 / K).length;
  const res = { method: "ACM", n, K, M, removed: t.rows.length - n, vars, names: keep.map(i => p.ident ? String(t.rows[i][p.ident]) : `#${i + 1}`), rowsKept: keep,
    answers, mods: mods.map(o => `${o.v} = ${o.m}`), modVar: mods.map(o => o.v), modName: mods.map(o => o.m), modCol: mods.map(o => o.j), eff,
    vals, q, pct: vals.map(v => v / tot * 100), cum: cumsum(vals).map(v => v / tot * 100), threshold: 1 / K, thresholdLabel: `1/K = ${fr(1 / K, 3)}`, rule, coude: coude(vals), nAxes: nInterp(rule, q, p.nAxes),
    F, G, mctr: ctrm, mcos2: G.map(g => { const d = g.reduce((a, x) => a + x * x, 0) || 1e-12; return g.map(x => x * x / d); }), eta2,
    groups: p.color ? keep.map(i => String(t.rows[i][p.color] ?? "—")) : null, color: p.color,
    engine: { alg: core.alg + " · Burt", mat: `${M}×${M}`, sweeps: core.sweeps, ms, trace: sum(core.all), traceRef: M / K - 1, ortho: core.ortho } };
  lazy(res, "cos2", () => F.map(row => { const d = row.reduce((a, x) => a + x * x, 0) || 1e-12; return row.map(x => x * x / d); }));
  lazy(res, "ctr", () => F.map(row => row.map((x, k) => r * x * x / vals[k] * 100)));
  return res;
}
function afcCore(N) {
  const I = N.length, J = N[0].length, n = sum(N.map(sum)), r = N.map(row => sum(row) / n), c = range(J).map(j => N.reduce((a, row) => a + row[j], 0) / n);
  const S = N.map((row, i) => row.map((x, j) => (x / n - r[i] * c[j]) / Math.sqrt(r[i] * c[j])));
  const q = Math.max(1, Math.min(I, J) - 1);
  if (J <= I) return { I, J, n, r, c, q, ...svdFromGram(S, q) };
  // plus de colonnes que de lignes : decomposition de la transposee (matrice de Gram I x I au lieu de J x J)
  const d = svdFromGram(range(J).map(j => S.map(row => row[j])), q); return { I, J, n, r, c, q, ...d, U: d.V, V: d.U };
}
function runAFC(t, p) {
  let rowL, colL, N;
  if (p.mode === "tableau") {
    if (!p.ident) throw new Error("Choisissez la colonne qui contient les noms des lignes.");
    if (p.vars.length < 2) throw new Error("Choisissez au moins deux colonnes d'effectifs.");
    rowL = t.rows.map(r => String(r[p.ident])); colL = p.vars.slice(); N = t.rows.map(r => colL.map(c => toNum(r[c]) || 0));
  } else {
    if (!p.rowVar || !p.colVar || p.rowVar === p.colVar) throw new Error("Choisissez deux variables qualitatives différentes.");
    const ok = t.rows.filter(r => r[p.rowVar] !== null && r[p.colVar] !== null);
    rowL = [...new Set(ok.map(r => String(r[p.rowVar])))].sort((a, b) => a.localeCompare(b, "fr")); colL = [...new Set(ok.map(r => String(r[p.colVar])))].sort((a, b) => a.localeCompare(b, "fr"));
    if (rowL.length > 2000 || colL.length > 2000) throw new Error("Trop de modalités pour un tableau croisé (2 000 au plus par variable).");
    const ri = new Map(rowL.map((l, i) => [l, i])), ci = new Map(colL.map((l, j) => [l, j]));
    N = rowL.map(() => colL.map(() => 0)); for (const r of ok) N[ri.get(String(r[p.rowVar]))][ci.get(String(r[p.colVar]))]++;
  }
  if (N.some(row => row.some(x => x < 0))) throw new Error("Un tableau croisé ne contient que des effectifs positifs ou nuls.");
  const rk = range(rowL.length).filter(i => N[i].some(x => x > 0)); rowL = rk.map(i => rowL[i]); N = rk.map(i => N[i]);
  const ck = range(colL.length).filter(j => N.some(r => r[j] > 0)); colL = ck.map(j => colL[j]); N = N.map(r => ck.map(j => r[j]));
  if (rowL.length < 2 || colL.length < 2) throw new Error("Le tableau croisé doit avoir au moins 2 lignes et 2 colonnes non vides.");
  const t0 = performance.now(); const core = afcCore(N); const ms = performance.now() - t0;
  const { I, J, n, r, c, q, U, s, V } = core, vals = s.map(x => x * x);
  const E = r.map(ri => c.map(cj => ri * cj * n)); let chi2 = 0; N.forEach((row, i) => row.forEach((x, j) => (chi2 += (x - E[i][j]) ** 2 / E[i][j])));
  const F = U.map((row, i) => row.map((u, k) => u * s[k] / Math.sqrt(r[i]))), G = V.map((row, j) => row.map((v, k) => v * s[k] / Math.sqrt(c[j])));
  orient(F, [G]);
  const tot = sum(vals), ddl = (I - 1) * (J - 1), rule = vals.filter(v => v > tot / q).length;
  if (!(tot > 1e-14)) throw new Error("Les deux variables sont exactement indépendantes (χ² = 0) : il n'y a aucun écart à représenter.");
  const nc = X => X.map(row => { const d = row.reduce((a, x) => a + x * x, 0) || 1e-12; return row.map(x => x * x / d); });
  return { method: "AFC", n, I, J, rowL, colL, N, E, ratio: N.map((row, i) => row.map((x, j) => x / E[i][j])), chi2, ddl, pval: chi2sf(chi2, ddl),
    rowName: p.rowName || "Lignes", colName: p.colName || "Colonnes", r, c,
    vals, q, pct: vals.map(v => v / tot * 100), cum: cumsum(vals).map(v => v / tot * 100), threshold: tot / q, thresholdLabel: "inertie moyenne", rule, coude: coude(vals), nAxes: nInterp(rule, q, p.nAxes),
    F, G, rctr: F.map((row, i) => row.map((x, k) => r[i] * x * x / vals[k] * 100)), cctr: G.map((row, j) => row.map((x, k) => c[j] * x * x / vals[k] * 100)), rcos2: nc(F), ccos2: nc(G), names: rowL,
    engine: { alg: core.alg + " · Gram", mat: `S'S ${Math.min(I, J)}×${Math.min(I, J)}`, sweeps: core.sweeps, ms, trace: sum(core.all), traceRef: chi2 / n, ortho: core.ortho } };
}

/* ------------------------------------------------------------------ individu supplementaire */
function projectSupp(res, input) {  // ACP : valeurs brutes ; ACM : indices de modalites ; AFC : effectifs par colonne
  const q = res.q;
  if (res.method === "ACP") { const z = input.map((x, j) => (x - res.mu[j]) / res.sdPop[j]); const F = range(q).map(k => z.reduce((s, zz, j) => s + zz * res.V[j][k], 0)); const d2 = sum(z.map(x => x * x)) || 1e-12; return { F, cos2: F.map(f => f * f / d2) }; }
  if (res.method === "ACM") { const F = range(q).map(k => sum(input.map(j => res.G[j][k])) / (res.K * Math.sqrt(res.vals[k]))); const d = sum(F.map(f => f * f)) || 1e-12; return { F, cos2: F.map(f => f * f / d) }; }
  const tot = sum(input) || 1, prof = input.map(x => x / tot); const F = range(q).map(k => sum(prof.map((p, j) => p * res.G[j][k])) / Math.sqrt(res.vals[k])); const d = sum(F.map(f => f * f)) || 1e-12; return { F, cos2: F.map(f => f * f / d) };
}
function neighbors(res, F, k = 3, exclude = -1) {
  const P = res.method === "AFC" ? res.F : res.F, dims = Math.min(res.nAxes, 3), names = res.method === "AFC" ? res.rowL : res.names;
  return range(P.length).filter(i => i !== exclude).map(i => ({ i, name: names[i], d: Math.sqrt(sum(range(dims).map(a => (P[i][a] - F[a]) ** 2))) })).sort((a, b) => a.d - b.d).slice(0, k);
}

/* ------------------------------------------------------------------ interpretation */
function sides(labels, ctr, coord, k, seuil) {
  const idx = range(labels.length).filter(i => ctr[i][k] > seuil).sort((a, b) => ctr[b][k] - ctr[a][k]);
  return { minus: idx.filter(i => coord[i][k] < 0).map(i => ({ l: labels[i], c: ctr[i][k] })), plus: idx.filter(i => coord[i][k] > 0).map(i => ({ l: labels[i], c: ctr[i][k] })) };
}
function interpret(res) {
  const out = [];
  for (let k = 0; k < res.nAxes; k++) {
    let main, cols = null, indM = [], indP = [], idxM = [], idxP = [], nM = 0, nP = 0, extra = "";
    if (res.method === "ACP") {
      main = sides(res.vars, res.vctr, res.coord, k, 100 / res.p);
      // seuls les individus au-dela de +/- racine(lambda) sont tries (grands tableaux)
      const sq = Math.sqrt(res.vals[k]); for (let i = 0; i < res.n; i++) { const f = res.F[i][k]; if (f < -sq) idxM.push(i); else if (f > sq) idxP.push(i); }
      // grands tableaux : on garde les 1 000 plus extremes de chaque cote (seuil par tri numerique), le nombre total reste connu
      const top = (idx, sg) => { if (idx.length > 1000) { const v = Float64Array.from(idx, i => sg * res.F[i][k]).sort(), thr = v[v.length - 1000]; idx = idx.filter(i => sg * res.F[i][k] >= thr); } return idx.sort((a, b) => sg * (res.F[b][k] - res.F[a][k])).slice(0, 1000); };
      nM = idxM.length; nP = idxP.length; idxM = top(idxM, -1); idxP = top(idxP, 1);
      indM = idxM.map(i => res.names[i]); indP = idxP.map(i => res.names[i]);
    } else if (res.method === "ACM") {
      main = sides(res.mods, res.mctr, res.G, k, 100 / res.M);
      const fortes = res.vars.filter((v, j) => res.eta2[j][k] >= 0.3); if (fortes.length) extra = ` Variables les plus liées (η² ≥ 0,3) : ${liste(fortes)}.`;
    } else {
      main = sides(res.rowL, res.rctr, res.F, k, 100 / res.I); cols = sides(res.colL, res.cctr, res.G, k, 100 / res.J);
    }
    const mN = main.minus.map(e => e.l), pN = main.plus.map(e => e.l);
    const auto = `${mN.slice(0, 2).join(", ") || "—"} ↔ ${pN.slice(0, 2).join(", ") || "—"}`;
    let sentence = mN.length && pN.length ? `oppose ${liste(mN)} (côté −) à ${liste(pN)} (côté +).` : pN.length ? `porté par ${liste(pN)} (côté +).` : mN.length ? `porté par ${liste(mN)} (côté −).` : "aucun élément ne dépasse le seuil de contribution.";
    if (cols) sentence += ` Côté colonnes : ${cols.minus.length ? liste(cols.minus.map(e => e.l)) : "—"} (−) / ${cols.plus.length ? liste(cols.plus.map(e => e.l)) : "—"} (+).`;
    out.push({ k, main, cols, indM, indP, idxM, idxP, nM, nP, auto, sentence: sentence + extra });
  }
  return out;
}
function axisName(k) { return (state.axisNames[k] || "").trim(); }
function axisPhrase(res, it) { const nm = axisName(it.k); return `<b>Axe ${it.k + 1} (${pc(res.pct[it.k])})${nm ? " · " + esc(nm) : ""}</b> : ${esc(it.sentence)}`; }
function brief(res, inter) {
  const S = res.nAxes, b = [];
  if (res.method === "ACP") b.push([`<b>${S} axes résument ${pc(res.cum[S - 1])} de l'information</b> (Kaiser : ${pl(res.rule, "valeur propre", "valeurs propres")} ≥ 1${res.coude === res.rule ? ", confirmé par le coude" : ` ; le coude suggère ${pl(res.coude, "axe")}`}).`, "var(--amber)"]);
  else if (res.method === "ACM") b.push([`<b>${pl(res.rule, "axe dépasse", "axes dépassent")} le seuil 1/K = ${fr(res.threshold, 3)}</b> ; les ${S} premiers résument ${pc(res.cum[S - 1])} de l'inertie. En ACM, ces pourcentages sont naturellement faibles.`, "var(--amber)"]);
  else b.push([`<b>Les deux variables sont ${res.pval < 0.05 ? "liées" : "indépendantes"}</b> (χ² = ${fr(res.chi2, 1)}, ${res.ddl} ddl, p ${res.pval < 0.001 ? "< 0,001" : "= " + fr(res.pval, 3)}) ; ${S} axes résument ${pc(res.cum[S - 1])} de l'inertie.`, "var(--amber)"]);
  inter.slice(0, 3).forEach((it, i) => b.push([axisPhrase(res, it), `var(--a${i + 1})`]));
  if (res.method === "ACP") {
    b.push([res.pct[0] >= 60 ? `<b>L'axe 1 domine (${pc(res.pct[0])})</b> : les variables varient presque toutes ensemble (effet taille).` : `<b>Aucun axe n'écrase les autres</b> : l'axe 1 résume ${pc(res.pct[0])} de l'information.`, "var(--ok)"]);
    let best = null; res.R.forEach((row, i) => row.forEach((v, j) => { if (j > i && (!best || Math.abs(v) > Math.abs(best[0]))) best = [v, i, j]; }));
    if (best) b.push([`<b>Lien le plus fort</b> : ${esc(res.vars[best[1]])} et ${esc(res.vars[best[2]])} (r = ${frs(best[0])}).`, "var(--g7)"]);
  } else if (res.method === "AFC") {
    let mx = [0, 0], mn = [0, 0]; res.ratio.forEach((row, i) => row.forEach((x, j) => { if (x > res.ratio[mx[0]][mx[1]]) mx = [i, j]; if (x < res.ratio[mn[0]][mn[1]]) mn = [i, j]; }));
    b.push([`<b>Plus forte attraction</b> : ${esc(res.rowL[mx[0]])} × ${esc(res.colL[mx[1]])} (+${Math.round((res.ratio[mx[0]][mx[1]] - 1) * 100)} %) · <b>plus forte répulsion</b> : ${esc(res.rowL[mn[0]])} × ${esc(res.colL[mn[1]])} (−${Math.round(Math.abs(res.ratio[mn[0]][mn[1]] - 1) * 100)} %).`, "var(--g7)"]);
  } else {
    const top = res.vars.map((v, j) => [v, res.eta2[j][0]]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    b.push([`<b>Variables les plus liées à l'axe 1</b> : ${esc(liste(top))}.`, "var(--g7)"]);
  }
  return b;
}
