
/* ============================================================================
   Donnees : dates, qualite du tableau (doublons, identifiants repetes, types
   ambigus), changement de type d'une colonne, comparaison de deux groupes.
   ============================================================================ */
// ---------------------------------------------------------------- dates
// formats reconnus : aaaa-mm-jj[ hh:mm[:ss]] (ISO), jj/mm/aaaa (usage francais), aaaa/mm/jj, aaaa-mm ; date impossible (31/02) refusee
function parseDate(v) {
  if (v === null || v === undefined || v === "") return NaN; if (v instanceof Date) return v.getTime();
  const s = String(v).trim(); let m;
  const mk = (y, mo, d, h = 0, mi = 0, se = 0) => { if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1000 || y > 2999) return NaN; const t = Date.UTC(y, mo - 1, d, h, mi, se), x = new Date(t); return x.getUTCMonth() === mo - 1 && x.getUTCDate() === d ? t : NaN; };
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) return mk(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s))) return mk(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0));
  if ((m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s))) return mk(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{4})-(\d{1,2})$/.exec(s))) return mk(+m[1], +m[2], 1);
  return NaN;
}
// colonne de dates : au moins 90 % des valeurs (echantillon de 400) sont des dates valides
function isDateCol(t, c) {
  if (t.numeric instanceof Set && t.numeric.has(c)) return false;
  const n = t.rows.length, step = Math.max(1, Math.floor(n / 400)); let nn = 0, ok = 0;
  for (let i = 0; i < n && nn < 400; i += step) { const v = t.rows[i][c]; if (v === null || v === undefined || v === "") continue; nn++; if (Number.isFinite(parseDate(v))) ok++; }
  return nn >= 3 && ok >= 0.9 * nn;
}
const dateColumns = t => t.columns.filter(c => isDateCol(t, c));
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
// variables derivees d'une date (ajoutees au tableau) : annee, rang du mois, trimestre, mois, jour de semaine, anciennete en jours
function deriveDate(table, c, parts = ["annee", "rang", "trimestre", "mois", "jour", "anciennete"]) {
  const ts = table.rows.map(r => parseDate(r[c])), fin = ts.filter(Number.isFinite); if (!fin.length) throw new Error(`Aucune date lisible dans ${c}.`);
  const tmax = maxOf(fin), d0 = new Date(minOf(fin)), m0 = d0.getUTCFullYear() * 12 + d0.getUTCMonth(), numeric = new Set(table.numeric instanceof Set ? table.numeric : []), cols = table.columns.slice(), added = [];
  const def = { annee: [`${c} · année`, true, d => d.getUTCFullYear()], rang: [`${c} · mois écoulés`, true, d => d.getUTCFullYear() * 12 + d.getUTCMonth() - m0],
    trimestre: [`${c} · trimestre`, false, d => `T${Math.floor(d.getUTCMonth() / 3) + 1}`], mois: [`${c} · mois`, false, d => `${String(d.getUTCMonth() + 1).padStart(2, "0")} · ${MOIS[d.getUTCMonth()]}`],
    jour: [`${c} · jour`, false, d => `${(d.getUTCDay() + 6) % 7 + 1} · ${JOURS[(d.getUTCDay() + 6) % 7]}`], anciennete: [`${c} · ancienneté (jours)`, true, (d, t) => Math.round((tmax - t) / 86400000)] };
  for (const p of parts) { const [name, isNum, f] = def[p]; if (cols.includes(name)) continue; cols.push(name); added.push(name); if (isNum) numeric.add(name);
    table.rows.forEach((r, i) => { const t = ts[i]; r[name] = Number.isFinite(t) ? f(new Date(t), t) : null; }); }
  return { table: { ...table, columns: cols, numeric }, added };
}
// agregation par periode : cle entiere triable et libelle
const PERIODS = { mois: { l: "mois", key: d => d.getUTCFullYear() * 12 + d.getUTCMonth(), lab: k => `${MOIS[k % 12].slice(0, 4)}. ${Math.floor(k / 12)}` },
  trimestre: { l: "trimestre", key: d => d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3), lab: k => `T${k % 4 + 1} ${Math.floor(k / 4)}` },
  annee: { l: "année", key: d => d.getUTCFullYear(), lab: k => String(k) } };
