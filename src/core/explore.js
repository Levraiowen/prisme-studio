
/* ------------------------------------------------------------------ hyperespace : outils mathematiques */
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const lin = (cols, u) => cols[0].map((_, r) => { let s = 0; for (let l = 0; l < cols.length; l++) s += u[l] * cols[l][r]; return s; });   // combinaison des colonnes
const det3 = C => C[0][0] * (C[1][1] * C[2][2] - C[1][2] * C[2][1]) - C[1][0] * (C[0][1] * C[2][2] - C[0][2] * C[2][1]) + C[2][0] * (C[0][1] * C[1][2] - C[0][2] * C[1][1]);
// loi beta incomplete regularisee (fraction continue de Lentz) et quantiles par dichotomie
function betacf(a, b, x) {
  const FP = 1e-300, qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h;
}
function betai(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
function bisect(f, lo, hi) { for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; } return (lo + hi) / 2; }
const betaInv = (p, a, b) => bisect(x => betai(a, b, x) >= p, 0, 1);
const chi2Inv = (p, k) => { let hi = Math.max(2, 2 * k); while (1 - chi2sf(hi, k) < p) hi *= 2; return bisect(x => 1 - chi2sf(x, k) >= p, 0, hi); };
// inverse d'une matrice symetrique definie positive, correlations partielles
function invSym(A) { const e = eigSym(A), n = A.length; if (minOf(e.values) < 1e-9) return null; return range(n).map(i => range(n).map(j => { let s = 0; for (let k = 0; k < n; k++) s += e.vectors[i][k] * e.vectors[j][k] / e.values[k]; return s; })); }
function partialCorr(R) { const P = invSym(R); return P ? P.map((r, i) => r.map((x, j) => (i === j ? 1 : -x / Math.sqrt(P[i][i] * P[j][j])))) : null; }

/* repere : 3 colonnes orthonormees de R^d */
function gsCols(B) { const C = []; for (const v0 of B) { const v = v0.slice(); for (const c of C) { const t = dot(v, c); for (let i = 0; i < v.length; i++) v[i] -= t * c[i]; } const nv = Math.hypot(...v) || 1; C.push(v.map(x => x / nv)); } return C; }
const randFrame = (d, rnd) => gsCols(range(3).map(() => range(d).map(() => gauss(rnd))));
const pcaFrame = d => range(3).map(k => range(d).map(i => +(i === k)));
// geodesique entre deux reperes (angles principaux) + rotation dans le plan : chaque image est une projection orthonormee exacte
function framePath(A, B) {
  const M = range(3).map(i => range(3).map(j => dot(A[i], B[j])));
  const MtM = range(3).map(i => range(3).map(j => M[0][i] * M[0][j] + M[1][i] * M[1][j] + M[2][i] * M[2][j]));
  const e = eigSym(MtM), W = range(3).map(j => range(3).map(i => e.vectors[i][j])), sig = e.values.map(v => Math.sqrt(Math.max(v, 0)));
  const U = W.map((w, j) => { const u = range(3).map(i => M[i][0] * w[0] + M[i][1] * w[1] + M[i][2] * w[2]); return sig[j] > 1e-8 ? u.map(x => x / sig[j]) : null; });
  for (let j = 0; j < 3; j++) if (!U[j]) for (let c = 0; c < 3; c++) { const v = range(3).map(i => +(i === c)); U.forEach(u => { if (u) { const t = dot(v, u); for (let i = 0; i < 3; i++) v[i] -= t * u[i]; } }); const nv = Math.hypot(...v); if (nv > 1e-6) { U[j] = v.map(x => x / nv); break; } }
  const c = sig.slice(); if (det3(U) * det3(W) < 0) { U[2] = U[2].map(x => -x); c[2] = -c[2]; }
  const Ba = U.map(u => lin(A, u)), Bz = W.map(w => lin(B, w)), th = c.map(x => Math.acos(clamp(x, -1, 1)));
  const G = Bz.map((bz, j) => { const s = Math.sin(th[j]); return s > 1e-7 ? bz.map((x, i) => (x - c[j] * Ba[j][i]) / s) : bz.map(() => 0); });
  const K = range(3).map(i => range(3).map(j => U[0][i] * W[0][j] + U[1][i] * W[1][j] + U[2][i] * W[2][j]));
  const qK = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(K[0][0], K[0][1], K[0][2], 0, K[1][0], K[1][1], K[1][2], 0, K[2][0], K[2][1], K[2][2], 0, 0, 0, 0, 1));
  const qI = new THREE.Quaternion(), qt = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const at = t => {
    const P = range(3).map(j => { const ct = Math.cos(t * th[j]), st = Math.sin(t * th[j]); return Ba[j].map((x, i) => ct * x + st * G[j][i]); });
    qt.copy(qI).slerp(qK, t); m4.makeRotationFromQuaternion(qt); const el = m4.elements, S = [[el[0], el[4], el[8]], [el[1], el[5], el[9]], [el[2], el[6], el[10]]];
    const R = range(3).map(j => range(3).map(i => U[j][0] * S[0][i] + U[j][1] * S[1][i] + U[j][2] * S[2][i]));
    return range(3).map(i => P[0].map((_, r) => P[0][r] * R[0][i] + P[1][r] * R[1][i] + P[2][r] * R[2][i]));
  };
  return { at, span: maxOf(th, 2 * Math.acos(Math.min(1, Math.abs(qK.w)))) };
}
// part de l'inertie visible dans un repere : sum_k lambda_k ||B_k||^2 / sum lambda (coordonnees principales non correlees)
const projInertia = (res, B) => { let s = 0; res.vals.forEach((l, k) => (s += l * (B[0][k] ** 2 + B[1][k] ** 2 + B[2][k] ** 2))); return s / sum(res.vals); };
const axisPresence = (res, B) => res.vals.map((_, k) => B[0][k] ** 2 + B[1][k] ** 2 + B[2][k] ** 2);

