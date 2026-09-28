
/* ============================================================================
   Panneaux du studio : Insights, Projections, Classes, Matrices, Profil.
   ============================================================================ */
const vPos = v => (v >= 0 ? "var(--pos)" : "var(--neg)");
const pv = p => (p < 0.001 ? "p < 0,001" : "p = " + fr(p, 3));
function colOf(r, j) { return r.X.map(row => row[j]); }
function sampleIdx(n, cap, seed = 5) { if (n <= cap) return range(n); const rnd = mulberry(seed); return range(n).map(i => [rnd(), i]).sort((a, b) => a[0] - b[0]).slice(0, cap).map(t => t[1]).sort((a, b) => a - b); }

/* ------------------------------------------------------------------ mini-graphiques des insights */
// cadre robuste : quantiles 1 % - 99 % si des valeurs extremes ecraseraient le reste
function robustRange(v) {   // quantiles estimes sur 20 000 valeurs au plus ; minimum et maximum exacts
  const mn = minOf(v), mx = maxOf(v); if (!Number.isFinite(mn)) return [0, 1];
  const s = (v.length > 20000 ? sampleRows(v.length, 20000, 71).map(i => v[i]) : Array.from(v)).filter(Number.isFinite).sort((a, b) => a - b), lo = quantile(s, 0.01), hi = quantile(s, 0.99);
  return mx - mn > 3 * (hi - lo) && hi > lo ? [lo, hi] : [mn, mx];
}
// moyennes par deciles de x (tendance, revele les courbes) sur 20 000 points au plus
function decileTrend(x, y) { const idx = x.length > 20000 ? sampleRows(x.length, 20000, 73) : range(x.length), s = idx.map(k => [x[k], y[k]]).filter(t => Number.isFinite(t[0]) && Number.isFinite(t[1])).sort((a, c) => a[0] - c[0]);
  return range(10).map(b => s.slice(Math.floor(b * s.length / 10), Math.floor((b + 1) * s.length / 10))).filter(t => t.length).map(t => [mean(t.map(u => u[0])), mean(t.map(u => u[1]))]); }
function miniFrame(w, h, body) { return `<svg viewBox="0 0 ${w} ${h}" class="minichart" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, sans-serif">${body}</svg>`; }
function miniScatter(r, i, j, w = 260, h = 130) {
  const x = colOf(r, i), y = colOf(r, j), idx = sampleIdx(x.length, 500), cols = itemColors(r), fx = robustRange(x), fy = robustRange(y);
  const X = v => 10 + (w - 20) * clamp((v - fx[0]) / ((fx[1] - fx[0]) || 1), -0.02, 1.02), Y = v => h - 10 - (h - 20) * clamp((v - fy[0]) / ((fy[1] - fy[0]) || 1), -0.02, 1.02);
  const q = decileTrend(x, y);
  return miniFrame(w, h, idx.map(k => `<circle cx="${X(x[k]).toFixed(1)}" cy="${Y(y[k]).toFixed(1)}" r="${x.length > 200 ? 1.6 : 2.4}" style="fill:${cols[k]}" fill-opacity=".55"/>`).join("") +
    `<polyline points="${q.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}" fill="none" style="stroke:var(--amber)" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<text x="${w - 4}" y="${h - 2}" text-anchor="end" font-size="9" style="fill:var(--faint)">${esc(r.vars[i])} →</text><text x="4" y="10" font-size="9" style="fill:var(--faint)">↑ ${esc(r.vars[j])}</text>`);
}
function miniHist(col, w = 260, h = 130, rows = state.work.rows) {
  const d = colInfo(rows, col).desc, v = d.sorted, rr = robustRange(v), inR = v.filter(x => x >= rr[0] && x <= rr[1]), H = histogram(inR, 26), mx = maxOf(H.bins), bw = (w - 20) / H.bins.length, X = x => 10 + (w - 20) * clamp((x - H.lo) / ((H.hi - H.lo) || 1), 0, 1), cut = v.length - inR.length;
  return miniFrame(w, h, H.bins.map((b, k) => `<rect x="${(10 + k * bw + 0.5).toFixed(1)}" y="${(h - 14 - (h - 26) * b / mx).toFixed(1)}" width="${Math.max(bw - 1, 1).toFixed(1)}" height="${((h - 26) * b / mx).toFixed(1)}" rx="1.5" style="fill:var(--a2)" fill-opacity=".75"/>`).join("") +
    `<line x1="${X(d.mean)}" x2="${X(d.mean)}" y1="8" y2="${h - 14}" style="stroke:var(--amber)" stroke-width="1.6"/><line x1="${X(d.med)}" x2="${X(d.med)}" y1="8" y2="${h - 14}" style="stroke:var(--text)" stroke-dasharray="3 3"/>` +
    `<text x="${X(d.mean) + 4}" y="16" font-size="9" style="fill:var(--amber)">moyenne</text><text x="${X(d.med) - 4}" y="28" text-anchor="end" font-size="9" style="fill:var(--muted)">médiane</text>` + (cut ? `<text x="${w - 8}" y="16" text-anchor="end" font-size="9" style="fill:var(--faint)">${cut} valeur${cut > 1 ? "s" : ""} extrême${cut > 1 ? "s" : ""} hors cadre →</text>` : ""));
}
function miniBars(data, w = 260, h = 130) {
  const mx = maxOf(data.map(d => Math.abs(d.v)), 1e-9), neg = data.some(d => d.v < 0), bw = (w - 20) / data.length, base = neg ? (h - 18) / 2 + 4 : h - 16;
  return miniFrame(w, h, data.map((d, k) => { const hh = (neg ? (h - 26) / 2 : h - 26) * Math.abs(d.v) / mx; return `<rect x="${(10 + k * bw + 2).toFixed(1)}" y="${(d.v >= 0 ? base - hh : base).toFixed(1)}" width="${Math.max(bw - 4, 2).toFixed(1)}" height="${Math.max(hh, 1).toFixed(1)}" rx="2" style="fill:${d.c}"/><text x="${(10 + k * bw + bw / 2).toFixed(1)}" y="${h - 3}" text-anchor="middle" font-size="9" style="fill:var(--faint)">${esc(d.l)}</text>`; }).join(""));
}
function miniGauge(v, w = 260, h = 130) { const R = 44, c = 2 * Math.PI * R, f = clamp(v, 0, 1); return miniFrame(w, h, `<circle cx="${w / 2}" cy="${h / 2}" r="${R}" fill="none" style="stroke:var(--line-2)" stroke-width="10"/><circle cx="${w / 2}" cy="${h / 2}" r="${R}" fill="none" style="stroke:var(--a2)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${w / 2} ${h / 2})"/><text x="${w / 2}" y="${h / 2 + 6}" text-anchor="middle" font-size="18" font-weight="600" style="fill:var(--text)">${pc(f * 100, 0)}</text>`); }
function miniScree(r, w = 260, h = 130) { return miniBars(r.pct.slice(0, 10).map((p, k) => ({ l: String(k + 1), v: p, c: k < r.nAxes ? `var(--a${Math.min(k, 2) + 1})` : "var(--faint)" })), w, h); }
function miniTQ(r, w = 260, h = 130) { const dg = diagCache(r), xm = maxOf(dg.T2, dg.ucT) * 1.08, ym = maxOf(dg.Q, dg.ucQ || 0) * 1.08, X = v => 10 + (w - 20) * v / xm, Y = v => h - 10 - (h - 20) * v / ym;
  return miniFrame(w, h, `<line x1="${X(dg.ucT)}" x2="${X(dg.ucT)}" y1="6" y2="${h - 10}" style="stroke:var(--a2)" stroke-dasharray="3 3"/>${dg.ucQ ? `<line x1="10" x2="${w - 10}" y1="${Y(dg.ucQ)}" y2="${Y(dg.ucQ)}" style="stroke:var(--a1)" stroke-dasharray="3 3"/>` : ""}` +
    (dg.T2.length > 1500 ? [...new Set([...sampleRows(dg.T2.length, 1000, 67), ...range(dg.T2.length).filter(i => dg.T2[i] > dg.ucT || (dg.ucQ && dg.Q[i] > dg.ucQ)).slice(0, 300)])] : range(dg.T2.length)).map(i => { const t = dg.T2[i], out = t > dg.ucT || (dg.ucQ && dg.Q[i] > dg.ucQ); return `<circle cx="${X(t).toFixed(1)}" cy="${Y(dg.Q[i]).toFixed(1)}" r="${out ? 3.2 : 1.8}" style="fill:${out ? "var(--amber)" : "var(--muted)"}" fill-opacity="${out ? 1 : 0.45}"/>`; }).join("")); }
