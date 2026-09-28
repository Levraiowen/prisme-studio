
/* ============================================================================
   Statistiques : lois, moments, rangs, dependances, valeurs-tests.
   References : Lebart, Morineau & Piron (1995) pour les valeurs-tests ;
   Szekely, Rizzo & Bakirov (2007) pour la correlation de distance ;
   SAS/Sarle pour le coefficient de bimodalite.
   ============================================================================ */
// loi normale : queue exacte via chi2 a 1 ddl, quantile d'Acklam raffine par Newton
const normSf = z => (z >= 0 ? 0.5 * chi2sf(z * z, 1) : 1 - 0.5 * chi2sf(z * z, 1));
const normCdf = z => 1 - normSf(z);
function normInv(p) {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
    b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
    c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
    d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x; const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = normCdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); return x - u / (1 + x * u / 2);
}
// loi de Fisher : P(F > f)
const fSf = (f, d1, d2) => (f <= 0 ? 1 : betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f)));
const lchoose = (n, k) => gammln(n + 1) - gammln(k + 1) - gammln(n - k + 1);

/* ---------------------------------------------------------------- moments et quantiles */
const finite = a => a.filter(x => Number.isFinite(x));
const mean = a => sum(a) / a.length;
const varPop = a => { const m = mean(a); return sum(a.map(x => (x - m) ** 2)) / a.length; };
const sdPop = a => Math.sqrt(varPop(a));
function quantile(sorted, p) { if (!sorted.length) return NaN; const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo); }
function describe(values) {   // resume d'une variable quantitative (valeurs manquantes exclues)
  const v = finite(values), n = v.length, s = v.slice().sort((a, b) => a - b); if (!n) return { n: 0, miss: values.length };
  const m = mean(v), sd = n > 1 ? Math.sqrt(sum(v.map(x => (x - m) ** 2)) / (n - 1)) : 0;
  const m2 = sum(v.map(x => (x - m) ** 2)) / n, m3 = sum(v.map(x => (x - m) ** 3)) / n, m4 = sum(v.map(x => (x - m) ** 4)) / n;
  const g1 = m2 > 0 ? m3 / m2 ** 1.5 : 0, g2 = m2 > 0 ? m4 / (m2 * m2) - 3 : 0;
  const G1 = n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : 0, G2 = n > 3 ? ((n + 1) * g2 + 6) * (n - 1) / ((n - 2) * (n - 3)) : 0;   // estimateurs ajustes (Joanes & Gill 1998)
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const bc = n > 3 ? (G1 * G1 + 1) / (G2 + 3 * (n - 1) ** 2 / ((n - 2) * (n - 3))) : 0;   // coefficient de bimodalite (> 5/9 : suspect)
  return { n, miss: values.length - n, mean: m, sd, min: s[0], q1, med: quantile(s, 0.5), q3, max: s[n - 1], iqr, skew: G1, kurt: G2, bc,
    out: v.filter(x => x < lo || x > hi).length, uniq: new Set(v).size, sorted: s };
}
function histogram(sorted, maxBins = 24) {   // regle de Freedman-Diaconis bornee
  const n = sorted.length; if (!n) return { bins: [], lo: 0, hi: 1 };
  const lo = sorted[0], hi = sorted[n - 1]; if (hi === lo) return { bins: [n], lo, hi: lo + 1, w: 1 };
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25), fd = iqr > 0 ? 2 * iqr / Math.cbrt(n) : (hi - lo) / Math.sqrt(n);
  const k = clamp(Math.ceil((hi - lo) / fd), 5, maxBins), w = (hi - lo) / k, bins = new Array(k).fill(0);
  sorted.forEach(x => bins[Math.min(k - 1, Math.floor((x - lo) / w))]++); return { bins, lo, hi, w };
}