/* nuage principal : individus (ACP, ACM) ou lignes (AFC), coordonnees completes et poids */
function mainCloud(res) { return res.method === "AFC" ? { P: res.F, w: res.r, names: res.rowL, kind: "row" } : { P: res.F, w: res.F.map(() => 1 / res.n), names: res.names, kind: "ind" }; }
const dist = (a, b, k = a.length) => { let s = 0; for (let i = 0; i < k; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };
// arbre couvrant minimal (Prim) dans l'espace complet
function mstEdges(P) {
  const n = P.length, inT = new Array(n).fill(false), best = new Array(n).fill(Infinity), par = new Array(n).fill(-1), E = []; if (!n) return E; best[0] = 0;
  for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i; inT[u] = true; if (par[u] >= 0) E.push([par[u], u, best[u]]);
    for (let v = 0; v < n; v++) if (!inT[v]) { const d = dist(P[u], P[v]); if (d < best[v]) { best[v] = d; par[v] = u; } } }
  return E;
}
// densite par noyau gaussien 2D (fenetre de Scott, n effectif) : renvoie la fonction densite
function kdeModel(xs, ys, w) {
  const W = sum(w), mx = xs.reduce((s, x, i) => s + w[i] * x, 0) / W, my = ys.reduce((s, y, i) => s + w[i] * y, 0) / W;
  const sx = Math.sqrt(xs.reduce((s, x, i) => s + w[i] * (x - mx) ** 2, 0) / W) || 1, sy = Math.sqrt(ys.reduce((s, y, i) => s + w[i] * (y - my) ** 2, 0) / W) || 1;
  const neff = W * W / sum(w.map(x => x * x)), f = Math.pow(neff, -1 / 6), hx = sx * f, hy = sy * f, c = 1 / (2 * Math.PI * hx * hy * W);
  return { hx, hy, at: (x, y) => { let s = 0; for (let p = 0; p < xs.length; p++) { const a = (x - xs[p]) / hx, b = (y - ys[p]) / hy; s += w[p] * Math.exp(-0.5 * (a * a + b * b)); } return s * c; } };
}
// rotation orthogonale de Procrustes : R minimise ||C R - C0|| (R = M (M'M)^-1/2, M = C'C0)
function procrustesR(C, C0) {
  const m = C0[0].length, M = range(m).map(i => range(m).map(j => C.reduce((s, r, k) => s + r[i] * C0[k][j], 0)));
  const e = eigSym(range(m).map(i => range(m).map(j => M.reduce((s, r) => s + r[i] * r[j], 0))));
  const H = range(m).map(i => range(m).map(j => { let s = 0; for (let k = 0; k < m; k++) s += e.vectors[i][k] * e.vectors[j][k] / Math.sqrt(Math.max(e.values[k], 1e-14)); return s; }));
  return range(m).map(i => range(m).map(j => { let s = 0; for (let k = 0; k < m; k++) s += M[i][k] * H[k][j]; return s; }));
}
// bootstrap total des coordonnees des variables (ACP), aligne par Procrustes sur la solution observee
// grands tableaux : bootstrap "m parmi n" (m = 3 000) et ecarts a la solution observee remis a l'echelle sqrt(m / n)
function bootLoadings(res, B = 120, S = Math.min(res.q, 3)) {
  const rnd = mulberry(11), C0 = res.coord.map(r => r.slice(0, S)), out = [], m = Math.min(res.n, 3000), f = Math.sqrt(m / res.n);
  for (let b = 0; b < B; b++) {
    const X = range(m).map(() => res.X[Math.floor(rnd() * res.n)]), R = corrOf(X); if (R.some(r => r.some(x => !isFinite(x)))) continue;
    const e = eigSym(R), C = R.map((_, j) => range(S).map(k => e.vectors[j][k] * Math.sqrt(Math.max(e.values[k], 0)))), Q = procrustesR(C, C0);
    out.push(C.map((r, j) => range(S).map(k => { const x = r.reduce((s, v, l) => s + v * Q[l][k], 0); return C0[j][k] + f * (x - C0[j][k]); })));
  }
  return out;
}
// diagnostic des atypiques : T2 de Hotelling (dans le modele) et Q / SPE (hors du modele)
function diagTQ(res, A = res.nAxes) {
  const n = res.n, T2 = res.F.map(f => (n - 1) / n * range(A).reduce((s, k) => s + f[k] ** 2 / res.vals[k], 0));
  const Q = res.F.map(f => f.slice(A).reduce((s, x) => s + x * x, 0)), rest = res.vals.slice(A);
  const ucT = (n - 1) ** 2 / n * betaInv(0.95, A / 2, (n - A - 1) / 2);
  const t1 = sum(rest), t2 = sum(rest.map(l => l * l)), ucQ = t1 > 1e-10 ? t2 / t1 * chi2Inv(0.95, t1 * t1 / t2) : null;
  return { T2, Q, ucT, ucQ, A, t1 };
}
// fidelite de la projection : distances completes contre distances sur k axes (statistiques sur toutes les paires, echantillon pour le dessin)
function shepard(res, k, cap = 2500) {
  const mc = mainCloud(res), sub = mc.P.length > 1500 ? sampleRows(mc.P.length, 1500) : null, P = sub ? sub.map(i => mc.P[i]) : mc.P, w = sub ? sub.map(i => mc.w[i]) : mc.w;
  const n = P.length, total = n * (n - 1) / 2, stride = Math.max(1, Math.ceil(total / cap)), D = [], d = [], pairs = [];
  let num = 0, den = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, t = 0, maxD = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, t++) { const a = dist(P[i], P[j]), b = dist(P[i], P[j], k); num += w[i] * w[j] * b * b; den += w[i] * w[j] * a * a; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; if (a > maxD) maxD = a; if (t % stride === 0) { D.push(a); d.push(b); pairs.push([i, j]); } }
  const cxy = sxy - sx * sy / total, cxx = sxx - sx * sx / total, cyy = syy - sy * sy / total;
  const idx = n > 800 ? sampleRows(n, 800) : range(n), m = idx.length, k0 = Math.min(5, m - 2); let keep = 0;
  if (k0 >= 1) for (const i of idx) { const o = idx.filter(j => j !== i); const nf = new Set(o.slice().sort((a, b) => dist(P[i], P[a]) - dist(P[i], P[b])).slice(0, k0)); o.sort((a, b) => dist(P[i], P[a], k) - dist(P[i], P[b], k)).slice(0, k0).forEach(j => nf.has(j) && keep++); }
  return { D, d, pairs, maxD, sampled: stride > 1, total, approx: !!sub, nUsed: n, kept: den ? num / den : 1, r: cxx > 0 && cyy > 0 ? cxy / Math.sqrt(cxx * cyy) : 1, knn: k0 >= 1 ? keep / (m * k0) : 1, k0, base: k0 / Math.max(m - 1, 1) };
}
// echantillon aleatoire sans remise (Fisher-Yates partiel, O(n)), indices tries, reproductible par graine
const sampleRows = (n, cap, seed = 5) => { if (n <= cap) return range(n); const rnd = mulberry(seed), a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = i; for (let i = 0; i < cap; i++) { const j = i + Math.floor(rnd() * (n - i)), t = a[i]; a[i] = a[j]; a[j] = t; } return Array.from(a.subarray(0, cap)).sort((x, y) => x - y); };
// flux d'inertie : chaque source (variable ou ligne) repartit son inertie entre les axes ; chaque axe recoit lambda
function inertiaFlows(res) {
  if (res.method === "ACP") return { label: "Variables", src: res.vars.map((v, j) => ({ l: v, f: res.coord[j].map(c => c * c) })) };
  if (res.method === "ACM") return { label: "Variables", src: res.vars.map((v, j) => ({ l: v, f: res.eta2[j].map(e => e / res.K) })) };
  return { label: res.rowName, src: res.rowL.map((l, i) => ({ l, f: res.F[i].map(x => res.r[i] * x * x) })) };
}
// ordre des variables selon leur angle sur le plan 1-2 (variables voisines = correlees)
function varOrder(res) { return range(res.p).sort((a, b) => Math.atan2(res.coord[a][1] || 0, res.coord[a][0]) - Math.atan2(res.coord[b][1] || 0, res.coord[b][0])); }
// reconstruction du tableau centre-reduit a partir de k axes (Eckart-Young)
const reconstruct = (res, k) => res.F.map(f => res.V.map(v => { let s = 0; for (let l = 0; l < k; l++) s += f[l] * v[l]; return s; }));
// palette continue (bleu -> cyan -> vert -> ambre -> corail)
const RAMP = ["#3B5BFF", "#4FD8E8", "#8FEA86", "#FFC85C", "#FF5E62"];
function ramp(t) { t = clamp(t, 0, 1) * (RAMP.length - 1); const i = Math.min(Math.floor(t), RAMP.length - 2), f = t - i, a = RAMP[i], b = RAMP[i + 1];
  const h = (s, o) => parseInt(s.slice(o, o + 2), 16), c = o => Math.round(h(a, o) + (h(b, o) - h(a, o)) * f).toString(16).padStart(2, "0"); return "#" + c(1) + c(3) + c(5); }
const rampCSS = `linear-gradient(90deg,${RAMP.join(",")})`;

// memoisation par resultat d'analyse (recalcul uniquement quand l'analyse change)
const memo = f => { let k = null, v = null; return res => (k === res ? v : ((k = res), (v = f(res)))); };
const diagCache = memo(res => diagTQ(res));
const uncCache = memo(res => bootLoadings(res, 120));
