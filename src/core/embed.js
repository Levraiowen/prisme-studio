
/* ============================================================================
   Projections non lineaires et mesure de leur fidelite.
   t-SNE exact : van der Maaten & Hinton (2008), taux d'apprentissage "auto"
   (Belkina et al. 2019). UMAP : McInnes, Healy & Melville (2018), via umap-js.
   Fiabilite (trustworthiness) et continuite : Venna & Kaski (2001, 2006).
   ============================================================================ */
class TSNE {
  constructor(X, o = {}) {
    const n = X.length, d = X[0].length, dim = o.dim || 2; this.n = n; this.dim = dim; this.it = 0;
    const perp = Math.max(2, Math.min(o.perplexity || 30, (n - 1) / 3)), logU = Math.log(perp), D = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let s = 0; for (let k = 0; k < d; k++) s += (X[i][k] - X[j][k]) ** 2; D[i * n + j] = D[j * n + i] = s; }
    const P = new Float64Array(n * n), row = new Float64Array(n);
    for (let i = 0; i < n; i++) {   // recherche dichotomique de la precision pour atteindre la perplexite
      let beta = 1, lo = -Infinity, hi = Infinity;
      for (let t = 0; t < 60; t++) {
        let sP = 0; for (let j = 0; j < n; j++) { row[j] = j === i ? 0 : Math.exp(-D[i * n + j] * beta); sP += row[j]; }
        if (sP === 0) sP = 1e-300; let H = 0; for (let j = 0; j < n; j++) if (row[j] > 0) { const p = row[j] / sP; H -= p * Math.log(p); }
        for (let j = 0; j < n; j++) row[j] /= sP;
        if (Math.abs(H - logU) < 1e-5) break; if (H > logU) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; } else { hi = beta; beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2; }
      }
      for (let j = 0; j < n; j++) P[i * n + j] = row[j];
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const v = Math.max((P[i * n + j] + P[j * n + i]) / (2 * n), 1e-12); P[i * n + j] = P[j * n + i] = v; }
    this.P = P; let seed = o.seed || 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    this.Y = new Float64Array(n * dim).map(() => g() * 1e-4); this.U = new Float64Array(n * dim); this.G = new Float64Array(n * dim).fill(1);
    this.eta = Math.max(n / 12 / 4, 50); this.Q = new Float64Array(n * n);
  }
  step() {
    const { n, dim, Y, P, Q, U, G } = this, ex = this.it < 250 ? 12 : 1, mom = this.it < 250 ? 0.5 : 0.8; let Z = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let s = 0; for (let k = 0; k < dim; k++) s += (Y[i * dim + k] - Y[j * dim + k]) ** 2; const q = 1 / (1 + s); Q[i * n + j] = Q[j * n + i] = q; Z += 2 * q; }
    const grad = new Float64Array(n * dim);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; const q = Q[i * n + j], m = 4 * (ex * P[i * n + j] - q / Z) * q; for (let k = 0; k < dim; k++) grad[i * dim + k] += m * (Y[i * dim + k] - Y[j * dim + k]); }
    const mean = new Float64Array(dim);
    for (let t = 0; t < n * dim; t++) { G[t] = Math.sign(grad[t]) !== Math.sign(U[t]) ? G[t] + 0.2 : Math.max(G[t] * 0.8, 0.01); U[t] = mom * U[t] - this.eta * G[t] * grad[t]; Y[t] += U[t]; mean[t % dim] += Y[t] / n; }
    for (let t = 0; t < n * dim; t++) Y[t] -= mean[t % dim];
    this.it++; return this;
  }
  get kl() { const { n, P, Q } = this; let Z = 0, kl = 0; for (let t = 0; t < n * n; t++) Z += Q[t]; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) kl += P[i * n + j] * Math.log(P[i * n + j] / Math.max(Q[i * n + j] / Z, 1e-300)); return kl; }
}
const asRows = (Y, n, dim) => range(n).map(i => Array.from(Y.subarray(i * dim, i * dim + dim)));
// execution en arriere-plan (Web Worker) avec repli sur le fil principal par tranches
function runTSNE(X, opts, onProgress) {
  const iters = opts.iters || (X.length > 800 ? 700 : 1000), every = opts.every || 10;
  return new Promise(resolve => {
    let worker = null;
    try {
      const src = `const TSNE = ${TSNE.toString()};\nself.onmessage = e => { const { X, opts, iters, every } = e.data; const t = new TSNE(X, opts); for (let it = 0; it < iters; it++) { t.step(); if (it % every === 0 || it === iters - 1) self.postMessage({ it: it + 1, iters, Y: t.Y, kl: it === iters - 1 ? t.kl : null }); } };`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      worker.onmessage = e => { const { it, Y, kl } = e.data, rows = asRows(Y, X.length, opts.dim || 2); onProgress?.(rows, it / iters); if (it >= iters) { worker.terminate(); resolve({ Y: rows, kl, worker: true }); } };
      worker.onerror = () => { worker.terminate(); worker = null; mainThread(); };
      worker.postMessage({ X, opts, iters, every });
    } catch (e) { mainThread(); }
    function mainThread() { const t = new TSNE(X, opts); let it = 0; const tick = () => { const t0 = performance.now(); while (it < iters && performance.now() - t0 < 24) { t.step(); it++; } const rows = asRows(t.Y, X.length, opts.dim || 2); onProgress?.(rows, it / iters); if (it < iters) setTimeout(tick, 0); else resolve({ Y: rows, kl: t.kl, worker: false }); }; tick(); }
  });
}
let umapLoading = null;
function loadUMAP() { if (window.UMAP) return Promise.resolve(); return (umapLoading ??= new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/umap-js@1.4.0/lib/umap-js.min.js"; s.onload = ok; s.onerror = () => { umapLoading = null; ko(new Error("Impossible de charger UMAP (connexion internet nécessaire).")); }; document.head.appendChild(s); })); }
async function runUMAP(X, opts, onProgress) {
  await loadUMAP(); const Cls = window.UMAP.UMAP || window.UMAP, rnd = mulberry(opts.seed || 7);
  const u = new Cls({ nComponents: opts.dim || 2, nNeighbors: Math.min(opts.nNeighbors || 15, X.length - 1), minDist: opts.minDist ?? 0.1, random: rnd });
  const nE = u.initializeFit(X);
  return new Promise(resolve => { let e = 0; const tick = () => { const t0 = performance.now(); while (e < nE && performance.now() - t0 < 24) { u.step(); e++; } const Y = u.getEmbedding().map(r => Array.from(r)); onProgress?.(Y, e / nE); if (e < nE) setTimeout(tick, 0); else resolve({ Y }); }; tick(); });
}
// fiabilite et continuite (globales et par point) sur les k plus proches voisins
function neighborhoodQuality(Xh, Yl, k = 10, cap = 1200) {
  let idx = range(Xh.length); if (idx.length > cap) { const rnd = mulberry(3); idx = idx.map(i => [rnd(), i]).sort((a, b) => a[0] - b[0]).slice(0, cap).map(x => x[1]).sort((a, b) => a - b); }
  const n = idx.length; k = Math.max(1, Math.min(k, Math.floor((n - 1) / 2)));
  const rankMat = X => { const R = new Int32Array(n * n), nn = []; for (let i = 0; i < n; i++) { const d = idx.map((g, j) => [j, j === i ? -1 : dist(X[idx[i]], X[g])]).sort((a, b) => a[1] - b[1]); d.forEach(([j], r) => (R[i * n + j] = r)); nn.push(new Set(d.slice(1, k + 1).map(x => x[0]))); } return { R, nn }; };
  const H = rankMat(Xh), L = rankMat(Yl), norm = 2 / (k * (2 * n - 3 * k - 1));
  let st = 0, sc = 0, ov = 0; const trust = new Float64Array(n), cont = new Float64Array(n);
  for (let i = 0; i < n; i++) { let ti = 0, ci = 0; L.nn[i].forEach(j => { if (!H.nn[i].has(j)) ti += H.R[i * n + j] - k; else ov++; }); H.nn[i].forEach(j => { if (!L.nn[i].has(j)) ci += L.R[i * n + j] - k; }); trust[i] = 1 - norm * ti; cont[i] = 1 - norm * ci; st += ti; sc += ci; }
  return { T: 1 - norm * st / n, C: 1 - norm * sc / n, knn: ov / (n * k), k, n, idx, trust, cont };
}