/* ---------------------------------------------------------------- dependances */
function ranks(a) { const o = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const avg = (i + j) / 2 + 1; for (let t = i; t <= j; t++) r[o[t][1]] = avg; i = j + 1; } return r; }
function pearson(x, y) { const n = x.length, mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; } return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0; }
const spearman = (x, y) => pearson(ranks(x), ranks(y));
function dcor(x0, y0) {   // correlation de distance (O(n) memoire, tableaux types) : 0 si et seulement si independance
  const n = x0.length; if (n < 4) return 0; const x = Float64Array.from(x0), y = Float64Array.from(y0), ra = new Float64Array(n), rb = new Float64Array(n);
  for (let i = 0; i < n; i++) { const xi = x[i], yi = y[i]; let sa = 0, sb = 0; for (let j = 0; j < n; j++) { const a = xi - x[j], b = yi - y[j]; sa += a < 0 ? -a : a; sb += b < 0 ? -b : b; } ra[i] = sa / n; rb[i] = sb / n; }
  let ga = 0, gb = 0; for (let i = 0; i < n; i++) { ga += ra[i]; gb += rb[i]; } ga /= n; gb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const xi = x[i], yi = y[i], ci = ra[i] - ga, di = rb[i] - gb; for (let j = 0; j < n; j++) { const a = xi - x[j], b = yi - y[j], A = (a < 0 ? -a : a) - ci - ra[j], B = (b < 0 ? -b : b) - di - rb[j]; sab += A * B; saa += A * A; sbb += B * B; } }
  return saa > 0 && sbb > 0 ? Math.sqrt(Math.max(sab, 0) / Math.sqrt(saa * sbb)) : 0;
}
function anova(y, groups) {   // eta2 et test F d'une variable quantitative selon un facteur
  const cats = [...new Set(groups)], n = y.length, m = mean(y); let ssb = 0, sst = 0;
  cats.forEach(c => { const v = y.filter((_, i) => groups[i] === c); if (v.length) ssb += v.length * (mean(v) - m) ** 2; }); y.forEach(x => (sst += (x - m) ** 2));
  const k = cats.length, F = k > 1 && n > k && sst > ssb ? (ssb / (k - 1)) / ((sst - ssb) / (n - k)) : 0;
  return { eta2: sst > 0 ? ssb / sst : 0, F, p: k > 1 && n > k ? fSf(F, k - 1, n - k) : 1, k };
}
function cramerV(a, b) {   // V de Cramer entre deux variables qualitatives
  const ca = [...new Set(a)], cb = [...new Set(b)], n = a.length, N = ca.map(() => cb.map(() => 0)), ia = new Map(ca.map((x, i) => [x, i])), ib = new Map(cb.map((x, j) => [x, j])); a.forEach((x, i) => N[ia.get(x)][ib.get(b[i])]++);
  const r = N.map(sum), c = cb.map((_, j) => sum(N.map(row => row[j]))); let chi = 0; N.forEach((row, i) => row.forEach((x, j) => { const e = r[i] * c[j] / n; if (e > 0) chi += (x - e) ** 2 / e; }));
  const m = Math.min(ca.length, cb.length) - 1; return { v: m > 0 ? Math.sqrt(chi / (n * m)) : 0, chi2: chi, ddl: (ca.length - 1) * (cb.length - 1), p: chi2sf(chi, Math.max(1, (ca.length - 1) * (cb.length - 1))) };
}

/* ---------------------------------------------------------------- valeurs-tests (description d'un sous-ensemble) */
// variable quantitative : moyenne du sous-ensemble contre moyenne generale, tirage sans remise (Lebart et al.)
function vtestQuanti(all, inSub) {
  const N = all.length, nk = inSub.length; if (!nk || nk >= N) return { v: 0, p: 1 };
  const m = mean(all), s2 = varPop(all), mk = mean(inSub), sdv = Math.sqrt(s2 / nk * (N - nk) / (N - 1));
  const v = sdv > 0 ? (mk - m) / sdv : 0; return { v, p: 2 * normSf(Math.abs(v)), mk, m };
}
// modalite : loi hypergeometrique exacte, convertie en ecart normal signe
// somme depuis x vers la queue : les termes decroissent au-dela du mode, on s'arrete quand ils deviennent negligeables (grands effectifs)
function hyperTail(x, N, K, n, upper) { const lo = Math.max(0, n + K - N), hi = Math.min(n, K), c = lchoose(N, n); let s = 0;
  if (upper) { for (let k = Math.max(x, lo); k <= hi; k++) { const t = Math.exp(lchoose(K, k) + lchoose(N - K, n - k) - c); s += t; if (t < s * 1e-17 && k > n * K / N) break; } }
  else { for (let k = Math.min(x, hi); k >= lo; k--) { const t = Math.exp(lchoose(K, k) + lchoose(N - K, n - k) - c); s += t; if (t < s * 1e-17 && k < n * K / N) break; } }
  return Math.min(1, s); }
