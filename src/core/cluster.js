
/* ============================================================================
   Classification : Ward (algorithme de la chaine des plus proches voisins,
   mise a jour de Lance-Williams), k-means pondere, et HCPC (classification
   hierarchique sur composantes principales, Husson, Josse & Pages 2010 ;
   nombre de classes au plus grand rapport de gains d'inertie successifs).
   ============================================================================ */
const cidx = (i, j, n) => (i < j ? i * n - (i * (i + 1)) / 2 + (j - i - 1) : j * n - (j * (j + 1)) / 2 + (i - j - 1));
// Ward sur points ponderes : hauteur d'une fusion = perte d'inertie inter-classes (w_a w_b / (w_a + w_b)) ||g_a - g_b||^2
function ward(P, w) {
  const n = P.length, D = new Float64Array((n * (n - 1)) / 2), W = Float64Array.from(w), act = new Uint8Array(n).fill(1), rep = range(n), merges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let s = 0; for (let k = 0; k < P[i].length; k++) s += (P[i][k] - P[j][k]) ** 2; D[cidx(i, j, n)] = (W[i] * W[j]) / (W[i] + W[j]) * s; }
  const chain = []; let left = n;
  while (left > 1) {
    if (!chain.length) { for (let i = 0; i < n; i++) if (act[i]) { chain.push(i); break; } }
    const a = chain[chain.length - 1], prev = chain.length > 1 ? chain[chain.length - 2] : -1; let b = -1, bd = Infinity;
    for (let c = 0; c < n; c++) if (act[c] && c !== a) { const d = D[cidx(a, c, n)]; if (d < bd || (d === bd && c === prev)) { bd = d; b = c; } }
    if (b === prev) {
      chain.pop(); chain.pop(); merges.push({ ra: rep[a], rb: rep[b], h: bd, size: 0 });
      const wa = W[a], wb = W[b], dab = bd;
      for (let c = 0; c < n; c++) if (act[c] && c !== a && c !== b) { const wc = W[c], dac = D[cidx(a, c, n)], dbc = D[cidx(b, c, n)]; D[cidx(a, c, n)] = ((wa + wc) * dac + (wb + wc) * dbc - wc * dab) / (wa + wb + wc); }
      W[a] = wa + wb; act[b] = 0; left--;
    } else chain.push(b);
  }
  // tri par hauteur puis etiquetage par union-find (arbre au format "lien" : noeuds internes n .. 2n-2)
  merges.sort((x, y) => x.h - y.h); const par = range(n), node = range(n), size = new Array(n).fill(1);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const tree = merges.map((m, t) => { const A = find(m.ra), B = find(m.rb), out = { a: node[A], b: node[B], h: m.h, size: size[A] + size[B] }; par[B] = A; node[A] = n + t; size[A] = out.size; return out; });
  return { n, tree };
}
// ordre des feuilles (parcours en profondeur, sans recursion)
function leafOrder(W) { const { n, tree } = W; if (n === 1) return [0]; const out = [], st = [n + tree.length - 1]; while (st.length) { const v = st.pop(); if (v < n) out.push(v); else { const m = tree[v - n]; st.push(m.b, m.a); } } return out; }
// partition en k classes : on annule les k-1 dernieres fusions
function cutTree(W, k) { const { n, tree } = W, par = range(n), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }, rep = range(n);
  const nodeRep = i => (i < n ? i : rep[i]);
  tree.forEach((m, t) => { rep[n + t] = nodeRep(m.a); if (t < tree.length - (k - 1)) par[find(nodeRep(m.b))] = find(nodeRep(m.a)); });
  const roots = [...new Set(range(n).map(find))]; return range(n).map(i => roots.indexOf(find(i))); }