function miniGroupMeans(r, j, w = 260, h = 130) { const cats = [...new Set(r.groups)], y = colOf(r, j), m = mean(y), sd = sdPop(y) || 1; return miniBars(cats.map((c, k) => ({ l: c.slice(0, 7), v: (mean(y.filter((_, i) => r.groups[i] === c)) - m) / sd, c: `var(--g${k % 10 + 1})` })), w, h); }
function renderMini(r, m) {
  if (!m) return ""; try {
    if (m.type === "scatter") return miniScatter(r, m.i, m.j); if (m.type === "hist") return miniHist(m.col); if (m.type === "bars") return miniBars(m.data); if (m.type === "gauge") return miniGauge(m.v);
    if (m.type === "scree") return miniScree(r); if (m.type === "tq") return miniTQ(r); if (m.type === "groupmeans") return miniGroupMeans(r, m.j);
  } catch (e) { return ""; } return "";
}

/* ------------------------------------------------------------------ moteur de calcul en arriere-plan (Web Worker) */
// le noyau (CORE_SRC, injecte au build) est recharge dans un worker : HCPC, scagnostics et insights ne bloquent plus l'interface.
// Si le navigateur ou la politique de securite interdit les workers, tout est calcule sur le fil principal.
// substituts des objets du navigateur, places AVANT le noyau (qui lit matchMedia au chargement)
const WORKER_HEAD = `const matchMedia = () => ({ matches: true }), document = { querySelector: () => null, documentElement: { dataset: {} } }, getComputedStyle = () => ({ getPropertyValue: () => "" }), window = self;\n`;
const WORKER_MAIN = `
self.onmessage = e => { const { id, task, payload } = e.data; try { let out;
  if (task === "insights") { const { table, method, params, hcOpts } = payload, t0 = performance.now();
    const res = method === "ACP" ? runACP(table, params) : method === "ACM" ? runACM(table, params) : method === "AFDM" ? runAFDM(table, params) : runAFC(table, params);
    const hc = method !== "AFC" && res.n >= 6 ? hcpc(res, hcOpts) : null, sc = method === "ACP" || method === "AFDM" ? scagAll(res) : [], ins = buildInsights(res, table, hc, sc);
    out = { ins, hc, scag: sc, ms: performance.now() - t0 }; }
  self.postMessage({ id, ok: true, out }); } catch (err) { self.postMessage({ id, ok: false, err: String((err && err.message) || err) }); } };`;
const Compute = {
  w: null, seq: 0, pending: new Map(),
  worker() {
    if (this.w === false || typeof CORE_SRC === "undefined") return null;
    if (!this.w) try {
      this.w = new Worker(URL.createObjectURL(new Blob([WORKER_HEAD, CORE_SRC, WORKER_MAIN], { type: "text/javascript" })));
      this.w.onmessage = e => { const { id, ok, out, err } = e.data, p = this.pending.get(id); this.pending.delete(id); if (p) ok ? p.resolve(out) : p.reject(new Error(err)); };
      this.w.onerror = () => { this.pending.forEach(p => p.reject(new Error("worker indisponible"))); this.pending.clear(); this.w = false; };
    } catch (e) { this.w = false; return null; }
    return this.w;
  },
  run(task, payload) { const w = this.worker(); if (!w) return null; const id = ++this.seq; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); w.postMessage({ id, task, payload }); }); },
};
function setBusy(label) { const b = $("#busyPill"); if (!b) return; b.hidden = !label; if (label) b.querySelector("span").textContent = label; }

/* ------------------------------------------------------------------ calculs de fond partages */
const Studio = {
  ensureHC(r = state.res) { if (!r || r.method === "AFC" || mainN(r) < 6) return null; const key = JSON.stringify(state.hcOpts); if (!state.hc || state.hc.res !== r || state.hc.key !== key) { const t0 = performance.now(); state.hc = { ...hcpc(r, state.hcOpts), res: r, key, ms: performance.now() - t0 }; } return state.hc; },
  ensureScag(r = state.res) { if (!r || !hasQ(r) || r.p < 2) return []; if (!state.scag || state.scag.res !== r) state.scag = { res: r, list: scagAll(r) }; return state.scag.list; },
  finishInsights(r, list, ms, sc, hc) {
    const nStat = (hasQ(r) ? sc.length * 12 + r.p * (r.p - 1) / 2 * 2 + r.p * 12 : 0) + state.work.columns.length * 10 + (hc ? hc.k * 20 : 0) + mainN(r) * 2;
    state.insights = { res: r, list, ms, nStat }; Studio._busy = null; setBusy(null);
    const badge = $("#insBadge"); if (badge) { badge.textContent = list.length; badge.hidden = false; } if (state.tab === "insights" || (state.tab === "classes" && hc)) renderPanel();
  },
  computeInsights() {
    const r = state.res; if (!r || (state.insights && state.insights.res === r) || Studio._busy === r) return; Studio._busy = r; setBusy("analyse automatique en cours");
    const key = JSON.stringify(state.hcOpts), t0 = performance.now(), job = Compute.run("insights", { table: state.work, method: state.method, params: state.params, hcOpts: state.hcOpts });
    const local = () => setTimeout(() => { if (state.res !== r) return (Studio._busy = null); let hc = null, sc = [];
      try { hc = Studio.ensureHC(r); sc = Studio.ensureScag(r); Studio.finishInsights(r, buildInsights(r, state.work, hc, sc), performance.now() - t0, sc, hc); }
      catch (e) { console.error(e); state.insights = { res: r, list: [], ms: 0, nStat: 0, err: e.message }; Studio._busy = null; setBusy(null); } }, 30);
    if (!job) return local();
    job.then(out => { if (state.res !== r) return; if (out.hc && (!state.hc || state.hc.res !== r)) state.hc = { ...out.hc, res: r, key, ms: out.ms, worker: true };
      if (!state.scag || state.scag.res !== r) state.scag = { res: r, list: out.scag }; state.insightsWorker = true; Studio.finishInsights(r, out.ins, performance.now() - t0, out.scag, out.hc); }).catch(() => { Studio._busy = null; local(); });
  },
};

