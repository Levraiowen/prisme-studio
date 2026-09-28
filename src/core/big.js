
/* ============================================================================
   Mode grands volumes : plusieurs millions de lignes dans le navigateur.
   - lecture en flux d'un CSV, octet par octet, sans jamais creer d'objet par ligne ;
   - stockage en colonnes typees : Float32Array (nombres), Uint16Array (codes de modalites) ;
   - ACP exacte sur toutes les lignes (correlations accumulees, T2 et Q de chaque ligne) ;
   - vues agregees : cartes de densite par cases (Datashader, Bednar et al. ; egalisation
     d'histogramme), filtrage croise et resumes par cases (imMens, Liu, Jiang & Heer 2013 ;
     Falcon, Moritz, Howe & Heer 2019) ;
   - avec des millions de lignes, tout ecart est « significatif » : les selections sont
     decrites par la taille d'effet (ecart standardise, Cohen 1988), la valeur-test reste indiquee.
   ============================================================================ */
const BIGCFG = { catMax: 1000, sniffRows: 20000, sample: 200000, bins: 60 };
const B_NA = 0xFFFF, B_OTHER = BIGCFG.catMax;
const P10 = Array.from({ length: 309 }, (_, i) => 10 ** i);
// lecture d'un nombre directement dans les octets (point ou virgule decimale) ; SLOW = format a confier a toNum
const B_SLOW = -1.2345e-301;
function bytesNum(b, s, e, dc) {
  while (s < e && (b[s] === 32 || b[s] === 9)) s++; while (e > s && (b[e - 1] === 32 || b[e - 1] === 9)) e--;
  if (s === e) return NaN;
  let i = s, neg = false; if (b[i] === 45) { neg = true; i++; } else if (b[i] === 43) i++;
  let m = 0, ex = 0, any = false;
  for (; i < e; i++) { const c = b[i] - 48; if (c < 0 || c > 9) break; any = true; if (m < 9e14) m = m * 10 + c; else ex++; }
  if (i < e && b[i] === dc) { i++; for (; i < e; i++) { const c = b[i] - 48; if (c < 0 || c > 9) break; any = true; if (m < 9e14) { m = m * 10 + c; ex--; } } }
  if (!any) return B_SLOW;
  if (i < e && (b[i] === 101 || b[i] === 69)) { i++; let en = false, ev = 0, ed = false; if (b[i] === 45) { en = true; i++; } else if (b[i] === 43) i++; for (; i < e; i++) { const c = b[i] - 48; if (c < 0 || c > 9) break; ev = ev * 10 + c; ed = true; } if (!ed) return B_SLOW; ex += en ? -ev : ev; }
  if (i !== e) return B_SLOW;
  const v = ex === 0 ? m : ex > 0 ? (ex > 308 ? Infinity : m * P10[ex]) : ex < -308 ? m / 1e308 / P10[-ex - 308] : m / P10[-ex];
  return neg ? -v : v;
}
// FNV-1a 32 bits sur les octets d'un champ
function bytesHash(b, s, e) { let h = 0x811c9dc5; for (let i = s; i < e; i++) h = Math.imul(h ^ b[i], 16777619); return h >>> 0; }
function bytesEq(b, s, e, ref) { if (e - s !== ref.length) return false; for (let i = 0; i < ref.length; i++) if (b[s + i] !== ref[i]) return false; return true; }
// separateur : celui qui donne a l'en-tete plus d'un champ, et le meme nombre de champs au plus grand nombre de lignes
// (la virgule decimale des fichiers francais ne peut donc pas passer pour un separateur : l'en-tete n'en contient pas)
function sniffDelim(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "").slice(0, 40);
  const count = (l, d) => { let n = 1, q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"') q = !q; else if (c === d && !q) n++; } return n; };
  let best = { d: ",", h: 1, score: -1 };
  for (const d of [",", ";", "\t", "|"]) { const cs = lines.map(l => count(l, d)), h = cs[0]; if (h < 2) continue; const score = cs.filter(c => c === h).length / cs.length;
    if (score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && h > best.h)) best = { d, h, score }; }
  return best.d;
}
class BigTable {
  constructor(name = "donnees.csv") { this.name = name; this.n = 0; this.cap = 0; this.bytes = 0; this.total = 0; this.left = null; this.header = null; this.cols = []; this.t0 = performance.now(); this.bad = 0; }
  /* ---------- 1. debut du fichier : separateur, en-tetes, types */
  init(head, total = 0) {
    this.total = total; let off = head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF ? 3 : 0; this.bom = off;
    let text = new TextDecoder("utf-8").decode(head.subarray(off, Math.min(head.length, off + (4 << 20))));
    this.dec = new TextDecoder(text.includes(String.fromCharCode(0xFFFD)) ? "windows-1252" : "utf-8"); if (this.dec.encoding !== "utf-8") text = this.dec.decode(head.subarray(off, Math.min(head.length, off + (4 << 20))));
    const D = sniffDelim(text); this.D = D.charCodeAt(0); this.delim = D;
    // lecture des premieres lignes en texte (memes regles que le reste du fichier)
    const rows = []; this._scan(head, off, head.length, head.length === total || !total, (b, fs, fe, fq, nf) => { if (rows.length > BIGCFG.sniffRows) return false; const r = []; for (let f = 0; f < nf; f++) r.push(this._str(b, fs[f], fe[f], fq[f])); rows.push(r); return true; });
    if (rows.length < 2) throw new Error("Le fichier doit contenir une ligne d'en-têtes et au moins une ligne de données.");
    const seen = {}; const names = rows[0].map((c, i) => { let s = c.trim() || `Colonne ${i + 1}`; if (s === "__proto__") s += " "; seen[s] = (seen[s] || 0) + 1; return seen[s] > 1 ? `${s} (${seen[s]})` : s; });
    const body = rows.slice(1), NC = names.length;
    // virgule decimale : separateur autre que la virgule et nombres du type 12,5
    let comma = 0, dot = 0; for (const r of body.slice(0, 2000)) for (const v of r) { if (/^\s*-?\d+,\d+\s*$/.test(v)) comma++; else if (/^\s*-?\d+\.\d+\s*$/.test(v)) dot++; }
    this.dc = D !== "," && comma > dot ? 44 : 46;
    const idName = /^(id|ids|index|idx|key|cl[ée]|code|num|num[ée]ro|no|n°|#|rowid|row_id)$|^id[_\s.-]|[_\s.-]id$|^unnamed/i;
    this.cols = names.map((name, c) => {
      let ne = 0, ok = 0, allInt = true, seq = true; const dist = new Set();
      body.forEach((r, i) => { const v = (r[c] ?? "").trim(); if (v === "" || (v.length < 10 && MISSING.has(v.toLowerCase()))) return; ne++; if (dist.size <= BIGCFG.catMax) dist.add(v); const x = this.dc === 44 ? toNum(v) : toNum(v); if (Number.isFinite(x)) { ok++; if (!Number.isInteger(x)) allInt = false; if (x !== i && x !== i + 1) seq = false; } else seq = false; });
      if (!ne) return { name, role: "skip", why: "vide" };
      if (ok >= 0.9 * ne) { if (allInt && dist.size === ne && ne > 20 && (seq || idName.test(name.trim()))) return { name, role: "skip", why: "identifiant" }; return { name, role: "num" }; }
      if (dist.size > BIGCFG.catMax || (dist.size > 200 && dist.size > 0.3 * ne)) return { name, role: "skip", why: dist.size > BIGCFG.catMax ? "identifiant ou texte libre" : dist.size >= ne * 0.95 ? "identifiant" : "texte" };
      return { name, role: "cat" };
    });
    const avg = Math.max(8, (Math.min(head.length, 4 << 20)) / Math.max(1, rows.length));
    this.cap = Math.max(1024, Math.ceil((total || head.length) / avg * 1.12) + 1024);
    this.cols.forEach(c => { if (c.role === "num") c.data = new Float32Array(this.cap); if (c.role === "cat") { c.data = new Uint16Array(this.cap); c.map = new Map(); c.labels = []; c.raw = []; c.byStr = new Map(); } });
    this.NC = NC; this.fs = new Int32Array(NC + 1); this.fe = new Int32Array(NC + 1); this.fq = new Uint8Array(NC + 1);
    this.header = true; this.left = null; this.pos = off;
    return this.meta();
  }
  _str(b, s, e, q) { let t = this.dec ? this.dec.decode(b.subarray(s, e)) : new TextDecoder().decode(b.subarray(s, e)); return q ? t.replace(/""/g, '"') : t; }
  /* ---------- 2. decoupage en lignes et champs (guillemets RFC 4180) ; renvoie la position de la premiere ligne incomplete */
  _scan(b, start, end, isLast, onRow) {
    const D = this.D ?? 44, NCx = this.NC ?? 4096, fs = this.fs || new Int32Array(NCx + 1), fe = this.fe || new Int32Array(NCx + 1), fq = this.fq || new Uint8Array(NCx + 1);
    let p = start;
    rows: while (p < end) {
      const rowStart = p; let f = 0;
      for (;;) {
        let s, e, q = 0;
        if (b[p] === 34) { let k = p + 1; for (;;) { if (k >= end) { if (!isLast) return rowStart; break; } if (b[k] === 34) { if (b[k + 1] === 34) { k += 2; continue; } if (k + 1 >= end && !isLast) return rowStart; break; } k++; } s = p + 1; e = Math.min(k, end); q = 1; p = k + 1; while (p < end && b[p] !== D && b[p] !== 10 && b[p] !== 13) p++; }
        else { let k = p; while (k < end && b[k] !== D && b[k] !== 10 && b[k] !== 13) k++; s = p; e = k; p = k; }
        if (f < NCx) { fs[f] = s; fe[f] = e; fq[f] = q; } f++;
        if (p >= end) { if (!isLast) return rowStart; break; }
        if (b[p] === D) { p++; if (p >= end && !isLast) return rowStart; continue; }
        if (b[p] === 13) { p++; if (p >= end && !isLast) return rowStart; } if (b[p] === 10) p++;
        break;
      }
      if (f === 1 && fe[0] === fs[0]) continue rows;   // ligne vide
      if (onRow(b, fs, fe, fq, Math.min(f, NCx)) === false) return p;
    }
    return end;
  }
  /* ---------- 3. ingestion d'un morceau du fichier */
  ingest(chunk, isLast) {
    let b = chunk; if (this.left && this.left.length) { b = new Uint8Array(this.left.length + chunk.length); b.set(this.left); b.set(chunk, this.left.length); }
    const start = this.pos || 0; this.pos = 0;
    const used = this._scan(b, start, b.length, isLast, this._rowFn || (this._rowFn = this._row.bind(this)));
    this.left = used < b.length ? b.slice(used) : null; this.bytes += chunk.length;
    if (isLast && this.left) { this._scan(this.left, 0, this.left.length, true, this._rowFn); this.left = null; }
  }
  _grow() {
    const cap = Math.ceil(this.cap * 1.5) + 1024;
    for (const c of this.cols) if (c.data) { const d = new c.data.constructor(cap); d.set(c.data.subarray(0, this.n)); c.data = d; }
    this.cap = cap;
  }
  _row(b, fs, fe, fq, nf) {
    if (this.header) { this.header = false; return true; }
    if (this.n >= this.cap) this._grow();
    const i = this.n, cols = this.cols, dc = this.dc;
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c]; if (col.role === "skip") continue;
      if (c >= nf) { col.data[i] = col.role === "num" ? NaN : B_NA; continue; }
      let s = fs[c], e = fe[c];
      if (col.role === "num") { let v = bytesNum(b, s, e, dc); if (v === B_SLOW) v = toNum(this._str(b, s, e, fq[c])); col.data[i] = v > -3.4e38 && v < 3.4e38 ? v : NaN; continue; }   // hors de la plage Float32 : manquant
      while (s < e && (b[s] === 32 || b[s] === 9)) s++; while (e > s && (b[e - 1] === 32 || b[e - 1] === 9)) e--;
      if (s === e) { col.data[i] = B_NA; continue; }
      const h = bytesHash(b, s, e); let code = col.map.get(h);
      if (code === undefined) code = this._newCat(col, b, s, e, fq[c], h);
      else if (code === -2) code = this._collide(col, b, s, e, fq[c]);
      else if (code !== B_OTHER && !bytesEq(b, s, e, code === B_NA ? col.naRaw.get(h) : col.raw[code])) {
        // collision de hachage (deux textes, meme empreinte) : cette empreinte passe par une table indexee par le texte
        col.byStr.set(code === B_NA ? this.dec.decode(col.naRaw.get(h)) : col.labels[code], code); col.map.set(h, -2); code = this._collide(col, b, s, e, fq[c]);
      }
      col.data[i] = code;
    }
    this.n++; return true;
  }
  _newCat(col, b, s, e, q, h) {
    const label = this._str(b, s, e, q);
    if (label.length < 10 && MISSING.has(label.trim().toLowerCase())) { col.map.set(h, B_NA); (col.naRaw ||= new Map()).set(h, b.slice(s, e)); return B_NA; }
    if (col.labels.length >= BIGCFG.catMax) { col.overflow = (col.overflow || 0) + 1; col.map.set(h, B_OTHER); col.raw[B_OTHER] = null; return B_OTHER; }
    const code = col.labels.length; col.labels.push(label); col.raw.push(b.slice(s, e)); col.map.set(h, code); return code;
  }
  _collide(col, b, s, e, q, label = this._str(b, s, e, q)) {
    let code = col.byStr.get(label); if (code !== undefined) return code;
    if (label.length < 10 && MISSING.has(label.trim().toLowerCase())) code = B_NA; else if (col.labels.length >= BIGCFG.catMax) code = B_OTHER; else { code = col.labels.length; col.labels.push(label); col.raw.push(b.slice(s, e)); }
    col.byStr.set(label, code); return code;
  }
  progress() { return { bytes: this.bytes, total: this.total, rows: this.n, ms: performance.now() - this.t0 }; }
  meta() { return { name: this.name, delim: this.delim, decimal: this.dc === 44 ? "," : ".", encoding: this.dec?.encoding, cols: this.cols.map(c => ({ name: c.name, role: c.role, why: c.why })) }; }
  /* ---------- 4. fin de lecture : colonnes a la taille exacte, statistiques exactes, echantillon */
  finish() {
    const n = this.n; if (n < 3) throw new Error("Il faut au moins 3 lignes de données.");
    for (const c of this.cols) if (c.data && c.data.length !== n) c.data = c.data.slice(0, n);
    this.cap = n; this.parseMs = performance.now() - this.t0;
    this.num = this.cols.filter(c => c.role === "num"); this.cat = this.cols.filter(c => c.role === "cat");
    this.sampleIdx = selSample(n, Math.min(n, BIGCFG.sample), 12345);
    for (const c of this.num) this._numStats(c);
    this.num = this.num.filter(c => { if (c.st.n >= 3) return true; c.role = "skip"; c.why = "vide"; c.data = null; return false; });
    for (const c of this.cat) this._catStats(c);
    return this.summary();
  }
  _numStats(c) {
    const d = c.data, n = d.length; let k = 0, s = 0, mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) { const v = d[i]; if (v === v) { k++; s += v; if (v < mn) mn = v; if (v > mx) mx = v; } }
    const m = k ? s / k : NaN, sc = Math.max(mx - m, m - mn) || 1; let m2 = 0, m3 = 0, m4 = 0;
    for (let i = 0; i < n; i++) { const v = d[i]; if (v === v) { const z = (v - m) / sc, z2 = z * z; m2 += z2; m3 += z2 * z; m4 += z2 * z2; } }
    m2 /= k; m3 /= k; m4 /= k; const g1 = m2 > 0 ? m3 / m2 ** 1.5 : 0, g2 = m2 > 0 ? m4 / (m2 * m2) - 3 : 0;
    const G1 = k > 2 ? g1 * Math.sqrt(k * (k - 1)) / (k - 2) : 0, G2 = k > 3 ? ((k + 1) * g2 + 6) * (k - 1) / ((k - 2) * (k - 3)) : 0;
    const smp = Float64Array.from(this.sampleIdx, i => d[i]).filter(v => v === v).sort(), q = p => quantile(smp, p);
    c.st = { n: k, miss: n - k, mean: m, sd: sc * Math.sqrt(m2 * k / Math.max(k - 1, 1)), sdPop: sc * Math.sqrt(m2), min: mn, max: mx, skew: G1, kurt: G2,
      bc: k > 3 ? (G1 * G1 + 1) / (G2 + 3 * (k - 1) ** 2 / ((k - 2) * (k - 3))) : 0, q01: q(0.01), q1: q(0.25), med: q(0.5), q3: q(0.75), q99: q(0.99), q005: q(0.005), q995: q(0.995) };
    // cases de l'histogramme : entiers peu nombreux = une case par valeur ; sinon 60 cases sur l'etendue robuste
    const st = c.st, ints = smp.length && smp.every(Number.isInteger) && mx - mn <= 60;
    let lo = st.min, hi = st.max; if (!ints && hi - lo > 3 * (st.q995 - st.q005) && st.q995 > st.q005) { lo = st.q005; hi = st.q995; }
    const nb = ints ? mx - mn + 1 : BIGCFG.bins; if (ints) { lo = mn - 0.5; hi = mx + 0.5; } if (!(hi > lo)) { lo -= 0.5; hi += 0.5; }
    c.hb = { lo, hi, nb, ints }; c.hist = this._hist(c, null);
  }
  _hist(c, mask) {
    const { lo, hi, nb } = c.hb, d = c.data, n = d.length, h = new Float64Array(nb + 2), f = nb / (hi - lo);   // cases 0 et nb+1 : hors cadre
    for (let i = 0; i < n; i++) { if (mask && !mask[i]) continue; const v = d[i]; if (v !== v) continue; const t = (v - lo) * f; h[t < 0 ? 0 : t >= nb ? nb + 1 : 1 + (t | 0)]++; }
    return h;
  }
  _catStats(c) { const K = c.labels.length + (c.overflow ? 1 : 0), cnt = new Float64Array(K + 1), d = c.data; let miss = 0; for (let i = 0; i < d.length; i++) { const v = d[i]; if (v === B_NA) miss++; else cnt[v === B_OTHER ? c.labels.length : v]++; } c.counts = cnt.subarray(0, K); c.st = { n: d.length - miss, miss, K }; }
  summary() {
    const mem = this.cols.reduce((s, c) => s + (c.data ? c.data.byteLength : 0), 0);
    return { ...this.meta(), n: this.n, bytes: this.bytes, parseMs: this.parseMs, mem,
      num: this.num.map(c => ({ name: c.name, st: c.st, hb: c.hb, hist: Array.from(c.hist) })),
      cat: this.cat.map(c => ({ name: c.name, st: c.st, labels: c.labels.concat(c.overflow ? ["(autres modalités)"] : []), counts: Array.from(c.counts), overflow: c.overflow || 0 })) };
  }
  /* ---------- 5. ACP exacte sur toutes les lignes completes */
  pca(varNames, nAxesChoice = null) {
    const t0 = performance.now(), V = (varNames && varNames.length ? varNames : this.num.filter(c => c.st.sdPop > 0).map(c => c.name)).map(nm => this.num.find(c => c.name === nm)).filter(Boolean), P = V.length, n = this.n;
    if (P < 2) throw new Error("Il faut au moins deux variables quantitatives.");
    const D = V.map(c => c.data), ok = new Uint8Array(n); let N = 0;
    for (let i = 0; i < n; i++) { let g = 1; for (let j = 0; j < P; j++) { const v = D[j][i]; if (v !== v) { g = 0; break; } } ok[i] = g; N += g; }
    if (N < 3) throw new Error("Moins de 3 lignes complètes sur les variables choisies.");
    const mu = new Float64Array(P), sd = new Float64Array(P), sc = V.map(c => Math.max(c.st.max - c.st.mean, c.st.mean - c.st.min) || 1);
    for (let j = 0; j < P; j++) { const d = D[j]; let s = 0; for (let i = 0; i < n; i++) if (ok[i]) s += d[i]; mu[j] = s / N; let ss = 0; for (let i = 0; i < n; i++) if (ok[i]) { const z = (d[i] - mu[j]) / sc[j]; ss += z * z; } sd[j] = sc[j] * Math.sqrt(ss / N); }
    const cst = V.filter((c, j) => !(sd[j] > 0)).map(c => c.name); if (cst.length) throw new Error(`Variable constante à retirer : ${cst.join(", ")}.`);
    const C = new Float64Array(P * P), z = new Float64Array(P), inv = sd.map(s => 1 / s);
    for (let i = 0; i < n; i++) { if (!ok[i]) continue; for (let j = 0; j < P; j++) z[j] = (D[j][i] - mu[j]) * inv[j]; for (let a = 0; a < P; a++) { const za = z[a]; if (za === 0) continue; const o = a * P; for (let b = a; b < P; b++) C[o + b] += za * z[b]; } }
    const R = range(P).map(a => range(P).map(b => (a <= b ? C[a * P + b] : C[b * P + a]) / N)), e = eigSym(R);
    const q = e.values.filter(v => v > 1e-10).length, vals = e.values.slice(0, q), Vv = e.vectors.map(r => r.slice(0, q)); orient(Vv, []);
    const kaiser = vals.filter(v => v >= 1 - 1e-9).length, nAxes = nInterp(kaiser, q, nAxesChoice), K3 = Math.min(3, q), A = nAxes;
    // coordonnees des 3 premiers axes, T2 de Hotelling (A axes) et Q (ecart au sous-espace) pour chaque ligne
    const F = range(K3).map(() => new Float32Array(n)), T2 = new Float32Array(n), Q = new Float32Array(n), f = new Float64Array(A), fT = (N - 1) / N;
    for (let i = 0; i < n; i++) {
      if (!ok[i]) { for (let k = 0; k < K3; k++) F[k][i] = NaN; T2[i] = NaN; Q[i] = NaN; continue; }
      let zz = 0; for (let j = 0; j < P; j++) { const t = (D[j][i] - mu[j]) * inv[j]; z[j] = t; zz += t * t; }
      let t2 = 0, ss = 0; for (let k = 0; k < A; k++) { let s = 0; for (let j = 0; j < P; j++) s += z[j] * Vv[j][k]; f[k] = s; t2 += s * s / vals[k]; ss += s * s; if (k < K3) F[k][i] = s; }
      for (let k = A; k < K3; k++) { let s = 0; for (let j = 0; j < P; j++) s += z[j] * Vv[j][k]; F[k][i] = s; }
      T2[i] = fT * t2; Q[i] = Math.max(0, zz - ss);
    }
    const rest = vals.slice(A), t1 = sum(rest), t2s = sum(rest.map(l => l * l));
    const ucT = N > 200000 ? chi2Inv(0.95, A) * (N - 1) / N : (N - 1) ** 2 / N * betaInv(0.95, A / 2, (N - A - 1) / 2), ucQ = t1 > 1e-10 ? t2s / t1 * chi2Inv(0.95, t1 * t1 / t2s) : null;
    let nT = 0, nQ = 0, nAny = 0; for (let i = 0; i < n; i++) if (ok[i]) { const a = T2[i] > ucT, b = ucQ !== null && Q[i] > ucQ; nT += a; nQ += b; nAny += a || b; }
    // cadre de chaque axe : etendue robuste (quantiles 0,1 % et 99,9 % de l'echantillon) sauf si les extremes restent proches
    const ext = F.map(Fk => { const s = Float64Array.from(this.sampleIdx, i => Fk[i]).filter(v => v === v).sort(); let mn = Infinity, mx = -Infinity; for (let i = 0; i < n; i++) { const v = Fk[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const lo = quantile(s, 0.001), hi = quantile(s, 0.999), pad = (hi - lo) * 0.06; return mx - mn <= 1.6 * (hi - lo) ? [mn - pad * 0.5, mx + pad * 0.5, mn, mx] : [lo - pad, hi + pad, mn, mx]; });
    this.acp = { vars: V.map(c => c.name), cols: V, P, N, ok, mu, sd, R, vals, V: Vv, q, nAxes: A, F, T2, Q, ucT, ucQ, ext, cls: null };
    this.mask = null; this.filters = [];
    const coord = Vv.map(r => r.map((v, k) => v * Math.sqrt(vals[k])));
    return { vars: this.acp.vars, N, removed: n - N, R, vals, pct: vals.map(v => v / P * 100), cum: cumsum(vals).map(v => v / P * 100), q, nAxes: A, rule: kaiser, coude: coude(vals), coord,
      vctr: coord.map(r => r.map((c, k) => c * c / vals[k] * 100)), mu: Array.from(mu), sd: Array.from(sd), ext, ucT, ucQ, nT, nQ, nAny, alg: e.alg, ms: performance.now() - t0 };
  }
  /* ---------- 6. filtres (selection croisee) : masque sur toutes les lignes */
  setFilters(filters) {
    const a = this.acp, n = this.n; this.filters = filters || [];
    if (!this.filters.length) { this.mask = null; return this.selSummary(); }
    const m = a ? a.ok.slice() : new Uint8Array(n).fill(1);
    for (const f of this.filters) {
      if (f.type === "range") { const d = this.num.find(c => c.name === f.col)?.data; if (!d) continue; const lo = f.lo, hi = f.hi; for (let i = 0; i < n; i++) if (m[i]) { const v = d[i]; if (!(v >= lo && v <= hi)) m[i] = 0; } }
      else if (f.type === "cats") { const c = this.cat.find(c => c.name === f.col); if (!c) continue; const lut = new Uint8Array(65536); f.codes.forEach(k => (lut[k >= c.labels.length ? B_OTHER : k] = 1)); const d = c.data; for (let i = 0; i < n; i++) if (m[i] && !lut[d[i]]) m[i] = 0; }
      else if (f.type === "rect" && a) { const X = a.F[f.a], Y = a.F[f.b]; for (let i = 0; i < n; i++) if (m[i]) { const x = X[i], y = Y[i]; if (!(x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1)) m[i] = 0; } }
      else if (f.type === "class" && a && a.cls) { const lut = new Uint8Array(256); f.codes.forEach(k => (lut[k] = 1)); const d = a.cls; for (let i = 0; i < n; i++) if (m[i] && !lut[d[i]]) m[i] = 0; }
      else if (f.type === "outlier" && a) { for (let i = 0; i < n; i++) if (m[i] && !(a.T2[i] > a.ucT || (a.ucQ !== null && a.Q[i] > a.ucQ))) m[i] = 0; }
    }
    this.mask = m; return this.selSummary();
  }
  // description de la selection : taille d'effet (ecart standardise) et valeur-test pour chaque variable, sur-representation des modalites
  selSummary() {
    const m = this.mask, a = this.acp; if (!m) return { count: null, total: a ? a.N : this.n };
    let ns = 0; for (let i = 0; i < m.length; i++) ns += m[i];
    const N = a ? a.N : this.n, base = a ? a.ok : null;
    // moyenne et variance calculees sur les memes lignes que la selection (lignes completes de l'ACP), decalees par la moyenne globale (stable)
    // une seule passe par colonne : moments et histogramme de la selection
    const num = this.num.map(c => { const d = c.data, m0 = c.st.mean, { lo, hi, nb } = c.hb, f = nb / (hi - lo), h = new Float64Array(nb + 2); let s = 0, k = 0, sa = 0, sa2 = 0, ka = 0;
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v || (base && !base[i])) continue; const u = v - m0; sa += u; sa2 += u * u; ka++; if (m[i]) { s += u; k++; const t = (v - lo) * f; h[t < 0 ? 0 : t >= nb ? nb + 1 : 1 + (t | 0)]++; } }
      if (!k || !ka) return { name: c.name, n: k, hist: Array.from(h) }; const ma = m0 + sa / ka, ms = m0 + s / k, sdv = Math.sqrt(Math.max(sa2 / ka - (sa / ka) ** 2, 0)) || 1, den = Math.sqrt(sdv * sdv / k * (ka - k) / Math.max(ka - 1, 1));
      return { name: c.name, n: k, mean: ms, meanAll: ma, d: (ms - ma) / sdv, v: den > 0 ? (ms - ma) / den : 0, hist: Array.from(h) }; });
    const cat = this.cat.map(c => { const K = c.counts.length, cs = new Float64Array(K), ca = new Float64Array(K), d = c.data; let ks = 0, ka = 0;
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (v === B_NA || (base && !base[i])) continue; const k = v === B_OTHER ? c.labels.length : v; ca[k]++; ka++; if (m[i]) { cs[k]++; ks++; } }
      const mods = range(K).map(k => { const p = ca[k] / (ka || 1), x = cs[k], e = ks * p, sdv = Math.sqrt(ks * p * (1 - p) * (ka - ks) / Math.max(ka - 1, 1)); return { k, x, share: ks ? x / ks : 0, glob: p, lift: p > 0 && ks ? x / ks / p : 0, v: sdv > 0 ? (x - e) / sdv : 0 }; });
      return { name: c.name, n: ks, mods }; });
    return { count: ns, total: N, num, cat };
  }
  /* ---------- 7. carte de densite (image RGBA calculee ici, transferee telle quelle) */
  density(o) {
    const t0 = performance.now(), a = this.acp; if (!a) throw new Error("ACP non calculée.");
    const G = o.G || 512, H = o.H || G, X = a.F[o.a], Y = a.F[o.b], [x0, x1, y0, y1] = o.box, sx = G / (x1 - x0), sy = H / (y1 - y0), n = this.n, ok = a.ok, m = this.mask;
    const cnt = new Uint32Array(G * H), selC = m ? new Uint32Array(G * H) : null; let inside = 0;
    const mode = o.color?.mode || "count";
    let K = 0, codes = null, catC = null, numS = null, numV = null;
    if (mode === "cat") { const c = this.cat.find(c => c.name === o.color.col); if (c) { K = Math.min(o.pal.length, c.counts.length); const order = Array.from(c.counts.keys()).sort((u, v) => c.counts[v] - c.counts[u]), rank = new Int32Array(65536).fill(K - 1); order.slice(0, K).forEach((k, r) => (rank[k === c.labels.length ? B_OTHER : k] = r)); codes = { d: c.data, rank, order: order.slice(0, K) }; catC = new Uint32Array(G * H * K); } }
    if (mode === "class" && a.cls) { K = a.clsK; codes = { d: a.cls, rank: null }; catC = new Uint32Array(G * H * K); }
    if (mode === "num" || mode === "t2") { numV = mode === "t2" ? a.T2 : this.num.find(c => c.name === o.color.col)?.data; if (numV) numS = new Float64Array(G * H); }
    for (let i = 0; i < n; i++) {
      if (!ok[i]) continue; const tx = (X[i] - x0) * sx, ty = (Y[i] - y0) * sy; if (!(tx >= 0 && tx < G && ty >= 0 && ty < H)) continue;
      const cell = (H - 1 - (ty | 0)) * G + (tx | 0); cnt[cell]++; inside++;
      if (selC && m[i]) selC[cell]++;
      if (catC) { const v = codes.d[i]; if (codes.rank) { if (v !== B_NA) catC[cell * K + codes.rank[v]]++; } else if (v !== 255) catC[cell * K + v]++; }
      else if (numS) { const v = numV[i]; if (v === v) numS[cell] += v; }
    }
    // intensite par case : egalisation d'histogramme (rang des effectifs non nuls), logarithme ou lineaire
    const nz = []; let mx = 0; for (let c = 0; c < cnt.length; c++) if (cnt[c]) { nz.push(cnt[c]); if (cnt[c] > mx) mx = cnt[c]; }
    const sorted = Uint32Array.from(nz).sort(), L = sorted.length, how = o.how || "eq";
    const inten = c => { if (how === "lin") return c / mx; if (how === "log") return Math.log1p(c) / Math.log1p(mx); let lo = 0, hi = L; while (lo < hi) { const md = (lo + hi) >> 1; if (sorted[md] <= c) lo = md + 1; else hi = md; } return lo / L; };
    const img = new Uint8ClampedArray(G * H * 4), ramp = o.ramp, rampAt = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; const x = t * (ramp.length - 1), i = Math.min(ramp.length - 2, x | 0), f = x - i, A0 = ramp[i], B0 = ramp[i + 1]; return [A0[0] + (B0[0] - A0[0]) * f, A0[1] + (B0[1] - A0[1]) * f, A0[2] + (B0[2] - A0[2]) * f]; };
    let vlo = 0, vhi = 1; if (numS) { const src = numV, s = Float64Array.from(this.sampleIdx, i => src[i]).filter((v, t) => v === v && ok[this.sampleIdx[t]]).sort(); vlo = quantile(s, 0.05); vhi = quantile(s, 0.95); if (!(vhi > vlo)) { vlo = s[0] ?? 0; vhi = (s[s.length - 1] ?? 1) + 1e-9; } }
    const hl = o.hl || [255, 200, 92], dark = !!o.dark, eqc = new Map();
    for (let c = 0; c < cnt.length; c++) {
      const k = cnt[c]; if (!k) continue; let w = eqc.get(k); if (w === undefined) { w = inten(k); eqc.set(k, w); }
      let rgb;
      if (catC) { let r = 0, g = 0, bl = 0, t = 0; for (let j = 0; j < K; j++) { const x = catC[c * K + j]; if (x) { const p = o.pal[j % o.pal.length]; r += x * p[0]; g += x * p[1]; bl += x * p[2]; t += x; } } rgb = t ? [r / t, g / t, bl / t] : [128, 128, 128]; }
      else if (numS) rgb = rampAt((numS[c] / k - vlo) / (vhi - vlo));
      else rgb = rampAt(0.12 + 0.88 * w);
      let al = 0.22 + 0.78 * w;
      if (selC) { const f = selC[c] / k; if (f > 0) { const t = 0.35 + 0.65 * f; rgb = [rgb[0] + (hl[0] - rgb[0]) * t, rgb[1] + (hl[1] - rgb[1]) * t, rgb[2] + (hl[2] - rgb[2]) * t]; al = Math.max(al, 0.55 + 0.45 * w); } else al *= 0.28; }
      if (!dark && !catC && !numS) al = Math.min(1, al * 1.1);
      const p = c * 4; img[p] = rgb[0]; img[p + 1] = rgb[1]; img[p + 2] = rgb[2]; img[p + 3] = al * 255;
    }
    return { img, cnt, G, H, inside, outside: a.N - inside, max: mx, cells: L, ms: performance.now() - t0, legend: catC && codes.order ? codes.order : null, merged: !!(codes && codes.order && this.cat.find(c => c.name === o.color.col)?.counts.length > K), vlo, vhi };
  }
  /* ---------- 8. classes : HCPC sur un echantillon, puis affectation exacte de toutes les lignes */
  classes(k = null) {
    const t0 = performance.now(), a = this.acp; if (!a) throw new Error("ACP non calculée.");
    const d = Math.min(a.nAxes, a.F.length), smp = Array.from(this.sampleIdx).filter(i => a.ok[i]).slice(0, 20000), Fs = smp.map(i => range(d).map(k2 => a.F[k2][i]));
    const hc = hcpc({ method: "ACP", F: Fs, n: Fs.length, nAxes: d, q: d }, { k: k || undefined, dims: d });
    const C = hc.centers, K = C.length, n = this.n, cls = new Uint8Array(n).fill(255), size = new Float64Array(K), cen = range(K).map(() => new Float64Array(d)); let within = 0, tot = 0;
    for (let i = 0; i < n; i++) { if (!a.ok[i]) continue; let bj = 0, bd = Infinity; for (let j = 0; j < K; j++) { let s = 0; for (let t = 0; t < d; t++) { const u = a.F[t][i] - C[j][t]; s += u * u; } if (s < bd) { bd = s; bj = j; } } cls[i] = bj; size[bj]++; for (let t = 0; t < d; t++) cen[bj][t] += a.F[t][i]; }
    cen.forEach((c, j) => c.forEach((v, t) => (c[t] = v / (size[j] || 1))));
    for (let i = 0; i < n; i++) { if (!a.ok[i]) continue; const j = cls[i]; for (let t = 0; t < d; t++) { const v = a.F[t][i]; tot += v * v; within += (v - cen[j][t]) ** 2; } }
    a.cls = cls; a.clsK = K;
    // profils : moyenne de chaque variable par classe (en ecarts-types) et modalites sur-representees
    const prof = this.num.map(c => { const s = new Float64Array(K), m = new Float64Array(K), dd = c.data; for (let i = 0; i < n; i++) { const j = cls[i]; if (j === 255) continue; const v = dd[i]; if (v === v) { s[j] += v; m[j]++; } } return { name: c.name, z: range(K).map(j => (m[j] ? s[j] / m[j] - c.st.mean : 0) / (c.st.sdPop || 1)) }; });
    const catp = this.cat.map(c => { const L = c.counts.length, t = range(K).map(() => new Float64Array(L)), tt = new Float64Array(L), dd = c.data; for (let i = 0; i < n; i++) { const j = cls[i]; if (j === 255) continue; const v = dd[i]; if (v === B_NA) continue; const kk = v === B_OTHER ? c.labels.length : v; t[j][kk]++; tt[kk]++; }
      const T = sum(Array.from(tt)); return { name: c.name, top: range(K).map(j => { const nj = sum(Array.from(t[j])); return range(L).map(kk => ({ k: kk, share: nj ? t[j][kk] / nj : 0, lift: nj && tt[kk] ? t[j][kk] / nj / (tt[kk] / T) : 0 })).filter(o => o.share >= 0.05).sort((x, y) => y.lift - x.lift).slice(0, 3); }) }; });
    return { k: K, kAuto: hc.kAuto, sizes: Array.from(size), R2: tot > 0 ? 1 - within / tot : 0, centers: cen.map(c => Array.from(c)), dims: d, prof, catp, sampled: smp.length, ms: performance.now() - t0 };
  }
  /* ---------- 9. atypiques : les lignes les plus eloignees du modele */
  outliers(top = 25) {
    const a = this.acp; if (!a) return null; const n = this.n, heap = [];
    const ratio = i => Math.max(a.T2[i] / a.ucT, a.ucQ ? a.Q[i] / a.ucQ : 0);
    for (let i = 0; i < n; i++) { if (!a.ok[i]) continue; const r = ratio(i); if (heap.length < top) { heap.push([r, i]); if (heap.length === top) heap.sort((x, y) => x[0] - y[0]); } else if (r > heap[0][0]) { heap[0] = [r, i]; let j = 0; while (j + 1 < top && heap[j][0] > heap[j + 1][0]) { [heap[j], heap[j + 1]] = [heap[j + 1], heap[j]]; j++; } } }
    return heap.sort((x, y) => y[0] - x[0]).map(([r, i]) => ({ row: i, line: i + 2, ratio: r, t2: a.T2[i], q: a.Q[i], z: a.cols.map((c, j) => ({ name: c.name, v: c.data[i], z: (c.data[i] - a.mu[j]) / a.sd[j] })).sort((u, v) => Math.abs(v.z) - Math.abs(u.z)).slice(0, 4) }));
  }
  /* ---------- 10. echantillon aleatoire pour le Studio complet (lignes de la selection si demande) */
  sample(m = 50000, fromSel = false) {
    const n = this.n, base = fromSel && this.mask ? this.mask : null; let idx;
    if (base) { let rem = 0; for (let i = 0; i < n; i++) rem += base[i]; const rnd = mulberry(777); let need = Math.min(m, rem); idx = [];   // tirage sequentiel parmi les lignes selectionnees
      for (let i = 0; i < n && need > 0; i++) if (base[i]) { if (rem * rnd() < need) { idx.push(i); need--; } rem--; } } else idx = Array.from(selSample(n, Math.min(m, n), 777));
    const cols = this.cols.filter(c => c.role !== "skip"), r7 = v => (v === v ? +v.toPrecision(7) : null);
    const rows = idx.map(i => cols.map(c => (c.role === "num" ? r7(c.data[i]) : c.data[i] === B_NA ? null : c.data[i] === B_OTHER ? "(autres modalités)" : c.labels[c.data[i]])));
    return { columns: cols.map(c => c.name), numeric: cols.filter(c => c.role === "num").map(c => c.name), rows, n: idx.length, total: n, fromSel: !!base };
  }
}
// echantillonnage par selection sequentielle (Knuth, algorithme S) : m indices tries parmi n, memoire O(m)
function selSample(n, m, seed = 1) { const rnd = mulberry(seed), out = new Int32Array(m); let t = 0; for (let i = 0; i < n && t < m; i++) if ((n - i) * rnd() < m - t) out[t++] = i; return out; }
// traitement des messages (Web Worker, ou fil principal si les workers sont indisponibles)
let BT = null;
async function bigHandle(msg, post) {
  const { id, cmd, a = {} } = msg, done = (out, tr) => post({ id, ok: true, out }, tr);
  try {
    if (cmd === "open") {
      BT = null; const bt = new BigTable(a.name), CH = 8 << 20; let last = 0;
      const tick = () => { const t = performance.now(); if (t - last > 90) { last = t; post({ id, type: "progress", p: bt.progress() }); } };
      const pause = () => (a.yieldEach ? new Promise(r => setTimeout(r, 0)) : null);
      if (a.file) {
        const f = a.file, total = f.size, head = new Uint8Array(await f.slice(0, Math.min(total, 2 << 20)).arrayBuffer());
        post({ id, type: "meta", meta: bt.init(head, total) });
        for (let pos = 0; pos < total; pos += CH) { bt.ingest(new Uint8Array(await f.slice(pos, Math.min(total, pos + CH)).arrayBuffer()), pos + CH >= total); tick(); await pause(); }
      } else {
        // URL (lecture en flux) ou texte deja en memoire
        const r = a.url ? await fetch(a.url, { credentials: "omit" }) : null; if (r && !r.ok) throw new Error(`Chargement impossible (${r.status}) : ${a.url}`);
        const total = r ? +(r.headers.get("content-length") || 0) : 0, rd = r ? r.body.getReader() : null; let parts = [], size = 0, init = false;
        const flush = isLast => { const buf = new Uint8Array(size); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; } parts = []; size = 0;
          if (!init) { post({ id, type: "meta", meta: bt.init(buf, isLast ? buf.length : total) }); init = true; } bt.ingest(buf, isLast); };
        if (rd) for (;;) { const { done: fin, value } = await rd.read(); if (fin) break; parts.push(value); size += value.length; if (size >= CH) { flush(false); tick(); await pause(); } }
        else { const u = typeof a.text === "string" ? new TextEncoder().encode(a.text) : new Uint8Array(a.bytes); parts.push(u); size = u.length; }
        flush(true);
      }
      const summary = bt.finish(); BT = bt; done({ summary });
    }
    else if (!BT) throw new Error("Aucun fichier chargé.");
    else if (cmd === "pca") done(BT.pca(a.vars, a.nAxes));
    else if (cmd === "density") { const d = BT.density(a); done(d, [d.img.buffer, d.cnt.buffer]); }
    else if (cmd === "filter") done(BT.setFilters(a.filters));
    else if (cmd === "classes") done(BT.classes(a.k));
    else if (cmd === "outliers") done(BT.outliers(a.top));
    else if (cmd === "sample") done(BT.sample(a.m, a.fromSel));
  } catch (e) { post({ id, ok: false, err: String((e && e.message) || e) }); }
}