function autoPeriod(ts) { const f = ts.filter(Number.isFinite); if (!f.length) return "mois"; const span = (maxOf(f) - minOf(f)) / 86400000; return span > 365 * 6 ? "annee" : span > 365 * 2.5 ? "trimestre" : "mois"; }
// par periode : effectif, et pour chaque serie numerique (alignee sur ts) la moyenne des valeurs presentes
function timeAggregate(ts, gran, series = []) {
  const P = PERIODS[gran], map = new Map();
  ts.forEach((t, i) => { if (!Number.isFinite(t)) return; const k = P.key(new Date(t)); let e = map.get(k); if (!e) { e = { n: 0, s: series.map(() => [0, 0]) }; map.set(k, e); } e.n++; series.forEach((y, j) => { const v = y[i]; if (Number.isFinite(v)) { e.s[j][0] += v; e.s[j][1]++; } }); });
  const keys = [...map.keys()].sort((a, b) => a - b);
  return { keys, labels: keys.map(P.lab), n: keys.map(k => map.get(k).n), means: series.map((_, j) => keys.map(k => { const [s, c] = map.get(k).s[j]; return c ? s / c : NaN; })) };
}

// ---------------------------------------------------------------- qualite du tableau
// empreinte numerique (53 bits) de chaque ligne : doublons exacts sans construire de longues chaines
function rowKeys(t, cols) {
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer), n = t.rows.length, out = new Float64Array(n), C = cols.length;
  for (let i = 0; i < n; i++) { const x = t.rows[i]; let a = 17, b = 31;
    for (let j = 0; j < C; j++) { const v = x[cols[j]]; let u, w;
      if (typeof v === "number") { f64[0] = v; const lo = u32[0], hi = u32[1]; u = Math.imul(lo ^ (hi >>> 7), 0x9e3779b1) ^ hi; w = Math.imul(hi ^ (lo >>> 11), 0x85ebca6b) ^ lo; }   // nombre : ses 64 bits, melanges dans les deux moities
      else if (v === null || v === undefined) { u = 0x9e3779b1; w = 0x85ebca77; }
      else { const s = String(v); u = 0x811c9dc5; w = 0x9747b28c; for (let k = 0; k < s.length; k++) { const c = s.charCodeAt(k); u = Math.imul(u ^ c, 16777619); w = Math.imul(w ^ c, 0x5bd1e995); } }
      a = Math.imul(a ^ u, 0x01000193); a ^= a >>> 15; b = Math.imul((b ^ w) + j, 0x85ebca6b); b ^= b >>> 13; }
    out[i] = (a >>> 0) * 2097152 + ((b >>> 0) & 0x1fffff); }
  return out;
}
function qualityReport(t, ty) {
  const n = t.rows.length, out = { n, issues: [] }, add = (level, title, detail, extra = {}) => out.issues.push({ level, title, detail, ...extra });
  // 1. lignes entierement dupliquees (hors identifiant)
  const keyCols = t.columns.filter(c => c !== ty.ident), keys = rowKeys(t, keyCols), first = new Map(), dupIdx = [];
  keys.forEach((k, i) => { if (first.has(k)) dupIdx.push(i); else first.set(k, i); });
  out.dupRows = dupIdx.length; out.dupIdx = dupIdx;
  if (dupIdx.length) add(dupIdx.length / n > 0.01 ? "haute" : "moyenne", `${dupIdx.length.toLocaleString("fr-FR")} ligne${dupIdx.length > 1 ? "s" : ""} en double`, `Toutes les colonnes${ty.ident ? " (hors identifiant)" : ""} sont identiques à une ligne précédente : ${fr(dupIdx.length / n * 100, 2)} % du tableau. Elles pèsent deux fois dans l'analyse.`, { action: "dups" });
  // 2. identifiants repetes : colonne a valeurs presque toutes distinctes mais pas toutes
  out.idDups = [];
  // candidats : colonnes texte, ou entieres designees comme identifiant (des decimaux presque tous distincts ne sont pas des identifiants)
  const idCand = t.columns.filter(c => !(t.numeric instanceof Set && t.numeric.has(c)) || c === ty.ident || c === ty.numId).filter(c => { const s = new Set(); let k = 0; for (let i = 0; i < n && k < 3000; i += Math.max(1, Math.floor(n / 3000))) { const v = t.rows[i][c]; if (v === null || v === undefined) continue; k++; s.add(v); } return k >= 20 && s.size >= 0.9 * k; });
  for (const c of idCand) {
    const counts = new Map(); let nn = 0; for (const r of t.rows) { const v = r[c]; if (v === null || v === undefined) continue; nn++; counts.set(v, (counts.get(v) || 0) + 1); }
    if (nn < 20 || counts.size === nn || counts.size < 0.9 * nn) continue;
    const rep = [...counts].filter(([, k]) => k > 1), extra = rep.reduce((s, [, k]) => s + k - 1, 0), top = rep.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, k]) => ({ v: String(v), k }));
    out.idDups.push({ col: c, distinct: counts.size, rows: nn, repeated: rep.length, extra, top });
    add("haute", `Identifiant répété : ${c}`, `${counts.size.toLocaleString("fr-FR")} valeurs distinctes pour ${nn.toLocaleString("fr-FR")} lignes : ${rep.length.toLocaleString("fr-FR")} valeur${rep.length > 1 ? "s" : ""} apparaissent plusieurs fois (${extra.toLocaleString("fr-FR")} ligne${extra > 1 ? "s" : ""} en trop). Exemples : ${top.map(o => `${o.v} (×${o.k})`).join(", ")}.`, { col: c, action: "iddups" });
  }
  // 3. colonnes vides, constantes, types melanges, valeurs manquantes
  for (const c of t.columns) {
    const ci = colInfo(t.rows, c), miss = n - ci.nonNull;
    if (!ci.nonNull) { add("moyenne", `Colonne vide : ${c}`, "Aucune valeur : elle peut être supprimée du fichier."); continue; }
    const vals = new Set(); for (const r of t.rows) { const v = r[c]; if (v !== null && v !== undefined) { vals.add(v); if (vals.size > 1) break; } }
    if (vals.size === 1) add("moyenne", `Colonne constante : ${c}`, `Une seule valeur (${String([...vals][0])}) : elle n'apporte aucune information.`);
    if (miss / n >= 0.2) add(miss / n >= 0.5 ? "haute" : "moyenne", `${c} : ${pc(miss / n * 100, 0)} de valeurs manquantes`, "Exclure ces lignes réduit fortement l'échantillon : préférez l'imputation (onglet Profil) ou retirez la variable.");
    if (!(t.numeric instanceof Set && t.numeric.has(c))) { let k = 0, ok = 0; for (const r of t.rows) { const v = r[c]; if (v === null || v === undefined) continue; if (++k > 5000) break; if (Number.isFinite(toNum(v))) ok++; } const f = k ? ok / Math.min(k, 5000) : 0;
      if (f >= 0.5 && f < 0.9) add("moyenne", `${c} : nombres mêlés de texte`, `${pc(f * 100, 0)} des valeurs sont des nombres, le reste du texte : la colonne est lue comme qualitative. Corrigez les valeurs non numériques, ou changez son type (fiche de la colonne).`, { col: c }); }
  }
  // 4. dates detectees
  out.dates = dateColumns(t); if (out.dates.length) add("info", `${out.dates.length} colonne${out.dates.length > 1 ? "s" : ""} de dates : ${out.dates.join(", ")}`, "Onglet Temps : évolution dans le temps. Fiche de la colonne : créer des variables (année, mois, trimestre, ancienneté).");
  const rank = { haute: 0, moyenne: 1, info: 2 }; out.issues.sort((a, b) => rank[a.level] - rank[b.level]);
  out.score = Math.max(0, Math.round(100 - out.issues.reduce((s, o) => s + (o.level === "haute" ? 12 : o.level === "moyenne" ? 5 : 0), 0) - clamp(out.dupRows / n * 300, 0, 25)));
  return out;
}
// changement de type d'une colonne : quantitative <-> qualitative (les valeurs sont converties si besoin)
function retype(table, c, kind) {
  const numeric = new Set(table.numeric instanceof Set ? table.numeric : []);
  if (kind === "quanti") { let ok = 0, nn = 0; table.rows.forEach(r => { const v = r[c]; if (v === null || v === undefined) return; nn++; const x = toNum(v); r[c] = Number.isFinite(x) ? x : null; if (Number.isFinite(x)) ok++; }); numeric.add(c); return { table: { ...table, numeric }, lost: nn - ok }; }
  numeric.delete(c); return { table: { ...table, numeric }, lost: 0 };
}

