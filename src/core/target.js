
/* ============================================================================
   Mode supervise : une variable cible (defaut de paiement, depart d'un client,
   montant...), ce qui l'explique, et un arbre de decision lisible.
   - cible binaire : taux par modalite et par decile, valeur d'information (IV,
     usage du scoring de credit : Siddiqi 2006), AUC de Mann-Whitney et Gini ;
   - cible numerique : moyenne par modalite et par decile, rho de Spearman, eta2 ;
   - cible a plusieurs classes : V de Cramer et eta2 ;
   - arbre CART (Breiman, Friedman, Olshen & Stone 1984) : Gini ou variance,
     coupures sur quantiles, partition optimale des modalites triees par taux.
   ============================================================================ */
// bandes usuelles du scoring (Siddiqi 2006) ; au-dela de 0,5 la variable est tres forte : a verifier
const IV_LABEL = iv => (iv < 0.02 ? "inutile" : iv < 0.1 ? "faible" : iv < 0.3 ? "moyen" : iv < 0.5 ? "fort" : "très fort");
// fuite probable : separation quasi parfaite de la cible (AUC >= 0,95, ou IV >= 2 pour une qualitative), souvent une variable mesuree apres l'evenement
const isLeak = o => (o.auc !== undefined ? Math.max(o.auc, 1 - o.auc) >= 0.95 : o.iv >= 2);
// cible : binaire (0/1, deux modalites, ou une modalite contre les autres), numerique, ou a quelques classes
function targetSpec(rows, target, positive = null) {
  const ci = colInfo(rows, target), n = rows.length;
  if (ci.isNum) {
    const vals = new Set(); for (let i = 0; i < n && vals.size <= 2; i++) { const v = ci.num[i]; if (v === v) vals.add(v); }
    if (vals.size <= 2 && [...vals].every(v => v === 0 || v === 1)) return { kind: "bin", col: target, y: ci.num, posLabel: "1", negLabel: "0" };
    return { kind: "num", col: target, y: ci.num };
  }
  const { code, names, count } = ci.cats; if (names.length < 2) return null;
  if (positive !== null || names.length === 2) {
    const pos = positive !== null ? names.indexOf(String(positive)) : count[0] <= count[1] ? 0 : 1; if (pos < 0) return null;
    const y = new Float64Array(n); for (let i = 0; i < n; i++) y[i] = code[i] < 0 ? NaN : code[i] === pos ? 1 : 0;
    return { kind: "bin", col: target, y, posLabel: names[pos], negLabel: names.length === 2 ? names[1 - pos] : "autres", names };
  }
  if (names.length > 20) return null;
  const y = new Float64Array(n); for (let i = 0; i < n; i++) y[i] = code[i] < 0 ? NaN : code[i];
  return { kind: "cat", col: target, y, names };
}
// importance de chaque variable pour la cible (sur 200 000 lignes tirees au hasard au-dela)
function targetImportance(table, rows, spec, cols) {
  const n = rows.length, idx = n > 200000 ? sampleRows(n, 200000, 97) : range(n), y = spec.y, out = [];
  for (const c of cols) {
    if (c === spec.col) continue; const ci = colInfo(rows, c); if (!ci.nonNull) continue;
    if (ci.isNum) {
      const xs = [], ys = []; for (const i of idx) { const x = ci.num[i], v = y[i]; if (x === x && v === v) { xs.push(x); ys.push(v); } } if (xs.length < 20) continue;
      // deciles de x (bornes uniques) : effectif et moyenne de la cible
      const srt = Float64Array.from(xs).sort(), cuts = [...new Set(range(9).map(k => quantile(srt, (k + 1) / 10)))], nb = cuts.length + 1, bn = new Float64Array(nb), bs = new Float64Array(nb), lo = new Array(nb).fill(Infinity), hi = new Array(nb).fill(-Infinity);
      const binOf = x => { let a = 0, b = cuts.length; while (a < b) { const m = (a + b) >> 1; if (x <= cuts[m]) b = m; else a = m + 1; } return a; };
      xs.forEach((x, t) => { const k = binOf(x); bn[k]++; bs[k] += ys[t]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; });
      const bins = range(nb).filter(k => bn[k]).map(k => ({ lo: lo[k], hi: hi[k], n: bn[k], m: bs[k] / bn[k] })), o = { col: c, type: "num", bins, n: xs.length };
      // AUC de Mann-Whitney sur 50 000 lignes au plus, IV sur les deciles
      if (spec.kind === "bin") { const m = Math.min(xs.length, 50000), r = ranks(xs.slice(0, m)); let r1 = 0, n1 = 0; for (let t = 0; t < m; t++) if (ys[t] === 1) { r1 += r[t]; n1++; } const n0 = m - n1; o.auc = n1 && n0 ? (r1 - n1 * (n1 + 1) / 2) / (n1 * n0) : 0.5; o.gini = 2 * o.auc - 1; o.iv = ivOf(bins.map(b => [b.m * b.n, (1 - b.m) * b.n])); o.score = o.iv; }
      else if (spec.kind === "num") { o.rho = spearman(xs, ys); o.r = pearson(xs, ys); o.score = Math.abs(o.rho); }
      else { const a = anova(xs, ys); o.eta2 = a.eta2; o.score = Math.sqrt(a.eta2); }
      out.push(o);
    } else {
      const { code, names } = ci.cats; if (names.length > 60 || names.length < 2) continue;
      const cn = new Float64Array(names.length), cs = new Float64Array(names.length), yy = [], gg = [];
      for (const i of idx) { const k = code[i], v = y[i]; if (k < 0 || v !== v) continue; cn[k]++; cs[k] += v; if (spec.kind !== "bin") { yy.push(v); gg.push(k); } }
      const mods = range(names.length).filter(k => cn[k]).map(k => ({ l: names[k], n: cn[k], m: cs[k] / cn[k] })).sort((a, b) => b.m - a.m), o = { col: c, type: "cat", mods, n: sum(mods.map(m => m.n)) };
      if (spec.kind === "bin") { o.iv = ivOf(mods.map(m => [m.m * m.n, (1 - m.m) * m.n])); o.score = o.iv; }
      else if (spec.kind === "num") { const a = anova(yy, gg); o.eta2 = a.eta2; o.score = Math.sqrt(a.eta2); }
      else { const cv = cramerV(gg, yy); o.V = cv.v; o.score = cv.v; }
      out.push(o);
    }
  }
  return { list: out.sort((a, b) => b.score - a.score), sampled: idx.length < n, n: idx.length };
}
// valeur d'information : somme de (p_evenement - p_non_evenement) * ln(p_evenement / p_non_evenement), lissage de 0,5
function ivOf(groups) { const E = sum(groups.map(g => g[0])), N = sum(groups.map(g => g[1])); if (!E || !N) return 0; let iv = 0; for (const [e, ne] of groups) { const pe = (e + 0.5) / (E + 0.5 * groups.length), pn = (ne + 0.5) / (N + 0.5 * groups.length); iv += (pe - pn) * Math.log(pe / pn); } return iv; }

