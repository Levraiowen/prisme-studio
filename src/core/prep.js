
/* ============================================================================
   Preparation des donnees : transformations, valeurs manquantes, variables
   illustratives. Imputation par ACP iterative regularisee : Josse & Husson
   (2012), "Handling missing values in exploratory multivariate data analysis
   methods", Journal de la SFdS (methode du package missMDA).
   ============================================================================ */
const TRANSFORMS = {
  none: { l: "Aucune", f: null },
  log: { l: "Logarithme", f: (x, mn) => (mn > 0 ? Math.log(x) : Math.log1p(x)), ok: mn => mn >= 0 },
  sqrt: { l: "Racine carrée", f: x => Math.sqrt(x), ok: mn => mn >= 0 },
  rank: { l: "Rangs", f: null },
};
// applique les transformations choisies (par colonne) et renvoie un nouveau tableau
function applyTransforms(table, tr) {
  const cols = Object.keys(tr || {}).filter(c => tr[c] && tr[c] !== "none" && table.columns.includes(c)); if (!cols.length) return table;
  const rows = table.rows.map(r => ({ ...r }));
  cols.forEach(c => { const v = rows.map(r => toNum(r[c])), fin = v.filter(Number.isFinite), mn = minOf(fin), t = tr[c];
    if (t === "rank") { const idx = v.map((x, i) => i).filter(i => Number.isFinite(v[i])), rk = ranks(idx.map(i => v[i])); rows.forEach(r => (r[c] = null)); idx.forEach((i, k) => (rows[i][c] = rk[k])); return; }
    const T = TRANSFORMS[t]; if (!T || (T.ok && !T.ok(mn))) return; rows.forEach((r, i) => (r[c] = Number.isFinite(v[i]) ? T.f(v[i], mn) : null)); });
  return { ...table, rows };
}
// ACP iterative regularisee sur les variables actives (valeurs manquantes = NaN)
// critere d'arret : changement relatif (au carre) des valeurs imputees < 1e-10, soit un changement relatif de l'ordre de 1e-5
function imputePCA(X, S = 2, maxIter = 1000, tol = 1e-10) {
  // tableau plat Float64Array : pas de reallocation a chaque iteration (grands tableaux)
  const n = X.length, p = X[0].length, Y = new Float64Array(n * p), mi = [], mj = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) { const x = X[i][j]; if (Number.isFinite(x)) Y[i * p + j] = x; else { mi.push(i); mj.push(j); } }
  const nm = mi.length, rows = () => range(n).map(i => Array.from(Y.subarray(i * p, i * p + p))); if (!nm) return { X: rows(), iter: 0, miss: 0 };
  const cm = new Float64Array(p), cn = new Float64Array(p); for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) if (Number.isFinite(X[i][j])) { cm[j] += X[i][j]; cn[j]++; }
  for (let k = 0; k < nm; k++) Y[mi[k] * p + mj[k]] = cn[mj[k]] ? cm[mj[k]] / cn[mj[k]] : 0;
  const missRows = [...new Set(mi)], byRow = new Map(missRows.map(i => [i, []])); for (let k = 0; k < nm; k++) byRow.get(mi[k]).push(k);
  S = clamp(S, 1, p - 1); let it = 0, crit = Infinity; const prev = new Float64Array(nm), mu = new Float64Array(p), sd = new Float64Array(p), C = new Float64Array(p * p), z = new Float64Array(p);
  for (let k = 0; k < nm; k++) prev[k] = Y[mi[k] * p + mj[k]];
  for (; it < maxIter && crit > tol; it++) {
    mu.fill(0); sd.fill(0); C.fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) mu[j] += Y[i * p + j]; for (let j = 0; j < p; j++) mu[j] /= n;
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) sd[j] += (Y[i * p + j] - mu[j]) ** 2; for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j] / n) || 1;
    for (let i = 0; i < n; i++) { for (let j = 0; j < p; j++) z[j] = (Y[i * p + j] - mu[j]) / sd[j]; for (let a = 0; a < p; a++) { const za = z[a]; for (let b = a; b < p; b++) C[a * p + b] += za * z[b]; } }
    const R = range(p).map(a => range(p).map(b => (a <= b ? C[a * p + b] : C[b * p + a]) / n)), e = eigSym(R), sig2 = sum(e.values.slice(S)) / (p - S);
    const shrink = range(S).map(s => (e.values[s] > sig2 ? (e.values[s] - sig2) / e.values[s] : 0)), upd = new Float64Array(nm);
    // reconstruction regularisee des seules cases manquantes, a partir des coordonnees de la ligne (calculees avant mise a jour)
    for (const i of missRows) { for (let j = 0; j < p; j++) z[j] = (Y[i * p + j] - mu[j]) / sd[j]; const f = range(S).map(s => { let t = 0; for (let k = 0; k < p; k++) t += z[k] * e.vectors[k][s]; return t; });
      for (const k of byRow.get(i)) { const j = mj[k]; let v = 0; for (let s = 0; s < S; s++) v += f[s] * e.vectors[j][s] * shrink[s]; upd[k] = mu[j] + sd[j] * v; } }
    let num = 0, den = 0; for (let k = 0; k < nm; k++) { Y[mi[k] * p + mj[k]] = upd[k]; num += (upd[k] - prev[k]) ** 2; den += upd[k] * upd[k]; prev[k] = upd[k]; } crit = den > 0 ? num / den : 0;
  }
  return { X: rows(), iter: it, miss: nm, S };
}
// remplit les valeurs manquantes d'un tableau selon la strategie choisie (variables actives seulement)
function applyMissing(table, method, params, am) {
  if (!method || method === "drop" || !params) return { table, info: null };
  // copie a l'ecriture : seules les lignes qui recoivent une valeur imputee sont dupliquees (les autres sont partagees)
  const rows = table.rows.slice(), own = new Uint8Array(rows.length), set = (i, v, x) => { if (!own[i]) { rows[i] = { ...rows[i] }; own[i] = 1; } rows[i][v] = x; };
  if (params.vars && params.vars.length && am === "ACP") {
    const X = rows.map(r => params.vars.map(v => toNum(r[v]))); let nMiss = 0; for (const r of X) for (const x of r) if (!Number.isFinite(x)) nMiss++; if (!nMiss) return { table, info: null };
    const keepRow = X.map(r => r.some(Number.isFinite)), Xk = X.filter((_, i) => keepRow[i]);
    let Y, info;
    if (method === "mean") { const m = params.vars.map((_, j) => mean(Xk.map(r => r[j]).filter(Number.isFinite))); Y = Xk.map(r => r.map((x, j) => (Number.isFinite(x) ? x : m[j]))); info = { method: "moyenne", miss: nMiss }; }
    else { const r0 = imputePCA(Xk, Math.min(2, params.vars.length - 1)); Y = r0.X; info = { method: "ACP itérative régularisée", miss: nMiss, iter: r0.iter, S: r0.S }; }
    let k = 0; X.forEach((r, i) => { if (!keepRow[i]) return; params.vars.forEach((v, j) => { if (!Number.isFinite(r[j])) set(i, v, Y[k][j]); }); k++; });
    return { table: { ...table, rows }, info };
  }
  if (params.vars && am === "ACM") { let nMiss = 0; rows.forEach((r, i) => params.vars.forEach(v => { if (r[v] === null || r[v] === undefined) { set(i, v, "Manquant"); nMiss++; } })); return { table: { ...table, rows }, info: nMiss ? { method: "modalité « Manquant »", miss: nMiss } : null }; }
  return { table, info: null };
}
// variables illustratives : quantitatives (correlations avec les axes) et qualitatives (barycentres + valeurs-tests)
function supplementary(res, table, suppQ = [], suppL = []) {
  if (res.method === "AFC" || !res.rowsKept) return null;
  const rows = res.rowsKept.map(i => table.rows[i]), q = res.q, n = res.n, out = { quanti: [], quali: [] };
  suppQ.forEach(c => { const x = rows.map(r => toNum(r[c])), ok = range(n).filter(i => Number.isFinite(x[i])); if (ok.length < 3) return;
    const coord = range(q).map(k => pearson(ok.map(i => x[i]), ok.map(i => res.F[i][k]))); out.quanti.push({ name: c, coord, cos2: coord.map(v => v * v) }); });
  suppL.forEach(c => { const g = rows.map(r => (r[c] === null || r[c] === undefined ? null : String(r[c]))), cats = [...new Set(g.filter(v => v !== null))]; if (cats.length < 2 || cats.length > 30) return;
    const mods = cats.map(cat => { const mem = range(n).filter(i => g[i] === cat), nc = mem.length, bary = range(q).map(k => mean(mem.map(i => res.F[i][k])));
      const vt = bary.map((b, k) => { const den = Math.sqrt(res.vals[k] / nc * (n - nc) / (n - 1)); return den > 0 ? b / den : 0; });
      return { cat, n: nc, bary, coord: res.method === "ACM" ? bary.map((b, k) => b / Math.sqrt(res.vals[k])) : bary, vtest: vt }; });
    const eta2 = range(q).map(k => anova(range(n).filter(i => g[i] !== null).map(i => res.F[i][k]), g.filter(v => v !== null)).eta2);
    out.quali.push({ name: c, mods, eta2 }); });
  return out.quanti.length || out.quali.length ? out : null;
}