// ---------------------------------------------------------------- comparaison de deux groupes
// quantitatives : ecart des moyennes en ecarts-types poolés (d de Cohen), test de Welch ; qualitatives : V de Cramer, test du chi2, ecarts de proportions
const tSf2 = (t, df) => (df > 0 && Number.isFinite(t) ? betai(df / 2, 0.5, df / (df + t * t)) : 1);   // P(|T| > t) pour une loi de Student
function compareGroups(table, rows, A, B, opts = {}) {
  const skip = new Set(opts.skip || []), out = { nA: A.length, nB: B.length, num: [], cat: [] };
  for (const c of table.columns) {
    if (skip.has(c)) continue; const ci = colInfo(rows, c); if (!ci.nonNull) continue;
    if (ci.isNum) { const x = ci.num, st = idx => { let s = 0, k = 0; for (const i of idx) { const v = x[i]; if (v === v) { s += v; k++; } } const m = k ? s / k : NaN; let q = 0; for (const i of idx) { const v = x[i]; if (v === v) q += (v - m) ** 2; } return { m, v: k > 1 ? q / (k - 1) : 0, k }; };
      const a = st(A), b = st(B); if (a.k < 2 || b.k < 2) continue; const sp = Math.sqrt(((a.k - 1) * a.v + (b.k - 1) * b.v) / (a.k + b.k - 2)), se = Math.sqrt(a.v / a.k + b.v / b.k);
      const t = se > 0 ? (a.m - b.m) / se : 0, df = se > 0 ? (a.v / a.k + b.v / b.k) ** 2 / ((a.v / a.k) ** 2 / (a.k - 1) + (b.v / b.k) ** 2 / (b.k - 1)) : 1;
      out.num.push({ col: c, mA: a.m, mB: b.m, nA: a.k, nB: b.k, d: sp > 0 ? (a.m - b.m) / sp : 0, t, df, p: tSf2(t, df) }); }
    else { const { code, names } = ci.cats; if (names.length > 40 || names.length < 2) continue; const cA = new Float64Array(names.length), cB = new Float64Array(names.length); let nA = 0, nB = 0;
      for (const i of A) { const k = code[i]; if (k >= 0) { cA[k]++; nA++; } } for (const i of B) { const k = code[i]; if (k >= 0) { cB[k]++; nB++; } } if (!nA || !nB) continue;
      let chi = 0; const N = nA + nB; names.forEach((_, k) => { const tot = cA[k] + cB[k]; if (!tot) return; const eA = tot * nA / N, eB = tot * nB / N; chi += (cA[k] - eA) ** 2 / eA + (cB[k] - eB) ** 2 / eB; });
      const used = names.filter((_, k) => cA[k] + cB[k] > 0).length, df = Math.max(1, used - 1);
      out.cat.push({ col: c, V: Math.sqrt(chi / N), chi2: chi, df, p: chi2sf(chi, df), mods: names.map((nm, k) => ({ nm, a: cA[k] / nA, b: cB[k] / nB, diff: cA[k] / nA - cB[k] / nB })).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)) }); }
  }
  out.num.sort((x, y) => Math.abs(y.d) - Math.abs(x.d)); out.cat.sort((x, y) => y.V - x.V); return out;
}