// ---------------------------------------------------------------- arbre de decision CART
function cartFit(table, rows, spec, cols, opts = {}) {
  const t0 = performance.now(), n0 = rows.length, maxDepth = opts.depth || 3, y = spec.y, cls = spec.kind === "cat" ? spec.names.length : spec.kind === "bin" ? 2 : 0;
  // variables recodees en cases : 32 intervalles de quantiles (nombres) ou modalites (<= 60), 255 = manquant
  const feats = [];
  for (const c of cols) { if (c === spec.col) continue; const ci = colInfo(rows, c); if (!ci.nonNull) continue;
    if (ci.isNum) { const smp = Float64Array.from(n0 > 50000 ? sampleRows(n0, 50000, 7).map(i => ci.num[i]) : ci.num).filter(v => v === v).sort(); if (smp.length < 20) continue;
      const edges = [...new Set(range(31).map(k => quantile(smp, (k + 1) / 32)))]; if (!edges.length) continue; const code = new Uint8Array(n0);
      for (let i = 0; i < n0; i++) { const x = ci.num[i]; if (x !== x) { code[i] = 255; continue; } let a = 0, b = edges.length; while (a < b) { const m = (a + b) >> 1; if (x <= edges[m]) b = m; else a = m + 1; } code[i] = a; }
      feats.push({ col: c, type: "num", code, nb: edges.length + 1, edges }); }
    else { const { code: cc, names } = ci.cats; if (names.length > 60 || names.length < 2) continue; const code = new Uint8Array(n0); for (let i = 0; i < n0; i++) code[i] = cc[i] < 0 ? 255 : cc[i]; feats.push({ col: c, type: "cat", code, nb: names.length, names }); } }
  // apprentissage sur 100 000 lignes au plus ; les feuilles sont ensuite recalculees sur toutes les lignes
  const all = range(n0).filter(i => y[i] === y[i]), learn = all.length > 100000 ? sampleRows(all.length, 100000, 131).map(k => all[k]) : all;
  const minLeaf = Math.max(opts.minLeaf || 30, Math.floor(learn.length * 0.01));
  const stat = I => { if (cls) { const h = new Float64Array(cls); for (const i of I) h[y[i]]++; const N = I.length; let g = 1; for (let k = 0; k < cls; k++) g -= (h[k] / N) ** 2; return { N, imp: g * N, h }; } let s = 0, q = 0; for (const i of I) { s += y[i]; q += y[i] * y[i]; } const N = I.length; return { N, imp: q - s * s / N, s }; };
  const impOf = (a, N) => { if (!N) return 0; if (cls) { let g = 1; for (let k = 0; k < cls; k++) g -= (a[k] / N) ** 2; return g * N; } return a[1] - a[0] * a[0] / N; };   // a = [somme, somme des carres] en regression
  function bestSplit(I, parentImp, st) {
    let best = null; const maj = cls ? Array.from(st.h).indexOf(maxOf(st.h)) : 0;
    for (const f of feats) {
      const B = f.nb + 1, W = cls || 2, H = new Float64Array(B * W), cnt = new Float64Array(B);   // case B-1 : manquants
      for (const i of I) { const b = f.code[i] === 255 ? B - 1 : f.code[i]; cnt[b]++; if (cls) H[b * W + y[i]]++; else { H[b * W] += y[i]; H[b * W + 1] += y[i] * y[i]; } }
      // modalites triees par taux : la meilleure partition en deux est alors un prefixe (optimal en binaire et en regression)
      let order = range(B - 1).filter(b => cnt[b]);
      if (f.type === "cat") { const key = b => (cls === 2 ? H[b * W + 1] / cnt[b] : cls ? H[b * W + maj] / cnt[b] : H[b * W] / cnt[b]); order = order.sort((a, b2) => key(a) - key(b2)); }
      if (cnt[B - 1]) order.push(B - 1);   // manquants toujours du cote droit
      const L = new Float64Array(W), T = new Float64Array(W); for (const b of order) for (let k = 0; k < W; k++) T[k] += H[b * W + k];
      let nL = 0; const N = I.length;
      for (let o = 0; o < order.length - 1; o++) { const b = order[o]; nL += cnt[b]; for (let k = 0; k < W; k++) L[k] += H[b * W + k]; const nR = N - nL; if (nL < minLeaf || nR < minLeaf) continue;
        const R = T.map((v, k) => v - L[k]), gain = parentImp - impOf(cls ? L : [L[0], L[1]], nL) - impOf(cls ? R : [R[0], R[1]], nR);
        if (!best || gain > best.gain) best = { gain, f, left: new Set(order.slice(0, o + 1)) }; }
    }
    return best;
  }
  function grow(I, depth) {
    const st = stat(I), node = { n: I.length, depth };
    node.value = cls === 2 ? st.h[1] / st.N : cls ? Array.from(st.h, v => v / st.N) : st.s / st.N;
    if (depth < maxDepth && st.imp > 1e-9) { const sp = bestSplit(I, st.imp, st);
      if (sp && sp.gain > st.imp * 0.002) { const f = sp.f, goL = i => sp.left.has(f.code[i] === 255 ? f.nb : f.code[i]);
        node.split = { col: f.col, type: f.type, left: sp.left, f }; node.left = grow(I.filter(goL), depth + 1); node.right = grow(I.filter(i => !goL(i)), depth + 1); } }
    return node;
  }
  const root = grow(learn, 0);
  // regles lisibles : intervalle pour un nombre, liste de modalites pour une qualitative
  const describe = (f, set, isLeft) => { if (f.type === "num") { const inS = [...set].filter(b => b < f.nb), maxB = Math.max(...inS), thr = f.edges[Math.min(maxB, f.edges.length - 1)], miss = set.has(f.nb);
      if (maxB >= f.edges.length) return isLeft ? `${f.col} renseigné` : `${f.col} manquant`;
      return isLeft ? `${f.col} ≤ ${fmtNum(thr)}` : `${f.col} > ${fmtNum(thr)}${!miss && f.code.includes(255) ? " ou manquant" : ""}`; }
    const mods = range(f.nb).filter(b => (isLeft ? set.has(b) : !set.has(b))).map(b => f.names[b]); return mods.length === 1 ? `${f.col} = ${mods[0]}` : `${f.col} ∈ {${mods.slice(0, 4).join(", ")}${mods.length > 4 ? ", …" : ""}}`; };
  const leaves = []; (function walk(nd, path) { if (!nd.split) { nd.leaf = leaves.length; nd.path = path; leaves.push(nd); return; } nd.left.rule = describe(nd.split.f, nd.split.left, true); nd.right.rule = describe(nd.split.f, nd.split.left, false); walk(nd.left, path.concat(nd.left.rule)); walk(nd.right, path.concat(nd.right.rule)); })(root, []);
  // chaque ligne rejoint sa feuille : effectifs et valeurs exacts sur toutes les lignes
  const leafOf = i => { let nd = root; while (nd.split) { const f = nd.split.f, b = f.code[i] === 255 ? f.nb : f.code[i]; nd = nd.split.left.has(b) ? nd.left : nd.right; } return nd.leaf; };
  const acc = leaves.map(() => ({ n: 0, s: 0, h: cls ? new Float64Array(cls) : null })); for (const i of all) { const a = acc[leafOf(i)]; a.n++; if (cls) a.h[y[i]]++; else a.s += y[i]; }
  leaves.forEach((lf, k) => { const a = acc[k]; lf.nAll = a.n; lf.valueAll = cls === 2 ? (a.n ? a.h[1] / a.n : NaN) : cls ? Array.from(a.h, v => v / (a.n || 1)) : a.n ? a.s / a.n : NaN; });
  const res = { root, leaves, kind: spec.kind, n: all.length, learned: learn.length, sampled: learn.length < all.length, ms: 0, depth: maxDepth };
  if (cls === 2) { // AUC de l'arbre : feuilles triees par taux, paires (evenement, non-evenement) bien ordonnees
    const L = acc.map((a, k) => ({ p: a.h[1], q: a.h[0], r: leaves[k].valueAll })).sort((a, b) => a.r - b.r), P = sum(L.map(l => l.p)), Q = sum(L.map(l => l.q)); let before = 0, s = 0; for (const l of L) { s += l.p * (before + 0.5 * l.q); before += l.q; } res.auc = P && Q ? s / (P * Q) : 0.5; }
  if (!cls) { let sse = 0, sst = 0, m = 0; for (const i of all) m += y[i]; m /= all.length || 1; for (const i of all) { const v = leaves[leafOf(i)].valueAll; sse += (y[i] - v) ** 2; sst += (y[i] - m) ** 2; } res.r2 = sst > 0 ? 1 - sse / sst : 0; }
  res.ms = performance.now() - t0; return res;
}
// arbre sans les tableaux de codes (transferable entre fils de calcul, affichable)
function treeJSON(tree) {
  const node = nd => ({ n: nd.n, depth: nd.depth, value: nd.value, rule: nd.rule || null, leaf: nd.leaf ?? null, nAll: nd.nAll ?? null, valueAll: nd.valueAll ?? null, path: nd.path || null, split: nd.split ? nd.split.col : null, left: nd.left ? node(nd.left) : null, right: nd.right ? node(nd.right) : null });
  const root = node(tree.root), leaves = []; (function walk(nd) { if (nd.leaf !== null) leaves[nd.leaf] = nd; if (nd.left) walk(nd.left); if (nd.right) walk(nd.right); })(root);
  return { ...tree, root, leaves };
}
// calcul complet du mode supervise (fil de calcul ou page) ; les variables suspectes de fuite sont exclues de l'arbre
function targetRun(t, p) {
  if (!t.columns.includes(p.target)) throw new Error(`Colonne introuvable dans ce tableau : ${p.target}.`);
  const t0 = performance.now(), spec = targetSpec(t.rows, p.target, p.positive ?? null); if (!spec) throw new Error("Cette variable ne peut pas servir de cible : vide, constante ou à plus de 20 modalités.");
  const imp = targetImportance(t, t.rows, spec, p.cols), leak = spec.kind === "bin" ? imp.list.filter(isLeak).map(o => o.col) : [];
  const tree = cartFit(t, t.rows, spec, p.cols.filter(c => !leak.includes(c)), { depth: p.depth || 3 });
  let y = 0, k = 0; for (const v of spec.y) if (v === v) { y += v; k++; }
  return { spec: { kind: spec.kind, col: spec.col, posLabel: spec.posLabel, negLabel: spec.negLabel, names: spec.names, mean: k ? y / k : NaN, n: k }, imp, leak, tree: treeJSON(tree), ms: performance.now() - t0 };
}
