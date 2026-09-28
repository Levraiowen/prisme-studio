
/* ============================================================================
   API d'integration : Prisme Studio pilote par une autre application.
   1. JavaScript (meme page)  : window.PrismeStudio.loadCSV(texte), .loadRows(objets), .loadURL(url), .results(), .on("result", f)
   2. postMessage (iframe)    : { type: "prisme:load", csv | rows | url, name?, method? }, { type: "prisme:results" }, { type: "prisme:select", indices }
                                reponses : { type: "prisme:ready" | "prisme:result" | "prisme:selection" | "prisme:results" | "prisme:error" }
   3. Parametres d'URL        : ?data=<url>&method=ACP|ACM|AFC&tab=insights&theme=dark|light
   Aucune donnee n'est envoyee ailleurs que vers la fenetre parente, et seulement a sa demande.
   ============================================================================ */
function resultsJSON(r = state.res, maxAxes = 5) {
  if (!r) return null; const S = Math.min(r.q, maxAxes), round = x => Math.round(x * 1e6) / 1e6, rows = M => M.map(v => v.slice(0, S).map(round));
  const out = { format: "prisme-studio-results", version: PRISME_VERSION, generated: new Date().toISOString(), source: state.source, method: r.method,
    eigenvalues: r.vals.map(round), inertiaPct: r.pct.map(round), cumulativePct: r.cum.map(round), retainedAxes: r.nAxes, rules: { kaiserOrThreshold: r.rule, elbow: r.coude } };
  if (r.method === "ACP") Object.assign(out, { n: r.n, variables: r.vars.map((v, j) => ({ name: v, mean: round(r.mu[j]), sd: round(r.sd[j]), coord: r.coord[j].slice(0, S).map(round), cos2: r.vcos2[j].slice(0, S).map(round), contrib: r.vctr[j].slice(0, S).map(round) })),
    individuals: { names: r.names, coord: rows(r.F), cos2: rows(r.cos2), contrib: rows(r.ctr) }, correlation: r.R.map(v => v.map(round)) });
  if (r.method === "ACM") Object.assign(out, { n: r.n, categories: r.mods.map((m, j) => ({ name: m, count: r.eff[j], coord: r.G[j].slice(0, S).map(round), contrib: r.mctr[j].slice(0, S).map(round), cos2: r.mcos2[j].slice(0, S).map(round) })),
    eta2: r.vars.map((v, j) => ({ variable: v, eta2: r.eta2[j].slice(0, S).map(round) })), individuals: { names: r.names, coord: rows(r.F) } });
  if (r.method === "AFC") Object.assign(out, { chi2: round(r.chi2), df: r.ddl, pValue: r.pval, rows: r.rowL.map((l, i) => ({ name: l, coord: r.F[i].slice(0, S).map(round), contrib: r.rctr[i].slice(0, S).map(round) })), columns: r.colL.map((l, j) => ({ name: l, coord: r.G[j].slice(0, S).map(round), contrib: r.cctr[j].slice(0, S).map(round) })) });
  if (state.hc && state.hc.res === r) out.clusters = { k: state.hc.k, r2: round(state.hc.R2), labels: state.hc.labels, sizes: state.hc.sizes };
  if (state.insights && state.insights.res === r) out.insights = state.insights.list.map(o => ({ kind: o.kind, score: round(o.score), title: o.title, text: o.text }));
  if (state.impInfo) out.imputation = state.impInfo; if (r.removed) out.excludedRows = r.removed;
  return out;
}
const PrismeAPI = {
  version: () => PRISME_VERSION, handlers: {},
  on(ev, f) { (this.handlers[ev] ||= []).push(f); return () => (this.handlers[ev] = this.handlers[ev].filter(g => g !== f)); },
  // les evenements ne sont transmis a la page parente qu'apres qu'elle s'est adressee a Prisme (son origine est alors connue)
  emit(ev, data) { (this.handlers[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); if (embedded() && parentOrigin) window.parent.postMessage({ type: "prisme:" + ev, data }, parentOrigin); },
  summary() { const r = state.res; return r ? { method: r.method, n: mainN(r), axes: r.nAxes, inertiaPct: r.cum[r.nAxes - 1], source: state.source, error: state.error } : { error: state.error }; },
  loadTable(t, name, method) { loadTable(t, name, null); if (method && method !== state.method) setMethod(method); return this.summary(); },
  loadCSV(text, name = "donnees.csv", method) { return this.loadTable(parseCSV(text, name), name, method); },
  loadRows(rows, name = "donnees", method) { return this.loadTable(tableFromObjects(rows, name), name, method); },
  async loadURL(url, method) { const t = await readURL(url); return this.loadTable(t, t.name, method); },
  setMethod(m) { setMethod(m); return this.summary(); },
  select(indices) { Sel.set(indices, "api"); },
  // grands volumes : File, URL ou texte CSV ; resout avec le resume (lignes, axes, inertie)
  async openBig(src) { await BigUI.open(typeof src === "string" ? { url: src, force: true } : typeof Blob !== "undefined" && src instanceof Blob ? { file: src, name: src.name || "donnees.csv", force: true } : { ...src, force: true });
    return BigUI.s ? { mode: "grands volumes", n: BigUI.s.n, axes: BigUI.acp?.nAxes, inertiaPct: BigUI.acp ? BigUI.acp.cum[BigUI.acp.nAxes - 1] : null, source: BigUI.name } : { error: "lecture impossible" }; },
  bigResults: () => (BigUI.s && BigUI.acp ? BigUI.resultsJSON() : null),
  results: resultsJSON,
};
window.PrismeStudio = PrismeAPI;
const embedded = () => window.parent && window.parent !== window;
let parentOrigin = null;   // origine de la page parente, connue a son premier message
function bindAPI() {
  document.addEventListener("prisme:sel", () => PrismeAPI.emit("selection", { count: state.sel.size, indices: state.sel.size <= 5000 ? [...state.sel] : null }));
  window.addEventListener("message", async e => {
    if (!embedded() || e.source !== window.parent || !e.data || typeof e.data.type !== "string" || !e.data.type.startsWith("prisme:")) return;
    // une page ouverte en file:// a l'origine "null" : la reponse ne peut alors etre adressee qu'a "*"
    parentOrigin = e.origin && e.origin !== "null" ? e.origin : "*"; const d = e.data, reply = (type, data) => window.parent.postMessage({ type, data }, parentOrigin);
    try {
      if (d.type === "prisme:load" && d.big) { reply("prisme:loaded", await PrismeAPI.openBig(d.url ? d.url : { text: d.csv, name: d.name || "donnees.csv" })); return; }
      if (d.type === "prisme:load") { const s = d.url ? await PrismeAPI.loadURL(d.url, d.method) : d.rows ? PrismeAPI.loadRows(d.rows, d.name, d.method) : PrismeAPI.loadCSV(d.csv, d.name, d.method); reply("prisme:loaded", s); }
      if (d.type === "prisme:results") reply("prisme:results", BigUI.open_ ? PrismeAPI.bigResults() : resultsJSON());
      if (d.type === "prisme:select") PrismeAPI.select(d.indices || []);
      if (d.type === "prisme:method") reply("prisme:loaded", PrismeAPI.setMethod(d.method));
    } catch (err) { reply("prisme:error", { message: err.message }); }
  });
  if (embedded()) window.parent.postMessage({ type: "prisme:ready", data: { version: PRISME_VERSION } }, "*");
}
// parametres d'URL : ?data=...&method=...&tab=...&theme=...
async function startFromURL() {
  const u = new URLSearchParams(location.search), th = u.get("theme"), tab = u.get("tab");
  if (th === "dark" || th === "light") document.documentElement.dataset.theme = th;
  if (tab) state.tab = tab;
  if (u.get("data") && (u.get("mode") === "big" || await isBigURL(new URL(u.get("data"), location.href).href))) return { big: u.get("data") };   // grands volumes : ouvert apres le demarrage du Studio
  if (u.get("data")) { try { setBusy("chargement des données"); await PrismeAPI.loadURL(u.get("data"), u.get("method") || undefined); setBusy(null); return true; } catch (e) { setBusy(null); toast(e.message); } }
  return false;
}