function vtestModal(N, K, n, x) {   // N individus, K porteurs de la modalite, n dans le sous-ensemble, x porteurs dans le sous-ensemble
  const e = n * K / N; if (x > e) { const p = hyperTail(x, N, K, n, true); return { v: -normInv(Math.max(p, 1e-300)), p: Math.min(1, 2 * p) }; }
  const p = hyperTail(x, N, K, n, false); return { v: normInv(Math.max(p, 1e-300)), p: Math.min(1, 2 * p) };
}
// description complete d'un sous-ensemble de lignes par toutes les colonnes du tableau (a la maniere de catdes)
// cache par colonne (cle : le tableau de lignes) : valeurs numeriques, codes des modalites, statistiques descriptives
const _colCache = new WeakMap();
function colInfo(rows, c) {
  let m = _colCache.get(rows); if (!m) _colCache.set(rows, (m = new Map())); let e = m.get(c); if (e) return e;
  const n = rows.length, num = new Float64Array(n); let okN = 0, nonNull = 0;
  for (let i = 0; i < n; i++) { const v = rows[i][c]; if (v === null || v === undefined) { num[i] = NaN; continue; } nonNull++; const x = typeof v === "number" ? v : toNum(v); num[i] = x; if (Number.isFinite(x)) okN++; }
  e = { num, nonNull, isNum: nonNull > 0 && okN >= 0.9 * nonNull,
    get desc() { return (this._d ??= describe(num)); },
    get cats() { if (this._c) return this._c; const code = new Int32Array(n).fill(-1), names = [], index = new Map(), count = [];
      for (let i = 0; i < n; i++) { const v = rows[i][c]; if (v === null || v === undefined) continue; const s = String(v); let k = index.get(s); if (k === undefined) { k = names.length; index.set(s, k); names.push(s); count.push(0); } code[i] = k; count[k]++; }
      return (this._c = { code, names, count }); } };
  m.set(c, e); return e;
}
// les individus sans valeur pour une colonne sont exclus du test de cette colonne (N et n comptent les seules valeurs presentes)
function describeSubset(table, rows, subSet, opts = {}) {
  const skip = new Set(opts.skip || []), out = [], N0 = rows.length, idx = [...subSet].filter(i => i >= 0 && i < N0).sort((a, b) => a - b); if (!idx.length || idx.length === N0) return out;
  for (const c of table.columns) {
    if (skip.has(c)) continue; const ci = colInfo(rows, c); if (!ci.nonNull) continue;
    if (ci.isNum) { const x = ci.num; let sA = 0, nA = 0, sS = 0, nS = 0, ss = 0;
      for (let i = 0; i < N0; i++) { const v = x[i]; if (v === v) { sA += v; nA++; } }
      for (const i of idx) { const v = x[i]; if (v === v) { sS += v; nS++; } }
      if (!nS || nS === nA) continue; const m = sA / nA; for (let i = 0; i < N0; i++) { const v = x[i]; if (v === v) ss += (v - m) * (v - m); }   // variance en deux passes (stable)
      const s2 = ss / nA; if (s2 <= 1e-14 * Math.max(1, m * m)) continue;
      const mk = sS / nS, den = Math.sqrt(s2 / nS * (nA - nS) / (nA - 1)), v = den > 0 ? (mk - m) / den : 0;
      out.push({ type: "quanti", col: c, v, p: 2 * normSf(Math.abs(v)), mk, m, sd: Math.sqrt(s2) }); }
    else { const { code, names, count } = ci.cats; if (names.length > 40 || names.length === N0) continue;
      const inSub = new Array(names.length).fill(0); let nS = 0; for (const i of idx) { const k = code[i]; if (k >= 0) { inSub[k]++; nS++; } } if (!nS || nS === ci.nonNull) continue;
      names.forEach((cat, k) => { const K = count[k], xk = inSub[k], t = vtestModal(ci.nonNull, K, nS, xk); out.push({ type: "modal", col: c, cat, v: t.v, p: t.p, clamod: xk / K, modcla: xk / nS, glob: K / ci.nonNull, x: xk, K }); }); }
  }
  return out.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
}
