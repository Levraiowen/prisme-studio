
/* ============================================================================
   Scagnostics : diagnostics automatiques des nuages de points (idee de
   J. W. et P. Tukey ; Wilkinson, Anand & Grossman 2005, "Graph-theoretic
   scagnostics", IEEE InfoVis). Mesures sur l'arbre couvrant minimal apres
   mise a l'echelle [0,1], suppression des doublons et des points isoles,
   selon l'implementation de reference cassowaryr (Mason, Lee, Laa & Cook).
   Ajouts modernes : correlation de distance et part non lineaire.
   ============================================================================ */
const SCAG = {
  outlying: { l: "Isolés", d: "part de l'arbre couvrant due à des points isolés" },
  skewed: { l: "Asymétrique", d: "distances entre voisins très inégales" },
  sparse: { l: "Clairsemé", d: "points très espacés" },
  clumpy: { l: "Amas", d: "points regroupés en paquets séparés" },
  striated: { l: "Strié", d: "points alignés en lignes parallèles (valeurs discrètes)" },
  stringy: { l: "Filament", d: "points formant une courbe fine" },
  monotonic: { l: "Monotone", d: "l'une augmente quand l'autre augmente (ρ² de Spearman)" },
  dcor: { l: "Dépendance", d: "corrélation de distance : tout type de lien, linéaire ou non" },
  nonlin: { l: "Non linéaire", d: "dépendance que la corrélation de Pearson ne voit pas" },
  nonmono: { l: "Non monotone", d: "lien qui change de sens (en U, en cloche) : corrélation de distance sur les rangs moins |Spearman|" },
  curve: { l: "Courbure", d: "lien monotone mais pas rectiligne : |Spearman| moins |Pearson|" },
};
function scagnostics(x, y, cap = 320) {
  let ok = range(x.length).filter(i => Number.isFinite(x[i]) && Number.isFinite(y[i])); if (ok.length < 5) return null;
  if (ok.length > 8000) ok = sampleRows(ok.length, 8000, 23).map(k => ok[k]);   // grands tableaux : 8 000 points suffisent a ces mesures de forme (erreur sur rho < 0,02)
  const X = ok.map(i => x[i]), Y = ok.map(i => y[i]), r = pearson(X, Y), rho = spearman(X, Y), mono = rho ** 2;
  const rnd = mulberry(17), sub = sampleRows(X.length, 400, 17);
  const sx = sub.map(i => X[i]), sy = sub.map(i => Y[i]), dc = dcor(sx, sy), dcR = dcor(ranks(sx), ranks(sy));   // version sur les rangs : robuste aux valeurs extremes
  const unit = a => { const mn = minOf(a), mx = maxOf(a); return a.map(v => (mx > mn ? (v - mn) / (mx - mn) : 0.5)); };
  // regroupement par cases (50 x 50) au centre de masse, comme le binning hexagonal de reference
  const ux = unit(X), uy = unit(Y), cells = new Map();
  ux.forEach((v, i) => { const key = Math.min(49, Math.floor(v * 50)) * 64 + Math.min(49, Math.floor(uy[i] * 50)), c = cells.get(key); if (c) { c[0] += v; c[1] += uy[i]; c[2]++; } else cells.set(key, [v, uy[i], 1]); });
  let pts = [...cells.values()].map(c => [c[0] / c[2], c[1] / c[2]]);
  if (pts.length > cap) pts = pts.map(p => [rnd(), p]).sort((a, b) => a[0] - b[0]).slice(0, cap).map(t => t[1]);
  const base = { monotonic: mono, dcor: dc, dcorR: dcR, nonlin: Math.max(0, dc - Math.abs(r)), nonmono: Math.max(0, dcR - Math.abs(rho)), curve: Math.max(0, Math.abs(rho) - Math.abs(r)), pearson: r, spearman: rho, n: ok.length };
  if (pts.length < 5) return { ...base, outlying: 0, skewed: 0, sparse: 0, clumpy: 0, striated: 0, stringy: 0 };
  const omega = L => { const s = L.slice().sort((a, b) => a - b); return quantile(s, 0.75) + 1.5 * (quantile(s, 0.75) - quantile(s, 0.25)); };
  const outliersOf = (E, nv) => { const L = E.map(e => e[2]), w = omega(L), inc = range(nv).map(() => []); E.forEach(e => { inc[e[0]].push(e[2]); inc[e[1]].push(e[2]); }); return range(nv).filter(v => inc[v].length && inc[v].every(l => l > w)); };
  // Isoles : longueur des aretes des points isoles / longueur totale (arbre complet)
  let E = mstEdges(pts); const out0 = new Set(outliersOf(E, pts.length)), tot0 = sum(E.map(e => e[2]));
  const outlying = tot0 > 0 ? sum(E.filter(e => out0.has(e[0]) || out0.has(e[1])).map(e => e[2])) / tot0 : 0;
  for (let guard = 0; guard < 10; guard++) { const o = new Set(outliersOf(E, pts.length)); if (!o.size || pts.length - o.size < 5) break; pts = pts.filter((_, i) => !o.has(i)); E = mstEdges(pts); }
  const nv = pts.length, L = E.map(e => e[2]).sort((a, b) => a - b), m = L.length, qf = p => L[Math.max(0, Math.floor(p * m) - 1)];
  const q10 = qf(0.1), q50 = qf(0.5), q90 = qf(0.9), deg = new Array(nv).fill(0), adj = range(nv).map(() => []);
  E.forEach(([a, b, l], k) => { deg[a]++; deg[b]++; adj[a].push([b, k]); adj[b].push([a, k]); });
  const d1 = deg.filter(v => v === 1).length, d2 = range(nv).filter(v => deg[v] === 2);
  const stringy = nv - d1 > 0 ? d2.length / (nv - d1) : 0;
  const striated = d2.filter(v => { const [p, q] = adj[v].map(t => t[0]), a = [pts[p][0] - pts[v][0], pts[p][1] - pts[v][1]], b = [pts[q][0] - pts[v][0], pts[q][1] - pts[v][1]], na = Math.hypot(...a), nb = Math.hypot(...b); return na > 0 && nb > 0 && (a[0] * b[0] + a[1] * b[1]) / (na * nb) < -0.75; }).length / nv;
  // Amas (version robuste ponderee, cassowaryr) : on coupe chaque arete ; les deux sous-arbres pesent selon leur nombre d'aretes
  let clumpy = 0; const seenV = new Uint8Array(nv), st = new Int32Array(nv);
  E.forEach(([a0, , lj], j) => { if (lj <= 0) return; seenV.fill(0); seenV[a0] = 1; let top = 0, neA = 0, mxA = 0; st[top++] = a0;
    while (top) { const v = st[--top]; for (const [u, k] of adj[v]) if (k !== j && !seenV[u]) { seenV[u] = 1; neA++; if (E[k][2] > mxA) mxA = E[k][2]; st[top++] = u; } }
    let neB = 0, mxB = 0; for (let k = 0; k < E.length; k++) if (k !== j && !seenV[E[k][0]]) { neB++; if (E[k][2] > mxB) mxB = E[k][2]; }
    if (neA + neB === 0) return; clumpy = Math.max(clumpy, 1 - (neA * mxA + neB * mxB) / ((neA + neB) * lj)); });
  return { ...base, outlying, skewed: q90 > q10 ? (q90 - q50) / (q90 - q10) : 0, sparse: q90, clumpy, striated, stringy };
}
// toutes les paires de variables quantitatives
// au-dela de 45 paires : pre-tri rapide (rangs sur 1 500 lignes, correlation de distance sur 250) puis analyse complete des 45 paires les plus prometteuses
function scagAll(res, maxFull = 45) {
  if (res.method !== "ACP") return []; const p = res.p, cols = range(p).map(j => res.X.map(r => r[j])), pairs = [];
  for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) pairs.push([i, j]);
  const full = (i, j) => { const s = scagnostics(cols[i], cols[j]); return s ? { i, j, ...s } : null; };
  if (pairs.length <= maxFull) return pairs.map(([i, j]) => full(i, j)).filter(Boolean);
  const idx = sampleRows(res.n, 1500, 29), rk = cols.map(c => ranks(idx.map(i => c[i]))), sub = range(Math.min(250, idx.length));
  const quick = pairs.map(([i, j]) => { const rho = pearson(rk[i], rk[j]), r = res.R[i][j], dR = dcor(sub.map(t => rk[i][t]), sub.map(t => rk[j][t]));
    return { i, j, partial: true, pearson: r, spearman: rho, monotonic: rho * rho, dcorR: dR, nonmono: Math.max(0, dR - Math.abs(rho)), curve: Math.max(0, Math.abs(rho) - Math.abs(r)), score: Math.max(dR - Math.abs(rho), Math.abs(rho) - Math.abs(r), 0.6 * Math.abs(r)) }; });
  const top = new Set(quick.slice().sort((a, b) => b.score - a.score).slice(0, maxFull).map(o => o.i * p + o.j));
  return quick.map(o => (top.has(o.i * p + o.j) ? full(o.i, o.j) || o : o));
}