/* ------------------------------------------------------------------ Insights */
const INS_FILTERS = { tous: null, relations: ["corr", "indirect", "nonlin", "curve", "redund", "assoc", "shape"], distributions: ["skew", "bimodal", "missing"], structure: ["structure", "clusters", "groups", "hidden", "outlier"] };
function pInsights(r) {
  const I = state.insights;
  if (!I || I.res !== r) { Studio.computeInsights(); return `<div class="grid2"><div class="card wide ins-head"><h3 class="panel-title">Insights automatiques</h3><p class="panel-sub" style="margin:0">Calcul de centaines de statistiques en cours…</p><div class="prog"><i class="indet"></i></div></div>${range(6).map(() => `<div class="card ins-card sk"><i></i><i></i><i></i></div>`).join("")}</div>`; }
  const f = state.insFilter || "tous", list = I.list.filter(o => !INS_FILTERS[f] || INS_FILTERS[f].includes(o.kind));
  return `<div class="ins-grid"><div class="card ins-head"><div><h3 class="panel-title">${pl(I.list.length, "insight", "insights")} trouvés <span class="beyond">automatique</span></h3>
      <p class="panel-sub" style="margin:0">Environ ${I.nStat} mesures calculées en ${fr(I.ms / 1000, 2)} s (corrélations brutes et partielles, dépendances non linéaires, scagnostics, asymétrie, bimodalité, atypiques, classification), puis classées par intérêt. Chaque carte ouvre la vue qui le montre.</p></div>
      <div class="planpick">${Object.keys(INS_FILTERS).map(k => `<button type="button" data-insf="${k}" aria-pressed="${f === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div></div>
    ${list.map((o, n) => { const K = INSIGHT_KINDS[o.kind] || { l: o.kind, ic: "•", c: "var(--a2)" }, R = 15, C = 2 * Math.PI * R;
      return `<article class="card ins-card" style="--k:${K.c};animation-delay:${Math.min(n, 12) * 40}ms"><header><span class="ins-kind"><i>${K.ic}</i>${K.l}</span><svg class="ins-score" viewBox="0 0 40 40" aria-label="Intérêt ${Math.round(o.score * 100)} sur 100"><circle cx="20" cy="20" r="${R}" fill="none" style="stroke:var(--line-2)" stroke-width="3.5"/><circle cx="20" cy="20" r="${R}" fill="none" style="stroke:var(--k)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${(C * o.score).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 20 20)"/><text x="20" y="24" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--text)">${Math.round(o.score * 100)}</text></svg></header>
        <h3>${esc(o.title)}</h3><p>${esc(o.text)}</p><div class="ins-mini">${renderMini(r, o.mini)}</div><footer>${insActs(o)}</footer></article>`; }).join("")}</div>`;
}
function insActs(o) {
  const a = o.act || {}, b = [];
  if (a.pair) b.push(`<button class="btn sm" type="button" data-insact="pair" data-i="${a.pair[0]}" data-j="${a.pair[1]}">Voir le nuage</button>`);
  if (a.select) b.push(`<button class="btn sm" type="button" data-insact="select" data-idx="${a.select.join(",")}">Sélectionner et expliquer</button>`);
  if (a.tab) b.push(`<button class="btn sm" type="button" data-insact="tab" data-t="${a.tab}">Ouvrir ${({ axes: "les axes", variables: "les variables", hyper: "l'hyperespace", classes: "les classes", profil: "le profil", synthese: "la synthèse" })[a.tab] || a.tab}</button>`);
  if (a.hyper) b.push(`<button class="btn sm" type="button" data-insact="hyper">Lancer le tour</button>`);
  if (a.transform) b.push(`<button class="btn sm prime" type="button" data-insact="transform" data-c="${esc(a.transform[0])}" data-t="${a.transform[1]}">Appliquer un log</button>`);
  if (a.enc) b.push(`<button class="btn sm" type="button" data-insact="enc" data-e="${esc(a.enc)}">Colorer la 3D</button>`);
  return b.join("");
}
function insightAction(b) {
  const r = state.res, a = b.dataset.insact;
  if (a === "pair") { state.mat = { ...(state.mat || {}), zoom: [+b.dataset.i, +b.dataset.j] }; state.tab = "matrices"; renderPanel(); }
  if (a === "select") { Sel.set(b.dataset.idx.split(",").map(Number), "insight"); explainSelection(); }
  if (a === "tab") { state.tab = b.dataset.t; renderPanel(); }
  if (a === "hyper") { $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); Stage.startHyper("tour"); }
  if (a === "transform") { state.prep.tr[b.dataset.c] = b.dataset.t; toast(`${b.dataset.c} passée au logarithme. Analyse relancée.`); run("morph"); }
  if (a === "enc") { setEnc("color", b.dataset.e); $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); }
}

/* ------------------------------------------------------------------ Projections : ACP, t-SNE, UMAP */
const PROJ = { pca: { l: "ACP", tag: "linéaire", d: "Conserve les distances globales et donne des axes interprétables." }, tsne: { l: "t-SNE", tag: "non linéaire", d: "Préserve les voisinages proches. La taille des groupes et les distances entre groupes ne sont pas interprétables." }, umap: { l: "UMAP", tag: "non linéaire", d: "Préserve les voisinages avec une structure globale mieux tenue que t-SNE. Les axes n'ont pas de sens." } };
function embInput(r) { return mainCloud(r).P; }
function pProjections(r) {
  const n = mainN(r); if (n < 12) return `<div class="card"><h3 class="panel-title">Projections</h3><p class="panel-sub">Il faut au moins 12 ${r.method === "AFC" ? "lignes" : "individus"} pour comparer les projections.</p></div>`;
  const E = state.emb.res === r ? state.emb : (state.emb = { res: r, perp: Math.round(clamp(n / 10, 5, 30)), nn: Math.round(clamp(n / 20, 5, 15)) });
  if (!E.pca) { const Y = embInput(r).map(f => [f[0], f[1] || 0]); E.pca = { Y, q: neighborhoodQuality(embInput(r), Y, embK(n)) }; }
  return `<div class="grid3"><div class="card wide3 proj-head"><div><h3 class="panel-title">Atlas des projections <span class="beyond">au-delà du cours</span></h3>
      <p class="panel-sub" style="margin:0">Trois façons d'aplatir le même nuage de ${r.q} dimensions. <b>Fiabilité</b> : les voisins à l'écran sont-ils de vrais voisins ? <b>Continuité</b> : les vrais voisins restent-ils proches à l'écran ? (Venna & Kaski, sur les ${embK(n)} plus proches voisins.) Glissez sur un nuage pour sélectionner : la sélection s'allume partout.</p></div>
      <div class="proj-par"><label>Perplexité t-SNE <input type="range" id="perpIn" min="5" max="50" step="1" value="${E.perp}"><output id="perpOut">${E.perp}</output></label><label>Voisins UMAP <input type="range" id="nnIn" min="5" max="50" step="1" value="${E.nn}"><output id="nnOut">${E.nn}</output></label><button class="btn sm" type="button" data-proj="recompute">Recalculer</button></div></div>
    ${["pca", "tsne", "umap"].map(k => { const e = E[k], M = PROJ[k];
      return `<div class="card proj-card" data-pk="${k}"><div class="proj-top"><div><h3 class="panel-title">${M.l} <span class="${k === "pca" ? "exact" : "beyond"}">${M.tag}</span></h3><p class="panel-sub" style="margin:0">${M.d}</p></div></div>
        <div class="proj-canvas" id="pc_${k}">${e?.Y ? "" : `<div class="proj-wait"><div class="prog"><i style="width:${((e?.prog || 0) * 100).toFixed(0)}%" id="pp_${k}"></i></div><span class="mono">${e?.err ? esc(e.err) : e?.running ? "Optimisation en cours…" : "En attente"}</span></div>`}</div>
        <div class="proj-met">${e?.q ? metChips(e.q) : `<span class="muted">Métriques après calcul</span>`}</div>${e?.sampled ? `<p class="lod-note">Projection d'un échantillon aléatoire de ${e.sampled.toLocaleString("fr-FR")} individus sur ${n.toLocaleString("fr-FR")}.</p>` : k === "pca" && n > 1200 ? `<p class="lod-note">Métriques estimées sur 1 200 individus tirés au hasard.</p>` : ""}
        <div class="proj-act"><button class="btn sm" type="button" data-proj="3d" data-k="${k}" ${e?.Y || k === "pca" ? "" : "disabled"}>Voir en 3D</button><button class="btn sm" type="button" data-proj="trust" data-k="${k}" ${e?.q ? "" : "disabled"}>Colorer par fiabilité locale</button></div></div>`; }).join("")}</div>`;
}
const embK = n => Math.max(3, Math.min(10, Math.floor((n - 1) / 4)));
function metChips(q) { const c = v => (v >= 0.9 ? "var(--ok)" : v >= 0.8 ? "var(--amber)" : "var(--a1)"); return [["Fiabilité", q.T], ["Continuité", q.C], ["Voisins gardés", q.knn]].map(([l, v]) => `<span class="met"><b style="color:${c(v)}">${l === "Voisins gardés" ? pc(v * 100, 0) : fr(v, 3)}</b>${l}</span>`).join(""); }
const ProjUI = {
  plots: {},
  mount() {
    const r = state.res, E = state.emb; if (!E || E.res !== r) return; const cols = itemColors(r), labels = mainNames(r);
    ["pca", "tsne", "umap"].forEach(k => { const host = $("#pc_" + k); if (host && E[k]?.Y) this.plots[k] = new Scatter2D(host, { pts: E[k].Y, colors: cols, labels, src: "proj-" + k, ratio: 0.82 }); });
    ["tsne", "umap"].forEach(k => { if (!E[k]) this.compute(k, 2); });
    const pi = $("#perpIn"), ni = $("#nnIn"); if (pi) pi.oninput = () => ($("#perpOut").textContent = pi.value); if (ni) ni.oninput = () => ($("#nnOut").textContent = ni.value);
  },
  redraw() { Object.values(this.plots).forEach(p => p.c.isConnected && p.draw()); },
  // t-SNE exact (memoire en n^2) : 2 000 individus au plus ; UMAP : 10 000. Au-dela, projection d'un echantillon aleatoire (indique a l'ecran).
  cap: { tsne: 2000, umap: 10000 },
  async compute(k, dim, live3d = false) {
    const r = state.res, E = state.emb, Xall = embInput(r), N = Xall.length, idx = N > this.cap[k] ? sampleRows(N, this.cap[k], 37) : null, X = idx ? idx.map(i => Xall[i]) : Xall;
    const full = Y => { if (!idx) return Y; const out = new Array(N).fill(null); idx.forEach((i, t) => (out[i] = Y[t])); return out; };
    if (!live3d) { E[k] = { running: true, prog: 0 }; }
    const onP = (Y, p) => { if (state.res !== r) return; if (live3d) { Stage.updateEmbedding(full(Y)); return; } E[k].prog = p; const bar = $("#pp_" + k); if (bar) bar.style.width = (p * 100).toFixed(0) + "%"; };
    try {
      const out = k === "tsne" ? await runTSNE(X, { dim, perplexity: E.perp, seed: 3 }, onP) : await runUMAP(X, { dim, nNeighbors: E.nn, minDist: 0.1, seed: 7 }, onP);
      if (state.res !== r) return; if (live3d) { E[k + "3"] = full(out.Y); Stage.updateEmbedding(E[k + "3"], true); return; }
      const q = neighborhoodQuality(X, out.Y, embK(X.length)); if (idx) q.idx = q.idx.map(t => idx[t]);
      E[k] = { Y: full(out.Y), q, kl: out.kl, worker: out.worker, sampled: idx ? idx.length : 0 };
    } catch (e) { E[k] = { err: e.message }; }
    if (state.tab === "projections" && state.res === r) renderPanel();
  },
  show3d(k) {
    const r = state.res, E = state.emb; $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (k === "pca") { Stage.setView("3d"); return; }
    Stage.showEmbedding(E[k + "3"] || E[k].Y.map(y => [y[0], y[1], 0]), PROJ[k].l);
    if (!E[k + "3"]) this.compute(k, 3, true);
  },
};

/* ------------------------------------------------------------------ Classes (HCPC) */
function svgGains(hc, w = 460, h = 190) {
  const g = hc.gains.slice(0, 15), mx = maxOf(g), bw = (w - 40) / g.length;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, sans-serif">${g.map((v, i) => { const hh = (h - 44) * v / mx, cut = i < hc.k - 1; return `<rect x="${(24 + i * bw + 2).toFixed(1)}" y="${(h - 24 - hh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${hh.toFixed(1)}" rx="3" style="fill:${cut ? "var(--a2)" : "var(--line-2)"}"/><text x="${(24 + i * bw + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" style="fill:var(--faint);font-family:var(--f-mono)">${i + 2}</text>`; }).join("")}
    <line x1="${24 + (hc.k - 1) * bw}" x2="${24 + (hc.k - 1) * bw}" y1="10" y2="${h - 22}" style="stroke:var(--amber)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${24 + (hc.k - 1) * bw + 5}" y="20" font-size="11" style="fill:var(--amber)">coupure · ${hc.k} classes</text></svg>`;
}
function svgDendro(hc, w = 900, h = 260) {
  const W = hc.ward; if (!W) return `<p class="panel-sub">Au-delà de 1 200 individus, l'arbre est construit sur une pré-classification k-means : le dendrogramme détaillé n'est pas affiché.</p>`;
  const n = W.n, lo = hc.leaves, pos = new Array(n), H = new Array(2 * n - 1).fill(0), X = new Array(2 * n - 1), hm = W.tree.at(-1).h, lab = hc.labels, maj = new Array(2 * n - 1);
  lo.forEach((leaf, k) => { pos[leaf] = k; X[leaf] = 14 + (w - 28) * (k + 0.5) / n; maj[leaf] = lab[leaf]; });
  const Y = v => h - 18 - (h - 34) * Math.sqrt(v / hm); let s = "";
  W.tree.forEach((m, t) => { const id = n + t; X[id] = (X[m.a] + X[m.b]) / 2; H[id] = m.h; maj[id] = maj[m.a] === maj[m.b] ? maj[m.a] : -1; const below = t < n - hc.k, c = below && maj[id] >= 0 ? `var(--g${maj[id] % 10 + 1})` : "var(--muted)";
    s += `<path d="M${X[m.a].toFixed(1)},${Y(H[m.a]).toFixed(1)}V${Y(m.h).toFixed(1)}H${X[m.b].toFixed(1)}V${Y(H[m.b]).toFixed(1)}" fill="none" style="stroke:${c}" stroke-width="${below ? 1.3 : 2}" stroke-opacity="${below ? 0.9 : 1}"/>`; });
  const cutY = (Y(W.tree[n - hc.k - 1]?.h ?? 0) + Y(W.tree[n - hc.k].h)) / 2;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, sans-serif">${s}<line x1="8" x2="${w - 8}" y1="${cutY}" y2="${cutY}" style="stroke:var(--amber)" stroke-dasharray="5 5" stroke-width="1.5"/><text x="${w - 10}" y="${cutY - 6}" text-anchor="end" font-size="11" style="fill:var(--amber)">coupure</text>${n <= 70 ? lo.map(leaf => `<text transform="translate(${X[leaf] + 3},${h - 14}) rotate(-60)" text-anchor="end" font-size="8.5" style="fill:var(--muted)">${esc(state.res.names[leaf].slice(0, 16))}</text>`).join("") : ""}</svg>`;
}
function pClasses(r) {
  if (r.method === "AFC") return `<div class="card"><h3 class="panel-title">Classes</h3><p class="panel-sub">La classification porte sur les individus d'une ACP ou d'une ACM. Pour un tableau croisé, la représentation simultanée montre directement les proximités.</p></div>`;
  const hc = Studio.ensureHC(r); if (!hc) return `<div class="card"><p class="panel-sub">Pas assez d'individus pour une classification.</p></div>`;
  const names = mainNames(r), rows = workRows(r), o = state.hcOpts;
  const cards = range(hc.k).map(j => { const mem = new Set(range(hc.n).filter(i => hc.labels[i] === j)), d = describeSubset(state.work, rows, mem, { skip: [state.params.ident].filter(Boolean) }), q = d.filter(x => x.type === "quanti" && Math.abs(x.v) >= 2).slice(0, 5), m = d.filter(x => x.type === "modal" && x.v >= 2).slice(0, 3);
    const sentence = `${q.length ? liste(q.slice(0, 3).map(x => `${x.col} ${x.v > 0 ? "élevé" : "faible"}`), 3) : "profil proche de la moyenne"}${m.length ? ` · surtout « ${m[0].cat} » (${pc(m[0].modcla * 100, 0)})` : ""}`;
    return `<div class="card cls-card" style="--c:var(--g${j % 10 + 1})"><header><span class="cls-dot"></span><h3>Classe ${j + 1}</h3><span class="mono muted">${hc.sizes[j]} · ${pc(hc.sizes[j] / hc.n * 100, 0)}</span><button class="btn sm" type="button" data-cls="${j}">Sélectionner</button></header>
      <p class="cls-sent">${esc(sentence)}</p>${q.map(x => exRow(x.col, (x.mk - x.m) / (x.sd || 1), x.v, `${fmtNum(x.mk)} contre ${fmtNum(x.m)}`)).join("")}${m.map(x => exMod(x)).join("")}
      <div class="cls-ind"><span>Parangons</span>${hc.paragons[j].map(i => `<button type="button" data-typ="${i}">${esc(names[i])}</button>`).join("")}</div><div class="cls-ind"><span>Les plus spécifiques</span>${hc.specific[j].map(i => `<button type="button" data-typ="${i}">${esc(names[i])}</button>`).join("")}</div></div>`; }).join("");
  return `<div class="grid2"><div class="card wide cls-head"><div><h3 class="panel-title">Classification hiérarchique sur composantes principales <span class="beyond">HCPC</span></h3>
      <p class="panel-sub" style="margin:0">Ward sur les ${pl(hc.dims, "axe")} ${hc.dims === r.nAxes ? "retenus (le bruit des derniers axes est écarté)" : ""}, coupure au plus grand saut d'inertie, puis consolidation par k-means (Husson, Josse & Pagès 2010). La partition explique <b>${pc(hc.R2 * 100, 1)}</b> de l'inertie.${hc.pre ? " Grand tableau : pré-classification k-means en 400 groupes avant Ward." : ""}</p></div>
      <div class="cls-ctl"><label>Classes <select id="hcK"><option value="">Auto (${hc.kAuto})</option>${range(9).map(i => i + 2).map(k => `<option value="${k}" ${o.k === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
      <label>Axes <select id="hcD"><option value="">Retenus (${r.nAxes})</option><option value="${r.q}" ${o.dims === r.q ? "selected" : ""}>Tous (${r.q})</option></select></label>
      <label class="chk"><input type="checkbox" id="hcC" ${o.consol !== false ? "checked" : ""}> Consolidation</label>
      <button class="btn sm prime" type="button" data-hcact="tree" ${hc.ward ? "" : "disabled"}>Arbre 3D</button><button class="btn sm" type="button" data-hcact="color">Colorer la 3D</button></div></div>
    <div class="card"><h3 class="panel-title">Gains d'inertie</h3><p class="panel-sub">Inertie gagnée à chaque division de l'arbre. La coupure se place avant le premier grand affaissement.</p><div class="svgbox">${svgGains(hc)}</div></div>
    <div class="card"><h3 class="panel-title">Dendrogramme</h3><p class="panel-sub">Hauteur en racine du gain d'inertie de Ward (lecture plus lisible, l'ordre des fusions est inchangé).</p><div class="svgbox">${svgDendro(hc, 900, 300)}</div></div>
    ${cards}</div>`;
}

/* ------------------------------------------------------------------ Matrices : SPLOM + scagnostics, matrice de Bertin */
const MEAS = ["dcor", "monotonic", "nonmono", "clumpy", "striated", "outlying", "stringy", "skewed"];
function pMatrices(r) {
  if (r.method === "ACM" || (r.method === "AFDM" && r.p < 2)) return pBurt(r); if (r.method === "AFC") return pSeriation(r);
  const sc = Studio.ensureScag(r), M = state.mat || (state.mat = {}), meas = M.meas || "dcor", ord = varOrder(r), vars = ord.slice(0, clamp(M.nv || 8, 3, Math.min(10, r.p))), zoom = M.zoom || [vars[0], vars[1]];
  const find = (i, j) => sc.find(s => (s.i === i && s.j === j) || (s.i === j && s.j === i)), top = sc.slice().sort((a, b) => (b[meas] ?? 0) - (a[meas] ?? 0)).slice(0, 8), zs = find(zoom[0], zoom[1]);
  return `<div class="grid2"><div class="card wide"><div class="rowhead"><div><h3 class="panel-title">Matrice de nuages et scagnostics <span class="beyond">au-delà du cours</span></h3><p class="panel-sub" style="margin:0">Sous la diagonale : les nuages ; sur la diagonale : les distributions ; au-dessus : la mesure choisie (Wilkinson, Anand & Grossman 2005), du bleu (faible) au corail (fort). Cliquez une case pour l'agrandir.</p></div>
      <div class="mat-ctl"><label>Mesure <select id="matMeas">${MEAS.map(k => `<option value="${k}" ${k === meas ? "selected" : ""}>${SCAG[k].l}</option>`).join("")}</select></label><label>Variables <select id="matNv">${range(Math.min(10, r.p) - 2).map(i => i + 3).map(k => `<option ${k === vars.length ? "selected" : ""}>${k}</option>`).join("")}</select></label></div></div>
      <div class="splom-wrap"><canvas id="splom"></canvas></div><p class="panel-sub" style="margin:8px 0 0">${esc(SCAG[meas].l)} : ${esc(SCAG[meas].d)}.</p></div>
    <div class="card"><h3 class="panel-title">${esc(r.vars[zoom[0]])} × ${esc(r.vars[zoom[1]])}</h3><p class="panel-sub">Ligne dorée : moyennes par déciles (révèle les courbes). Glissez pour sélectionner.</p><div id="zoomPlot"></div>
      ${zs ? `<div class="scag-bars">${[["pearson", "Pearson r"], ["spearman", "Spearman ρ"], ...MEAS.map(k => [k, SCAG[k].l])].map(([k, l]) => { const v = zs[k] ?? 0, isR = k === "pearson" || k === "spearman"; return `<div><span>${l}</span><i><u style="${isR ? `left:${v < 0 ? 50 + v * 50 : 50}%;width:${Math.abs(v) * 50}%` : `left:0;width:${clamp(v, 0, 1) * 100}%`};background:${isR ? vPos(v) : ramp(v)}"></u></i><b class="mono">${isR ? frs(v) : fr(v)}</b></div>`; }).join("")}</div>` : ""}</div>
    <div class="card"><h3 class="panel-title">Paires les plus remarquables · ${esc(SCAG[meas].l)}</h3><p class="panel-sub">Classement de toutes les paires (${sc.length}) selon la mesure choisie.</p>
      ${top.map((s, k) => `<button type="button" class="pair-row" data-pair="${s.i},${s.j}"><span class="mono">${k + 1}</span><span>${esc(r.vars[s.i])} × ${esc(r.vars[s.j])}</span><i><u style="width:${clamp(s[meas] ?? 0, 0, 1) * 100}%;background:${ramp(s[meas] ?? 0)}"></u></i><b class="mono">${fr(s[meas] ?? 0)}</b></button>`).join("")}</div>
    <div class="card wide"><div class="rowhead"><div><h3 class="panel-title">Matrice de Bertin <span class="beyond">réordonnée</span></h3><p class="panel-sub" style="margin:0">Tout le tableau en une image : une ligne par individu, triées par classe puis par l'arbre de Ward ; colonnes dans l'ordre du cercle des corrélations. Bleu au-dessus de la moyenne, corail en dessous. Glissez verticalement pour sélectionner des lignes.</p></div></div>
      <div class="bertin-wrap"><canvas id="bertin"></canvas><div class="sc-tip" id="bertinTip" hidden></div></div></div></div>`;
}
const MatUI = {
  mount() {
    const r = state.res; if (!hasQ(r) || r.p < 2) return; const M = state.mat, sc = Studio.ensureScag(r), meas = M.meas || "dcor", ord = varOrder(r), vars = ord.slice(0, clamp(M.nv || 8, 3, Math.min(10, r.p))), zoom = M.zoom || [vars[0], vars[1]];
    const cv = $("#splom"); if (cv) this.splom(cv, r, vars, sc, meas, zoom);
    const zp = $("#zoomPlot"); if (zp) { const x = colOf(r, zoom[0]), y = colOf(r, zoom[1]); this._trend = null; this.zoomPlot = new Scatter2D(zp, { pts: x.map((v, i) => [v, y[i]]), colors: itemColors(r), labels: r.names, src: "zoom", ratio: 0.78, axes: false, robust: true, xl: r.vars[zoom[0]], yl: r.vars[zoom[1]],
      after: (g, S) => { const q = (this._trend ??= decileTrend(x, y));
        g.strokeStyle = cssColor("var(--amber)"); g.lineWidth = 2.4; g.beginPath(); q.forEach((p, k) => (k ? g.lineTo(S.X(p[0]), S.Y(p[1])) : g.moveTo(S.X(p[0]), S.Y(p[1])))); g.stroke();
        g.fillStyle = cssColor("var(--muted)"); g.font = "600 11px Instrument Sans, sans-serif"; g.textAlign = "right"; g.fillText(`${S.o.xl} →  ${fmtNum(S.dom[0])} à ${fmtNum(S.dom[1])}`, S.W - 10, S.H - 8); g.textAlign = "left"; g.fillText(`↑ ${S.o.yl}  ${fmtNum(S.dom[2])} à ${fmtNum(S.dom[3])}`, 10, 16); } }); }
    const bc = $("#bertin"); if (bc) this.bertin(bc, r);
    $("#matMeas") && ($("#matMeas").onchange = e => { state.mat.meas = e.target.value; renderPanel(); }); $("#matNv") && ($("#matNv").onchange = e => { state.mat.nv = +e.target.value; renderPanel(); });
  },
  redraw() { if (this.zoomPlot?.c.isConnected) this.zoomPlot.draw(); const cv = $("#splom"); if (cv && this._spl) this.splom(cv, ...this._spl); const bc = $("#bertin"); if (bc && state.res) this.bertin(bc, state.res); },
  splom(cv, r, vars, sc, meas, zoom) {
    this._spl = [r, vars, sc, meas, zoom]; const p = vars.length, W = cv.parentElement.clientWidth, cell = Math.floor(Math.min(120, (W - 110) / p)), L = 110, T = 8, d = Math.min(devicePixelRatio || 1, 2), size = L + cell * p + 4;
    cv.width = size * d; cv.height = (T + cell * p + 4) * d; cv.style.width = size + "px"; cv.style.height = T + cell * p + 4 + "px"; const g = cv.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, size, T + cell * p + 4);
    // colonnes, bornes et histogrammes calcules une fois par analyse ; points : echantillon de 1 500
    if (this._cc?.r !== r) this._cc = { r, col: {}, hist: {} }; const C = this._cc, colC = j => (C.col[j] ??= colOf(r, j)), histC = j => (C.hist[j] ??= histogram(Float64Array.from(colC(j)).sort(), 14));
    const pal = itemColors(r), cols = pal.map(cssColor), sel = state.sel, has = sel.size > 0, idx = sampleIdx(r.n, 1500), ext = vars.map(j => { const v = colC(j); return [minOf(v), maxOf(v)]; });
    // paires affichees encore au stade du pre-tri : analyse complete a la demande
    vars.forEach((a, x) => vars.forEach((b, y) => { if (y <= x) return; const k = sc.findIndex(s => (s.i === Math.min(a, b) && s.j === Math.max(a, b))); if (k >= 0 && sc[k].partial) { const s = scagnostics(colC(Math.min(a, b)), colC(Math.max(a, b))); if (s) sc[k] = { i: Math.min(a, b), j: Math.max(a, b), ...s }; } }));
    const find = (i, j) => sc.find(s => (s.i === i && s.j === j) || (s.i === j && s.j === i));
    g.font = "11px Instrument Sans, sans-serif"; g.textBaseline = "middle";
    vars.forEach((vj, b) => { g.fillStyle = cssColor("var(--muted)"); g.textAlign = "right"; g.fillText(r.vars[vj].length > 16 ? r.vars[vj].slice(0, 15) + "…" : r.vars[vj], L - 8, T + b * cell + cell / 2); });
    vars.forEach((vi, a) => vars.forEach((vj, b) => { const x0 = L + a * cell, y0 = T + b * cell, inner = cell - 6, isZ = (zoom[0] === vi && zoom[1] === vj) || (zoom[0] === vj && zoom[1] === vi);
      g.fillStyle = cssColor("var(--bg-2)"); g.fillRect(x0 + 2, y0 + 2, cell - 4, cell - 4);
      if (a === b) { const H = histC(vi), mx = maxOf(H.bins); H.bins.forEach((c, k) => { g.fillStyle = cssColor("var(--a2)"); g.globalAlpha = 0.8; const bh = (inner - 14) * c / mx; g.fillRect(x0 + 3 + k * inner / H.bins.length, y0 + cell - 4 - bh, inner / H.bins.length - 1, bh); }); g.globalAlpha = 1; g.fillStyle = cssColor("var(--text)"); g.textAlign = "center"; g.font = "600 10px Instrument Sans, sans-serif"; g.fillText(r.vars[vi].slice(0, 13), x0 + cell / 2, y0 + 11); g.font = "11px Instrument Sans, sans-serif"; }
      else if (b > a) { const X = colC(vi), Y = colC(vj); idx.forEach(i => { const on = !has || sel.has(i); g.globalAlpha = on ? 0.75 : 0.08; g.fillStyle = cols[i]; g.fillRect(x0 + 3 + inner * (X[i] - ext[a][0]) / ((ext[a][1] - ext[a][0]) || 1) - 1, y0 + 3 + inner * (1 - (Y[i] - ext[b][0]) / ((ext[b][1] - ext[b][0]) || 1)) - 1, on && has ? 3 : 2, on && has ? 3 : 2); }); g.globalAlpha = 1; }
      else { const s = find(vi, vj), v = s ? s[meas] ?? 0 : 0; g.fillStyle = ramp(v); g.globalAlpha = 0.12 + 0.75 * clamp(v, 0, 1); g.fillRect(x0 + 2, y0 + 2, cell - 4, cell - 4); g.globalAlpha = 1; g.fillStyle = cssColor("var(--text)"); g.textAlign = "center"; g.font = "600 13px JetBrains Mono, monospace"; g.fillText(fr(v), x0 + cell / 2, y0 + cell / 2); g.font = "11px Instrument Sans, sans-serif"; }
      if (isZ && a !== b) { g.strokeStyle = cssColor("var(--amber)"); g.lineWidth = 2; g.strokeRect(x0 + 2, y0 + 2, cell - 4, cell - 4); } }));
    cv.onclick = e => { const rc = cv.getBoundingClientRect(), a = Math.floor((e.clientX - rc.left - L) / cell), b = Math.floor((e.clientY - rc.top - T) / cell); if (a < 0 || b < 0 || a >= p || b >= p || a === b) return; state.mat.zoom = [vars[Math.min(a, b)], vars[Math.max(a, b)]]; renderPanel(); };
  },
  bertin(cv, r) {
    const hc = Studio.ensureHC(r), ord = varOrder(r), N0 = r.n, lr = hc?.leaves ? new Int32Array(N0) : null; if (lr) hc.leaves.forEach((leaf, k) => (lr[leaf] = k));
    const sorted = hc ? range(N0).sort((a, b) => hc.labels[a] - hc.labels[b] || (lr ? lr[a] - lr[b] : r.F[a][0] - r.F[b][0])) : range(N0).sort((a, b) => r.F[a][0] - r.F[b][0]);
    // au-dela de 600 lignes : 600 lignes regulierement espacees dans l'ordre (la structure en blocs reste lisible)
    const rows = sorted.length > 600 ? range(600).map(q => sorted[Math.round(q * (sorted.length - 1) / 599)]) : sorted, n = rows.length;
    const W = cv.parentElement.clientWidth, L = 16, T = 92, rh = clamp(Math.floor(520 / n), 1, 8), cw = Math.floor((W - L - 8) / r.p), Hh = T + rh * n + 4, d = Math.min(devicePixelRatio || 1, 2), sel = state.sel, has = sel.size > 0;
    cv.width = W * d; cv.height = Hh * d; cv.style.width = W + "px"; cv.style.height = Hh + "px"; const g = cv.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, Hh);
    const pos = cssColor("var(--pos)"), neg = cssColor("var(--neg)");
    ord.forEach((j, c) => { g.save(); g.translate(L + c * cw + cw / 2, T - 8); g.rotate(-Math.PI / 4); g.fillStyle = cssColor("var(--muted)"); g.font = "11px Instrument Sans, sans-serif"; g.fillText(r.vars[j].length > 16 ? r.vars[j].slice(0, 15) + "…" : r.vars[j], 0, 0); g.restore(); });
    rows.forEach((i, k) => { const y = T + k * rh; if (hc) { g.fillStyle = cssColor(`var(--g${hc.labels[i] % 10 + 1})`); g.fillRect(2, y, 9, rh); }
      ord.forEach((j, c) => { const z = (r.X[i][j] - r.mu[j]) / r.sdPop[j], a = clamp(Math.abs(z) / 2.5, 0, 1); g.globalAlpha = (has && !sel.has(i) ? 0.18 : 1) * (0.08 + 0.92 * a); g.fillStyle = z >= 0 ? pos : neg; g.fillRect(L + c * cw, y, cw - 1, Math.max(rh - (rh > 3 ? 0.5 : 0), 1)); }); g.globalAlpha = 1; });
    const tip = $("#bertinTip"); let drag = null; const rowAt = y => clamp(Math.floor((y - T) / rh), 0, n - 1);
    cv.onpointermove = e => { const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; if (drag) { drag[1] = rowAt(y); return; } if (y < T) { tip.hidden = true; return; } const k = rowAt(y), c = Math.floor((x - L) / cw); if (c < 0 || c >= r.p) { tip.hidden = true; return; } const i = rows[k], j = ord[c]; tip.textContent = `${r.names[i]} · ${r.vars[j]} = ${fmtNum(r.X[i][j])} (z = ${frs((r.X[i][j] - r.mu[j]) / r.sdPop[j])})`; tip.hidden = false; tip.style.left = Math.min(x + 12, W - 240) + "px"; tip.style.top = y + 12 + "px"; };
    cv.onpointerdown = e => { const rc = cv.getBoundingClientRect(), y = e.clientY - rc.top; if (y < T) return; cv.setPointerCapture(e.pointerId); const k = rowAt(y); drag = [k, k]; };
    cv.onpointerup = () => { if (!drag) return; const [a, b] = [minOf(drag), maxOf(drag)]; drag = null; Sel.set(rows.slice(a, b + 1), "bertin"); };
    cv.onpointerleave = () => (tip.hidden = true);
  },
};
function pBurt(r) {   // ACM : co-occurrences observees / attendues entre modalites, ordonnees selon l'axe 1
  const ord = range(r.M).sort((a, b) => r.G[a][0] - r.G[b][0]), N = r.n, M = r.M, K = r.K, idx = r.vars.map((_, j) => new Map(range(M).filter(a => r.modCol[a] === j).map(a => [r.modName[a], a]))), B = new Float64Array(M * M), code = new Int32Array(K);
  for (const ans of r.answers) { for (let j = 0; j < K; j++) code[j] = idx[j].get(ans[j]); for (let u = 0; u < K; u++) for (let w = 0; w < K; w++) B[code[u] * M + code[w]]++; }   // co-occurrences en une passe
  const co = ord.map(a => ord.map(b => (r.modCol[a] === r.modCol[b] ? null : B[a * M + b] / ((r.eff[a] * r.eff[b] / N) || 1))));
  const labs = ord.map(j => r.mods[j]); return `<div class="card"><h3 class="panel-title">Tableau de Burt réordonné <span class="beyond">Bertin</span></h3><p class="panel-sub">Co-occurrence observée ÷ attendue entre deux modalités, modalités rangées selon l'axe 1 : les blocs bleus révèlent les profils qui vont ensemble.</p><div class="svgbox">${svgHeat(co.map(r0 => r0.map(v => v ?? 1)), labs, labs, PAL_UI, { rot: true, w: 900, cell: v => ({ t: "", f: Math.log2(Math.max(v, 1e-3)) / 1.5 }) })}</div></div>`;
}
function pSeriation(r) {   // AFC : tableau des ecarts a l'independance reordonne (seriation de Bertin)
  const ri = range(r.I).sort((a, b) => r.F[a][0] - r.F[b][0]), cj = range(r.J).sort((a, b) => r.G[a][0] - r.G[b][0]), M = ri.map(i => cj.map(j => r.ratio[i][j]));
  return `<div class="card"><h3 class="panel-title">Tableau réordonné <span class="beyond">Bertin</span></h3><p class="panel-sub">Lignes et colonnes rangées selon leur coordonnée sur l'axe 1 : la diagonale d'attractions (bleu) montre la structure que l'AFC résume.</p><div class="svgbox">${svgHeat(M, ri.map(i => r.rowL[i]), cj.map(j => r.colL[j]), PAL_UI, { rot: true, cell: v => ({ t: (v >= 1 ? "+" : "−") + Math.round(Math.abs(v - 1) * 100) + " %", f: Math.log2(Math.max(v, 1e-3)) / 1.5 }) })}</div></div>`;
}

/* ------------------------------------------------------------------ Profil des donnees */
function roleOf(c) {
  const p = state.params, m = state.method; if (c === p.ident) return "ident";
  if ((p.vars || []).includes(c)) return "active"; if (state.supp.quanti.includes(c) || state.supp.quali.includes(c)) return "illus"; if (p.color === c) return "color"; return "none";
}
function pProfil(r) {
  const t = state.table, ty = state.types, N = t.rows.length, cols = t.columns, cells = N * cols.length, miss = cols.reduce((s, c) => s + (N - colInfo(t.rows, c).nonNull), 0), keyCols = cols.filter(c => c !== ty.ident);
  // doublons : empreinte numerique de 53 bits par ligne (pas de longues chaines en memoire)
  const hv = v => { const t = v === null || v === undefined ? "\u0000" : typeof v === "number" ? String(v) : "s" + v; let a = 0x811c9dc5, b = 0x9747b28c; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 0x5bd1e995); } return [a >>> 0, b >>> 0]; };
  const dup = N - new Set(t.rows.map(x => { let a = 17, b = 31; for (const c of keyCols) { const [u, w] = hv(x[c]); a = Math.imul(a ^ u, 0x01000193) >>> 0; b = Math.imul(b ^ w, 0x85ebca6b) >>> 0; } return a * 2097152 + (b & 0x1fffff); })).size, quality = Math.round(100 - clamp(miss / cells * 300, 0, 40) - clamp(dup / N * 200, 0, 30));
  const m = state.method, info = state.impInfo;
  const cards = cols.map(c => {
    const isQ = ty.quanti.includes(c), raw = t.rows.map(x => x[c]), role = roleOf(c), tr = state.prep.tr[c] || "none"; let viz = "", stats = "", badges = [];
    const missN = raw.filter(v => v === null || v === undefined).length; if (missN) badges.push([`${pc(missN / N * 100, 0)} manquants`, "warn"]);
    if (isQ) { const d = colInfo(t.rows, c).desc; if (d.n) { viz = miniHist(c, 240, 86, t.rows); stats = `<span>moy. <b>${fmtNum(d.mean)}</b></span><span>méd. <b>${fmtNum(d.med)}</b></span><span>σ <b>${fmtNum(d.sd)}</b></span><span>[${fmtNum(d.min)} ; ${fmtNum(d.max)}]</span>`;
      if (Math.abs(d.skew) >= 1) badges.push([`asymétrie ${fr(d.skew, 1)}`, "amber"]); if (d.bc > 0.555 && d.n >= 30 && d.uniq > 5 && Math.abs(d.skew) < 1.2) badges.push(["bimodale ?", "pink"]); if (d.out) badges.push([`${d.out} atypique${d.out > 1 ? "s" : ""}`, "coral"]); if (d.sd === 0) badges.push(["constante", "coral"]); if (d.uniq <= 6) badges.push([`${d.uniq} valeurs`, "faint"]); } }
    else { const f = {}; raw.forEach(v => { if (v !== null && v !== undefined) f[v] = (f[v] || 0) + 1; }); const top = Object.entries(f).sort((a, b) => b[1] - a[1]), k = top.length; stats = `<span><b>${k}</b> modalités</span>${c === ty.ident ? "<span>identifiant</span>" : ""}`;
      if (c !== ty.ident) viz = miniBars(top.slice(0, 8).map(([l, v], i) => ({ l: String(l).slice(0, 8), v, c: `var(--g${i % 10 + 1})` })), 240, 86); if (k > 15 && c !== ty.ident) badges.push(["beaucoup de modalités", "amber"]); if (c !== ty.ident && top.some(([, v]) => v / N < 0.05)) badges.push(["modalités rares", "faint"]); }
    const roles = c === ty.ident ? [["ident", "Identifiant"]] : m === "AFC" ? [[role, "—"]] : isQ ? (m === "ACP" || m === "AFDM" ? [["active", "Active"], ["illus", "Illustrative"], ["none", "Ignorée"]] : [["illus", "Illustrative"], ["none", "Ignorée"]]) : m === "AFDM" ? [["active", "Active"], ["color", "Couleur des points"], ["illus", "Illustrative"], ["none", "Ignorée"]] : (m === "ACM" ? [["active", "Active"], ["illus", "Illustrative"], ["none", "Ignorée"]] : [["color", "Couleur des points"], ["illus", "Illustrative"], ["none", "Ignorée"]]);
    return `<div class="card prof-card role-${role}"><header><div><b title="${esc(c)}">${esc(c)}</b><span class="ty ${isQ ? "q" : "l"}">${isQ ? "quantitative" : "qualitative"}</span></div>
      <select data-role="${esc(c)}" ${roles.length < 2 ? "disabled" : ""} aria-label="Rôle de ${esc(c)}">${roles.map(([v, l]) => `<option value="${v}" ${v === role ? "selected" : ""}>${l}</option>`).join("")}</select></header>
      <div class="prof-viz">${viz}</div><div class="prof-stats">${stats}</div><div class="prof-badges">${badges.map(([l, k]) => `<span class="bdg ${k}">${esc(l)}</span>`).join("")}</div>
      ${isQ && (m === "ACP" || m === "AFDM") ? `<label class="prof-tr">Transformation <select data-tr="${esc(c)}">${Object.entries(TRANSFORMS).map(([k, T]) => `<option value="${k}" ${k === tr ? "selected" : ""}>${T.l}</option>`).join("")}</select></label>` : ""}</div>`;
  }).join("");
  return `<div class="grid2"><div class="card wide prof-head"><div class="qual"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="none" style="stroke:var(--line-2)" stroke-width="7"/><circle cx="40" cy="40" r="32" fill="none" style="stroke:${quality >= 85 ? "var(--ok)" : quality >= 65 ? "var(--amber)" : "var(--a1)"}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 32 * quality / 100).toFixed(1)} 400" transform="rotate(-90 40 40)"/><text x="40" y="46" text-anchor="middle" font-size="20" font-weight="600" style="fill:var(--text)">${quality}</text></svg><span>qualité</span></div>
      <div class="prof-sum"><h3 class="panel-title">Profil des données</h3><p class="panel-sub" style="margin:0">${esc(state.source)} · <b>${N}</b> lignes × <b>${cols.length}</b> colonnes · ${ty.quanti.length} quantitatives, ${ty.quali.length} qualitatives · ${pc(miss / cells * 100, 1)} de cases vides · ${dup} doublon${dup > 1 ? "s" : ""}.
        Définissez ici le rôle de chaque colonne : <b>active</b> (construit les axes), <b>illustrative</b> (projetée après coup, sans influencer), <b>ignorée</b>.</p></div>
      <div class="prof-miss"><label>Valeurs manquantes <select id="missSel">${(m === "ACM" ? [["drop", "Exclure les lignes"], ["modal", "Modalité « Manquant »"]] : [["drop", "Exclure les lignes"], ["mean", "Imputer par la moyenne"], ["pca", "Imputer par ACP itérative"]]).map(([v, l]) => `<option value="${v}" ${state.prep.missing === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <small>${info ? `${info.miss} valeurs imputées (${esc(info.method)}${info.iter ? `, ${info.iter} itérations` : ""})` : r.removed ? `${pl(r.removed, "ligne exclue", "lignes exclues")} de l'analyse` : "Aucune valeur manquante dans les variables actives"}</small></div></div>
    <div class="prof-grid wide">${cards}</div></div>`;
}
function bindStudio() {
  const p = $("#panel");
  p.addEventListener("click", e => {
    const f = e.target.closest("[data-insf]"); if (f) { state.insFilter = f.dataset.insf; renderPanel(); return; }
    const ia = e.target.closest("[data-insact]"); if (ia) { insightAction(ia); return; }
    const pr = e.target.closest("[data-proj]"); if (pr) { const a = pr.dataset.proj; if (a === "3d") ProjUI.show3d(pr.dataset.k); if (a === "trust") { state.trustFrom = pr.dataset.k; setEnc("color", "trust"); } if (a === "recompute") { const E = state.emb; E.perp = +$("#perpIn").value; E.nn = +$("#nnIn").value; delete E.tsne; delete E.umap; delete E.tsne3; delete E.umap3; renderPanel(); } return; }
    const hc = e.target.closest("[data-hcact]"); if (hc) { if (hc.dataset.hcact === "color") setEnc("color", "hcpc"); if (hc.dataset.hcact === "tree") { if (state.enc.color !== "hcpc") setEnc("color", "hcpc"); $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); Stage.showTree(state.hc); } return; }
    const cl = e.target.closest("[data-cls]"); if (cl) { const j = +cl.dataset.cls, hcR = state.hc; Sel.set(range(hcR.n).filter(i => hcR.labels[i] === j), "classes"); explainSelection(); return; }
    const ty = e.target.closest("[data-typ]"); if (ty) { Stage.selectRef(mainKindOf(state.res), +ty.dataset.typ); $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); return; }
    const pairB = e.target.closest("[data-pair]"); if (pairB) { state.mat.zoom = pairB.dataset.pair.split(",").map(Number); renderPanel(); return; }
  });
  p.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "hcK" || t.id === "hcD" || t.id === "hcC") { state.hcOpts = { k: $("#hcK").value ? +$("#hcK").value : null, dims: $("#hcD").value ? +$("#hcD").value : null, consol: $("#hcC").checked }; state.hc = null; if (state.colorMode === "hcpc") { Studio.ensureHC(); Stage.build(state.res, "morph"); } renderPanel(); return; }
    if (t.id === "missSel") { state.prep.missing = t.value; run("morph"); return; }
    if (t.dataset.tr) { state.prep.tr[t.dataset.tr] = t.value; run("morph"); return; }
    if (t.dataset.role) setRole(t.dataset.role, t.value);
  });
}
function setRole(c, role) {
  const p = state.params, s = state.supp, drop = a => a.filter(x => x !== c);
  p.vars = drop(p.vars || []); s.quanti = drop(s.quanti); s.quali = drop(s.quali); if (p.color === c) p.color = null;
  const isQ = state.types.quanti.includes(c);
  if (role === "active") p.vars = [...p.vars, c].sort((a, b) => state.table.columns.indexOf(a) - state.table.columns.indexOf(b));
  if (role === "illus") (isQ ? s.quanti : s.quali).push(c);
  if (role === "color") p.color = c;
  renderRail(); run("morph");
}

function showAbout() { $("#about").hidden = false; $("#about .ab-x").focus(); }