// k-means pondere a partir de centres donnes
function nearestIdx(p, C) { let bj = 0, bd = Infinity; for (let j = 0; j < C.length; j++) { const c = C[j]; let s = 0; for (let a = 0; a < p.length; a++) { const t = p[a] - c[a]; s += t * t; } if (s < bd) { bd = s; bj = j; } } return bj; }
function kmeansW(P, w, centers, iter = 10) {   // affectation O(n K d), mise a jour O(n d)
  const n = P.length, d = P[0].length, K = centers.length, C = centers.map(c => c.slice()), lab = new Int32Array(n).fill(-1);
  for (let it = 0; it < iter; it++) {
    let moved = false; for (let i = 0; i < n; i++) { const bj = nearestIdx(P[i], C); if (lab[i] !== bj) { lab[i] = bj; moved = true; } }
    const acc = range(K).map(() => new Float64Array(d)), sw = new Float64Array(K);
    for (let i = 0; i < n; i++) { const j = lab[i], wi = w[i], p = P[i]; sw[j] += wi; for (let a = 0; a < d; a++) acc[j][a] += wi * p[a]; }
    for (let j = 0; j < K; j++) if (sw[j] > 0) for (let a = 0; a < d; a++) C[j][a] = acc[j][a] / sw[j];
    if (!moved) break;
  }
  return { labels: Array.from(lab), centers: C };
}
function kppInit(P, K, rnd) {   // initialisation k-means++ (Arthur & Vassilvitskii 2007)
  const n = P.length, C = [P[Math.floor(rnd() * n)].slice()], D = new Float64Array(n).fill(Infinity);
  while (C.length < K) { const last = C[C.length - 1]; let tot = 0; for (let i = 0; i < n; i++) { let s = 0; for (let a = 0; a < last.length; a++) s += (P[i][a] - last[a]) ** 2; if (s < D[i]) D[i] = s; tot += D[i]; } if (tot <= 0) break; let u = rnd() * tot, i = 0; while (u > D[i] && i < n - 1) u -= D[i++]; C.push(P[i].slice()); }
  return C;
}
function centersOf(P, w, lab, K) { const d = P[0].length, C = range(K).map(() => new Array(d).fill(0)), S = new Array(K).fill(0); P.forEach((p, i) => { S[lab[i]] += w[i]; for (let a = 0; a < d; a++) C[lab[i]][a] += w[i] * p[a]; }); return C.map((c, j) => c.map(x => (S[j] > 0 ? x / S[j] : 0))); }
// HCPC complete
function hcpc(res, opts = {}) {
  const cl = mainCloud(res), dims = clamp(opts.dims || res.nAxes, 1, res.q), n0 = cl.P.length, P0 = cl.P.map(f => f.slice(0, dims)), w0s = sum(cl.w), w0 = cl.w.map(x => x / w0s);
  // pre-classification k-means pour les grands tableaux (parametre kk de FactoMineR)
  let P = P0, w = w0, pre = null, preWithin = 0;
  // grands tableaux : k-means++ sur un echantillon de 20 000 individus au plus, puis affectation de tous au centre le plus proche
  if (n0 > 1200) { const rnd = mulberry(5), K0 = Math.min(300, Math.floor(n0 / 4)), sIdx = n0 > 20000 ? sampleRows(n0, 20000, 9) : range(n0), Ps = sIdx.map(i => P0[i]), ws = sIdx.map(i => w0[i]);
    const km = kmeansW(Ps, ws, kppInit(Ps, K0, rnd), 15), raw = P0.map(p => nearestIdx(p, km.centers)), used = [...new Set(raw)].sort((a, b) => a - b), map = new Map(used.map((c, i) => [c, i]));
    const lab = raw.map(l => map.get(l)); P = centersOf(P0, w0, lab, used.length); w = new Array(used.length).fill(0); lab.forEach((l, i) => (w[l] += w0[i]));
    P0.forEach((p, i) => { let s = 0; for (let a = 0; a < dims; a++) s += (p[a] - P[lab[i]][a]) ** 2; preWithin += w0[i] * s; }); pre = lab; }
  const Wd = ward(P, w), m = P.length, gains = Wd.tree.map(t => t.h).reverse(); if (pre) gains.push(preWithin);
  const intra = []; { let acc = 0; for (let i = gains.length - 1; i >= 0; i--) { acc += gains[i]; intra[i] = acc; } }   // intra[k-1] = inertie intra avec k classes
  // nombre de classes : rapport des gains d'inertie successifs, le plus grand saut (Husson, Le & Pages 2017)
  const kmin = Math.max(2, Math.min(opts.min ?? 3, m - 1)), kmax = Math.max(kmin, Math.min(10, Math.round(n0 / 2), m - 1));
  const quot = []; for (let k = kmin; k <= kmax; k++) if (gains[k - 1] > 0) quot.push({ k, q: gains[k - 2] / gains[k - 1] });
  const kAuto = quot.length ? quot.reduce((x, y) => (y.q > x.q ? y : x)).k : kmin, k = clamp(opts.k || kAuto, 2, Math.max(2, m - 1));
  let labP = cutTree(Wd, k), lab = pre ? pre.map(l => labP[l]) : labP;
  let C = centersOf(P0, w0, lab, k);
  if (opts.consol !== false) { const km = kmeansW(P0, w0, C, 10); lab = km.labels; C = km.centers; }
  // ordre des classes selon l'axe 1 (lecture de gauche a droite)
  const ord = range(k).sort((a, b) => C[a][0] - C[b][0]), inv = new Array(k); ord.forEach((c, i) => (inv[c] = i)); lab = lab.map(l => inv[l]); C = ord.map(c => C[c]);
  const tot = sum(P0.map((p, i) => w0[i] * sum(p.map(x => x * x)))), within = sum(P0.map((p, i) => w0[i] * sum(p.map((x, a) => (x - C[lab[i]][a]) ** 2)))), sizes = range(k).map(j => lab.filter(l => l === j).length);
  const dist2 = (p, c) => sum(p.map((x, a) => (x - c[a]) ** 2));
  const paragons = range(k).map(j => range(n0).filter(i => lab[i] === j).sort((a, b) => dist2(P0[a], C[j]) - dist2(P0[b], C[j])).slice(0, 5));
  const specific = range(k).map(j => range(n0).filter(i => lab[i] === j).map(i => [i, minOf(range(k).filter(o => o !== j).map(o => dist2(P0[i], C[o])))]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]));
  return { k, kAuto, dims, labels: lab, centers: C, sizes, R2: tot > 0 ? 1 - within / tot : 0, gains: gains.slice(0, 20), quot, ward: pre ? null : Wd, pre: !!pre, leaves: pre ? null : leafOrder(Wd), paragons, specific, n: n0 };
}
