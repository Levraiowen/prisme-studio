
/* ============================================================================
   Vue « Grands volumes » : tableau de bord d'un fichier de plusieurs millions de
   lignes. Les donnees restent dans un Web Worker (colonnes typees) ; la page ne
   recoit que des agregats : images de densite, histogrammes, resumes.
   ============================================================================ */
const BIG_THRESHOLD = 40 * 1048576;   // au-dela, un CSV s'ouvre en mode grands volumes
// formats lus en grands volumes et taille a partir de laquelle ils s'y ouvrent d'office (Parquet et Excel sont compresses)
const bigKind = name => (/\.(csv|tsv|txt|dat)(\?|#|$)/i.test(name) ? "csv" : /\.parquet(\?|#|$)/i.test(name) ? "parquet" : /\.(xlsx|xlsm|xls)(\?|#|$)/i.test(name) ? "xlsx" : null);
const BIG_LIMIT = { csv: BIG_THRESHOLD, parquet: BIG_THRESHOLD, xlsx: 25 * 1048576 };
// nombre de lignes d'un Parquet lu dans son pied de page (quelques Ko), sans lire les donnees
async function parquetRows(f) { try { const pq = await loadParquet(), md = await pq.parquetMetadataAsync({ byteLength: f.size, slice: (s, e) => f.slice(s, e).arrayBuffer() }); return Number(md.num_rows); } catch (e) { return 0; } }
// un fichier local ou distant s'ouvre en grands volumes au-dela de ces tailles, ou si un Parquet depasse 400 000 lignes
async function isBigFile(f) { const k = bigKind(f.name); return !!k && (f.size > BIG_LIMIT[k] || (k === "parquet" && (await parquetRows(f)) > 400000)); }
async function isBigURL(u) { const k = bigKind(u); if (!k) return false; try { const r = await fetch(u, { method: "HEAD", credentials: "omit" }); return +(r.headers.get("content-length") || 0) > BIG_LIMIT[k]; } catch (e) { return false; } }
const BIG_MAIN = `self.onmessage = e => bigHandle(e.data, (m, tr) => self.postMessage(m, tr || []));`;
const hexRGB = h => { h = String(h || "#888").trim(); if (h.startsWith("rgb")) return (h.match(/[\d.]+/g) || [128, 128, 128]).slice(0, 3).map(Number); const x = h.replace("#", ""), f = x.length === 3 ? x.split("").map(c => c + c).join("") : x; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) || 0); };
const fmtInt = n => Math.round(n).toLocaleString("fr-FR");
const fmtBig = n => (n >= 1e6 ? fr(n / 1e6, n >= 1e7 ? 1 : 2) + " M" : fmtInt(n));
const fmtBytes = b => { const [G, M, K] = NUMFMT.dec === "." ? ["GB", "MB", "kB"] : ["Go", "Mo", "Ko"]; return b >= 1073741824 ? fr(b / 1073741824, 2) + " " + G : b >= 1048576 ? fr(b / 1048576, 0) + " " + M : fr(b / 1024, 0) + " " + K; };
const fmtMs = ms => (ms >= 1000 ? fr(ms / 1000, 1) + " s" : fr(ms, 0) + " ms");

const BigUI = {
  w: null, seq: 0, pend: new Map(), s: null, acp: null, bres: null, sel: null, filters: [], plane: [0, 1], color: { mode: "count" }, how: "eq", box: null, tab: "sel", cls: null, outl: null,
  arrows: true, name: "", size: 0, times: {}, drawSeq: 0, dens: null, sampleN: 50000, open_: false,
  brush: "rect", view: "map", hist: [], fut: [], src: null, types: {}, pendTypes: {},
  /* ---------- moteur : Web Worker, ou fil principal si les workers sont interdits */
  engine(local = false) {
    if (this.w) return this.w;
    try { if (local) throw 0; if (typeof CORE_SRC === "undefined") throw 0; const w = new Worker(URL.createObjectURL(new Blob([WORKER_HEAD, CORE_SRC, BIG_MAIN], { type: "text/javascript" })));
      w.onmessage = e => this.onMsg(e.data); w.onerror = e => { e.preventDefault?.(); this.pend.forEach(p => p.rej(new Error("Le moteur de calcul s'est arrêté (mémoire insuffisante ?)."))); this.pend.clear(); this.w = null; };
      this.w = { post: (m, tr) => w.postMessage(m, tr || []), kill: () => w.terminate(), local: false };
    } catch (e) { this.w = { post: m => bigHandle({ ...m, a: { ...m.a, yieldEach: true } }, r => this.onMsg(r)), kill: () => {}, local: true }; }
    return this.w;
  },
  call(cmd, a, onEvt) { const id = ++this.seq, w = this.engine(); return new Promise((res, rej) => { this.pend.set(id, { res, rej, onEvt }); w.post({ id, cmd, a }); }); },
  onMsg(m) { const p = this.pend.get(m.id); if (!p) return; if (m.type) { p.onEvt?.(m); return; } this.pend.delete(m.id); m.ok ? p.res(m.out) : p.rej(new Error(m.err)); },
  kill() { if (this.w) this.w.kill(); this.w = null; this.pend.forEach(p => p.rej(new Error("annulé"))); this.pend.clear(); },
  /* ---------- entree / sortie du mode */
  show(on) { this.open_ = on; document.body.classList.toggle("bigmode", on); $("#big").hidden = !on; Hist.ui();
    if (on) { $("#dsName").textContent = this.name; $("#dsDim").innerHTML = this.s ? `· ${fmtInt(this.s.n)} × ${this.s.num.length + this.s.cat.length} <span class="tag">grands volumes</span>` : "· lecture en cours"; } const bb = $("#bigBack"); if (bb) { bb.hidden = on || !this.s; if (this.s) bb.querySelector("b").textContent = fmtBig(this.s.n) + " lignes"; } },
  exit() { this.show(false); Relief.dispose(); if (state.res) renderHeader(); },
  async open(src) {
    const nm = src.name || src.file?.name || src.url || "", kind = src.kind || bigKind(nm) || (src.text || src.force ? "csv" : null);
    if (!kind) throw new Error("Le mode grands volumes lit les fichiers CSV, TSV, TXT, Parquet et Excel.");
    this.kill(); Relief.dispose(); Object.assign(this, { s: null, acp: null, sel: null, filters: [], plane: [0, 1], color: { mode: "count" }, how: "eq", box: null, tab: "sel", cls: null, outl: null, dens: null, times: {}, hist: [], fut: [], view: "map", pendTypes: {} });
    this.src = { ...src, kind }; this.types = src.types || {};
    this.name = src.name || src.file?.name || decodeURIComponent(new URL(src.url, location.href).pathname.split("/").pop() || "donnees.csv"); this.size = src.file ? src.file.size : 0;
    this.show(true); this.renderIngest(); const t0 = performance.now();
    try {
      // URL absolue : un worker cree depuis un blob ne sait pas resoudre une adresse relative
      const args = { file: src.file, url: src.url ? new URL(src.url, location.href).href : undefined, text: src.text, delim: src.delim, name: this.name, kind, types: this.types };
      const onEvt = m => { if (m.type === "meta") this.renderTypes(m.meta); if (m.type === "progress") this.progress(m.p); if (m.type === "phase") { const el = $("#bgEta"); if (el) el.textContent = m.text; } };
      let out;
      try { out = await this.call("open", args, onEvt); }
      catch (e) {
        // lecteur Parquet ou Excel indisponible dans le fil de calcul (navigateur ancien, version hors ligne) : lecture dans la page
        if (!/lecteur (Parquet|Excel)/.test(e.message) || this.w?.local) throw e;
        this.kill(); this.renderIngest();
        if (kind === "xlsx") { setBusy("lecture du classeur Excel"); try { const buf = src.file ? await src.file.arrayBuffer() : await (await fetch(args.url, { credentials: "omit" })).arrayBuffer(); args.text = await xlsxToCSV(buf); args.delim = ","; args.file = undefined; args.url = undefined; } finally { setBusy(null); } }
        else this.engine(true);
        out = await this.call("open", args, onEvt);
      }
      this.s = out.summary; this.size = this.size || this.s.bytes; this.times.parse = performance.now() - t0;
      this.progress({ bytes: this.s.bytes, total: this.s.bytes, rows: this.s.n, ms: this.times.parse }, true);
      await this.runPCA(); this.renderDash(); this.show(true); PrismeAPI.emit("result", { method: "ACP", mode: "grands volumes", n: this.s.n, axes: this.acp.nAxes, inertiaPct: this.acp.cum[this.acp.nAxes - 1], source: this.name });
      this.computeClasses(); if (Share.pending?.b) Share.applyBig();
    } catch (e) { if (e.message !== "annulé") this.fail(e.message); }
  },
  fail(msg) { $("#big").innerHTML = `<div class="card bg-ingest"><div class="eyebrow">Mode grands volumes</div><h2>${esc(this.name)}</h2><div class="err">${esc(msg)}</div><div class="bg-row"><button class="btn sm" type="button" data-bg="leave">Revenir au Studio</button>${Object.keys(this.types).length ? `<button class="btn sm" type="button" data-bg="untype">Relire avec les types automatiques</button>` : ""}</div></div>`; },
  async runPCA(vars = null, nAxes = null) {
    const t0 = performance.now(), a = await this.call("pca", { vars, nAxes }); this.times.pca = performance.now() - t0; this.acp = a;
    this.bres = { method: "ACP", vars: a.vars, coord: a.coord, vcos2: a.coord.map(r => r.map(c => c * c)), vals: a.vals, pct: a.pct, cum: a.cum, nAxes: a.nAxes, q: a.q, threshold: 1, thresholdLabel: "Kaiser · λ = 1", p: a.vars.length };
    this.box = null; this.filters = []; this.hist = []; this.fut = []; this.sel = null; this.cls = null; this.outl = null; if (this.color.mode === "class") this.color = { mode: "count" }; if (this.plane[1] >= a.q) this.plane = [0, 1];
  },
  async computeClasses(k = null) {
    const t0 = performance.now(); this.cls = { pending: true }; this.renderSide();
    try { this.cls = await this.call("classes", { k }); this.cls.ms = performance.now() - t0; } catch (e) { this.cls = { err: e.message }; }
    this.renderSide(); this.renderToolbar();
  },
  /* ---------- lecture : compteur en direct */
  renderIngest() {
    $("#big").innerHTML = `<div class="card bg-ingest"><div class="eyebrow"><span class="live"></span>Mode grands volumes · lecture en flux</div><h2>${esc(this.name)}</h2>
      <div class="bg-count"><b class="mono" id="bgRows">0</b><span>lignes lues</span></div><div class="bg-bar"><i id="bgBar"></i></div>
      <div class="bg-stats mono"><span id="bgBytes">${this.size ? "0 / " + fmtBytes(this.size) : "—"}</span><span id="bgRate">— Mo/s</span><span id="bgEta">—</span></div>
      <div class="bg-types" id="bgTypes"><span class="muted">Détection des colonnes…</span></div>
      <p class="hint">${this.src?.kind === "parquet" ? "Le fichier Parquet est lu groupe de lignes par groupe de lignes" : this.src?.kind === "xlsx" ? "Le classeur est décompressé puis lu" : "Le fichier est lu par morceaux de 8 Mo"} dans un fil de calcul séparé et rangé en colonnes compactes (nombres sur 4 octets, modalités sur 2). Aucune donnée ne quitte votre poste.</p>
      <div class="bg-row"><button class="btn sm" type="button" data-bg="cancel">Annuler</button></div></div>`;
  },
  renderTypes(meta) { const box = $("#bgTypes"); if (!box) return; const lab = { num: "nombre", cat: "modalités", skip: "ignorée" };
    box.innerHTML = `<div class="mono muted" style="font-size:11.5px;margin-bottom:8px">${meta.format === "Parquet" ? "Parquet · types lus sur les premières lignes" : `${meta.format === "Excel" ? "Excel (première feuille) · " : ""}séparateur « ${meta.delim === "\t" ? "tab" : esc(meta.delim)} » · décimale « ${esc(meta.decimal)} » · ${esc(meta.encoding || "utf-8")}`}</div>` + meta.cols.map(c => `<span class="bgt ${c.role}" title="${esc(lab[c.role])}${c.why ? " : " + esc(c.why) : ""}"><i></i>${esc(c.name)}</span>`).join(""); },
  progress(p, final = false) {
    const el = $("#bgRows"); if (!el) return; const tot = p.total || this.size, f = tot ? Math.min(1, p.bytes / tot) : 0, rate = p.bytes / 1048576 / Math.max(p.ms / 1000, 1e-3);
    el.textContent = fmtInt(p.rows); $("#bgBar").style.width = (final ? 100 : f * 100).toFixed(1) + "%"; $("#bgBytes").textContent = `${fmtBytes(p.bytes)}${tot ? " / " + fmtBytes(tot) : ""}`;
    $("#bgRate").textContent = `${fr(rate, 0)} Mo/s`; $("#bgEta").textContent = final ? "ACP exacte en cours…" : tot && f > 0.02 ? `reste ≈ ${fmtMs((1 - f) / f * p.ms)}` : "—";
  },
  /* ---------- tableau de bord */
  renderDash() {
    const s = this.s, a = this.acp, ign = s.cols.filter(c => c.role === "skip");
    $("#big").innerHTML = `
      <div class="bg-head card">
        <div class="bg-title"><div class="eyebrow"><span class="live"></span>Mode grands volumes · ${fmtInt(s.n)} lignes · calculs exacts sur toutes les lignes</div><h2>${esc(this.name)}</h2></div>
        <div class="bg-actions"><label class="bg-sn">Échantillon <select id="bgSampleN">${[20000, 50000, 100000, 200000].map(v => `<option value="${v}" ${v === this.sampleN ? "selected" : ""}>${fmtInt(v)}</option>`).join("")}</select></label>
          <button class="btn prime sm" type="button" data-bg="studio" title="Tirage aléatoire uniforme, ouvert dans le Studio complet : 3D, HCPC, t-SNE, insights…">Explorer dans le Studio</button>
          <button class="btn sm" type="button" data-bg="json">Résultats (JSON)</button><button class="btn sm" type="button" data-bg="png">Carte (PNG)</button></div>
      </div>
      <div class="bg-kpis">
        ${[["Lignes", fmtBig(s.n), `lues en ${fmtMs(this.times.parse)} · ${fr(s.bytes / 1048576 / (this.times.parse / 1000), 0)} ${NUMFMT.dec === "." ? "MB" : "Mo"}/s`],
           ["Colonnes", `${s.num.length} + ${s.cat.length}`, `nombres + qualitatives${ign.length ? ` · ${ign.length} ignorée${ign.length > 1 ? "s" : ""}` : ""}`],
           ["ACP exacte", pc(a.cum[a.nAxes - 1]), `${pl(a.nAxes, "axe")} · ${fmtInt(a.N)} lignes complètes · ${fmtMs(this.times.pca)}`],
           ["Atypiques", pc(a.nAny / a.N * 100), `au-delà des limites T² ou Q à 95 %`],
           ["Mémoire", fmtBytes(s.mem), `colonnes Float32 et Uint16 · fichier ${fmtBytes(s.bytes)}`]].map(([l, v, sub], i) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub}</div>${i === 2 ? `<div class="spec">${a.pct.slice(0, 8).map((p, k) => `<i style="width:${p}%;background:${k < 3 ? `var(--a${k + 1})` : "var(--line-2)"};opacity:${k < a.nAxes ? 1 : .5}"></i>`).join("")}</div>` : ""}</div>`).join("")}
      </div>
      <div class="bg-main">
        <section class="card bg-mapcard"><div class="bg-tools" id="bgTools"></div>
          <div class="bg-map frame" id="bgMap"><canvas id="bgCanvas" width="16" height="16"></canvas><svg id="bgOver" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg><div class="bg-tip" id="bgTip" hidden></div><div class="bg-relief" id="bgRelief" hidden></div></div>
          <div class="bg-foot"><span class="mono" id="bgFoot"></span><span id="bgLegend"></span></div></section>
        <section class="card bg-side"><nav class="bg-tabs" id="bgTabs">${[["sel", "Sélection"], ["axes", "Axes"], ["cls", "Classes"], ["out", "Atypiques"]].map(([k, l]) => `<button type="button" data-bgt="${k}" aria-selected="${this.tab === k}">${l}</button>`).join("")}</nav><div id="bgSide"></div></section>
      </div>
      <section class="card"><div class="rowhead"><div><h3 class="panel-title">Variables · filtrage croisé</h3><p class="panel-sub" style="margin:0">Glissez sur un histogramme pour filtrer un intervalle, cliquez une modalité. Toutes les vues se recalculent sur les ${fmtInt(a.N)} lignes. Histogrammes normalisés : on compare les formes.</p></div><div id="bgFilters" class="bg-filters"></div></div>
        <div class="bg-vars" id="bgVars"></div></section>
      ${this.typesCard()}
      <section class="card"><h3 class="panel-title">Corrélations exactes</h3><p class="panel-sub">Calculées sur les ${fmtInt(a.N)} lignes complètes, variables ordonnées par leur angle sur le plan 1·2.</p><div class="svgbox scroll">${this.heat()}</div></section>`;
    this.renderToolbar(); this.renderSide(); this.renderVars(); this.renderFilters(); this.bindMap(); this.draw();
  },
  // types des colonnes : la detection automatique peut se tromper (codes numeriques, identifiants, textes)
  typesCard() {
    const s = this.s, man = s.cols.filter(c => c.auto).length, L = { num: "Nombre", cat: "Modalités", skip: "Ignorée" };
    return `<details class="card bg-typecard" id="bgTypeCard"${man ? " open" : ""}><summary><h3 class="panel-title">Types des colonnes</h3><span class="muted">${man ? `${pl(man, "colonne")} de type choisi à la main` : "détection automatique, à corriger si elle se trompe"}</span></summary>
      <p class="panel-sub">Nombre : entre dans l'ACP, les histogrammes et les filtres par intervalle. Modalités : filtres et couleurs (1 000 modalités au plus). Ignorée : identifiants, textes libres. Changer un type relit le fichier.</p>
      <div class="bg-tylist">${s.cols.map(c => { const cur = this.pendTypes[c.name] ?? c.role, auto = c.auto ?? c.role;
        return `<label class="bg-ty${c.auto ? " man" : ""}"><span class="bg-tyn" title="${esc(c.name)}">${esc(c.name)}</span><select data-bgty="${esc(c.name)}">${["num", "cat", "skip"].map(v => `<option value="${v}" ${cur === v ? "selected" : ""}>${L[v]}${auto === v ? " · auto" : ""}</option>`).join("")}</select>${c.why ? `<small class="muted">${esc(c.why)}</small>` : ""}</label>`; }).join("")}</div>
      <div class="bg-row"><button class="btn sm prime" type="button" data-bg="retype" ${Object.keys(this.pendTypes).length ? "" : "disabled"}>Relire avec ces types</button>${man ? `<button class="btn sm" type="button" data-bg="untype">Revenir à la détection automatique</button>` : ""}</div></details>`;
  },
  retype(reset = false) {
    const types = {}; if (!reset) for (const c of this.s.cols) { const v = this.pendTypes[c.name] ?? c.role, auto = c.auto ?? c.role; if (v !== auto) types[c.name] = v; }
    this.open({ ...this.src, types }).catch(e => toast(e.message));
  },
  heat() { const a = this.acp, b = this.bres, ord = range(b.p).sort((x, y) => Math.atan2(b.coord[x][1] || 0, b.coord[x][0]) - Math.atan2(b.coord[y][1] || 0, b.coord[y][0])), R = ord.map(i => ord.map(j => a.R[i][j]));
    return svgHeat(R, ord.map(i => a.vars[i]), ord.map(i => a.vars[i]), PAL_UI, { tri: true, rot: true, w: Math.max(560, 46 * b.p + 160), cell: (v, i, j) => ({ t: i === j ? "1" : b.p > 24 ? "" : frs(v), f: i === j ? .35 : v }) }); },
  colorOptions() { const s = this.s; return [["count", "Densité"], ["t2", "Atypicité (T²)"], ...(this.cls && this.cls.k ? [["class", "Classes"]] : []), ...s.cat.map(c => [`cat:${c.name}`, `Modalités · ${c.name}`]), ...s.num.map(c => [`num:${c.name}`, `Moyenne · ${c.name}`])]; },
  renderToolbar() {
    const el = $("#bgTools"); if (!el) return; const a = this.acp, cur = this.color.mode === "cat" || this.color.mode === "num" ? `${this.color.mode}:${this.color.col}` : this.color.mode;
    const planes = [[0, 1], [0, 2], [1, 2]].filter(([x, y]) => y < Math.min(3, a.q));
    el.innerHTML = `<div class="planpick">${planes.map(([x, y]) => `<button type="button" data-bgp="${x}${y}" aria-pressed="${this.plane[0] === x && this.plane[1] === y}">Plan ${x + 1}·${y + 1}</button>`).join("")}</div>
      <label class="bg-sel">Couleur <select id="bgColor">${this.colorOptions().map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <div class="planpick" title="Intensité : égalisation d'histogramme (Datashader), logarithme ou linéaire">${[["eq", "Égalisée"], ["log", "Log"], ["lin", "Linéaire"]].map(([k, l]) => `<button type="button" data-bgh="${k}" aria-pressed="${this.how === k}">${l}</button>`).join("")}</div>
      <div class="planpick" title="Carte de densité ou relief 3D (hauteur = nombre de lignes)">${[["map", "Carte"], ["relief", "Relief 3D"]].map(([k, l]) => `<button type="button" data-bgview="${k}" aria-pressed="${this.view === k}">${l}</button>`).join("")}</div>
      ${this.view === "map" ? `<div class="planpick" title="Sélection sur la carte : rectangle ou lasso (tracé libre)">${[["rect", "Rectangle"], ["lasso", "Lasso"]].map(([k, l]) => `<button type="button" data-bgbrush="${k}" aria-pressed="${this.brush === k}">${l}</button>`).join("")}</div>
      <button class="tog" type="button" data-bga="arrows" aria-pressed="${this.arrows}"><i></i>Variables</button>` : ""}<button class="btn sm" type="button" data-bg="fit" title="Recentrer (double-clic)">Recentrer</button><button class="hq" type="button" data-help="carte" aria-label="Aide">?</button>`;
  },
  rampColors() { return isDark() ? ["#141B4D", "#2A3FD6", "#3B8BFF", "#4FD8E8", "#C8F6FF", "#FFFFFF"].map(hexRGB) : ["#DDE4FF", "#8EA6FF", "#3D5BE0", "#1E2E9E", "#0C1452"].map(hexRGB); },
  fitBox(a, b) { const e = this.acp.ext, cx = (e[a][0] + e[a][1]) / 2, cy = (e[b][0] + e[b][1]) / 2, h = Math.max(e[a][1] - e[a][0], e[b][1] - e[b][0]) / 2; return [cx - h, cx + h, cy - h, cy + h]; },   // echelle identique sur les deux axes
  async draw() {
    const cv = $("#bgCanvas"); if (!cv || !this.acp) return; const relief = this.view === "relief", css = cv.parentElement.clientWidth || 600, G = relief ? 200 : clamp(Math.round(css * Math.min(devicePixelRatio || 1, 2)), 256, 1024), [a, b] = this.plane;
    cv.hidden = relief; $("#bgOver").style.display = relief ? "none" : ""; $("#bgRelief").hidden = !relief; $("#bgMap").classList.toggle("relief", relief); if (!relief) Relief.dispose();
    if (!this.box) this.box = this.fitBox(a, b);
    const req = { a, b, box: this.box, G, H: G, how: this.how, color: this.color, pal: range(10).map(k => hexRGB(cssVar(`--g${k + 1}`))), ramp: this.color.mode === "num" || this.color.mode === "t2" ? RAMP.map(hexRGB) : this.rampColors(), hl: hexRGB(cssVar("--amber")), dark: isDark() };
    const seq = ++this.drawSeq; let d; try { d = await this.call("density", req); } catch (e) { toast(e.message); return; } if (seq !== this.drawSeq || !$("#bgCanvas")) return;
    this.dens = d; this.foot(d);
    if (relief) { Relief.show($("#bgRelief"), d, { how: this.how, plane: this.plane, box: this.box, pct: this.acp.pct }); return; }
    cv.width = d.G; cv.height = d.H; cv.getContext("2d").putImageData(new ImageData(d.img, d.G, d.H), 0, 0); this.drawOver();
  },
  foot(d) {
    $("#bgFoot").textContent = `${d.G} × ${d.H} cases · ${fmtInt(d.inside)} lignes agrégées en ${fmtMs(d.ms)}${d.outside ? ` · ${fmtInt(d.outside)} hors cadre` : ""}${this.view === "relief" ? " · glisser pour tourner, molette pour zoomer" : ""}`;
    const m = this.color.mode, lg = $("#bgLegend");
    if (m === "cat" && d.legend) { const c = this.s.cat.find(x => x.name === this.color.col); lg.innerHTML = d.legend.map((k, j) => `<span class="sw"><i style="background:var(--g${j % 10 + 1})"></i>${esc(c.labels[k] ?? "(autres)")}${d.merged && j === d.legend.length - 1 ? " + autres" : ""}</span>`).join(""); }
    else if (m === "class" && this.cls?.k) lg.innerHTML = range(this.cls.k).map(j => `<span class="sw"><i style="background:var(--g${j % 10 + 1})"></i>C${j + 1}</span>`).join("");
    else if (m === "num" || m === "t2") lg.innerHTML = `<span class="sw">${fmtNum(d.vlo)}</span><span class="ramp" style="background:${rampCSS}"></span><span class="sw">${fmtNum(d.vhi)}</span><span class="muted">moyenne par case${m === "t2" ? " (T²)" : ""}</span>`;
    else lg.innerHTML = `<span class="sw">peu</span><span class="ramp" style="background:linear-gradient(90deg,${this.rampColors().map(c => `rgb(${c})`).join(",")})"></span><span class="sw">beaucoup de lignes</span>`;
  },
  // axes, graduations, fleches des variables (biplot) et rectangle de selection, en coordonnees 0-1000
  drawOver(brush = null, path = null) {
    const sv = $("#bgOver"); if (!sv) return; const [x0, x1, y0, y1] = this.box, a = this.acp, [pa, pb] = this.plane, X = v => (v - x0) / (x1 - x0) * 1000, Y = v => 1000 - (v - y0) / (y1 - y0) * 1000;
    const st = niceStep((x1 - x0) / 6); let s = "";
    for (let t = Math.ceil(x0 / st) * st; t <= x1; t += st) s += `<line x1="${X(t)}" x2="${X(t)}" y1="0" y2="1000" class="gl"/><text x="${X(t) + 6}" y="990" class="tk">${fr(t, st < 1 ? 1 : 0)}</text>`;
    for (let t = Math.ceil(y0 / st) * st; t <= y1; t += st) s += `<line y1="${Y(t)}" y2="${Y(t)}" x1="0" x2="1000" class="gl"/><text x="8" y="${Y(t) - 6}" class="tk">${fr(t, st < 1 ? 1 : 0)}</text>`;
    if (x0 < 0 && x1 > 0) s += `<line x1="${X(0)}" x2="${X(0)}" y1="0" y2="1000" class="ax" style="stroke:var(--a${pb + 1})"/>`; if (y0 < 0 && y1 > 0) s += `<line y1="${Y(0)}" y2="${Y(0)}" x1="0" x2="1000" class="ax" style="stroke:var(--a${pa + 1})"/>`;
    s += `<text x="985" y="${clamp(Y(0) - 12, 30, 960)}" text-anchor="end" class="at" style="fill:var(--a${pa + 1})">Axe ${pa + 1} · ${pc(a.pct[pa])}</text><text x="${clamp(X(0) + 12, 16, 700)}" y="36" class="at" style="fill:var(--a${pb + 1})">Axe ${pb + 1} · ${pc(a.pct[pb])}</text>`;
    if (this.arrows) { const cx = X(0), cy = Y(0), R = 0.36 * 1000, list = a.coord.map((c, j) => ({ j, x: c[pa] || 0, y: c[pb] || 0 })).map(o => ({ ...o, q: o.x * o.x + o.y * o.y })).sort((u, v) => v.q - u.q).slice(0, 10).filter(o => o.q >= 0.12);
      const labs = [];
      list.forEach(o => { const ex = cx + o.x * R, ey = cy - o.y * R, ang = Math.atan2(ey - cy, ex - cx), ux = Math.cos(ang), uy = Math.sin(ang);
        s += `<line x1="${cx}" y1="${cy}" x2="${ex - ux * 12}" y2="${ey - uy * 12}" class="ar"/><path d="M${ex} ${ey} L${ex - ux * 18 - uy * 8} ${ey - uy * 18 + ux * 8} L${ex - ux * 18 + uy * 8} ${ey - uy * 18 - ux * 8}Z" class="ah"/>`;
        labs.push({ x: ex + ux * 10, y: ey + uy * 10 + 5, anc: ux < -0.2 ? "end" : ux > 0.2 ? "start" : "middle", t: a.vars[o.j] }); });
      // etiquettes ecartees verticalement quand elles se chevauchent
      labs.sort((u, v) => u.y - v.y).forEach((l, i) => { for (let k = 0; k < i; k++) { const m = labs[k]; if (Math.abs(l.y - m.y) < 26 && Math.abs(l.x - m.x) < 190 && (l.anc === m.anc || l.anc === "middle" || m.anc === "middle")) l.y = m.y + 26; } });
      labs.forEach(l => { s += `<text x="${l.x}" y="${l.y}" text-anchor="${l.anc}" class="al">${esc(l.t)}</text>`; }); }
    const rf = this.filters.find(f => f.type === "rect" && f.a === pa && f.b === pb); if (rf) s += `<rect x="${X(rf.x0)}" y="${Y(rf.y1)}" width="${X(rf.x1) - X(rf.x0)}" height="${Y(rf.y0) - Y(rf.y1)}" class="rf"/>`;
    const pf = this.filters.find(f => f.type === "poly" && f.a === pa && f.b === pb); if (pf) s += `<polygon points="${pf.pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ")}" class="rf"/>`;
    if (path && path.length > 1) s += `<polygon points="${path.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" class="br"/>`;
    if (brush) s += `<rect x="${Math.min(brush[0], brush[2])}" y="${Math.min(brush[1], brush[3])}" width="${Math.abs(brush[2] - brush[0])}" height="${Math.abs(brush[3] - brush[1])}" class="br"/>`;
    sv.innerHTML = s;
  },
  bindMap() {
    const el = $("#bgMap"); if (!el) return; let drag = null, wheelT = 0;
    const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1000]; };
    const data = ([px, py]) => { const [x0, x1, y0, y1] = this.box; return [x0 + px / 1000 * (x1 - x0), y1 - py / 1000 * (y1 - y0)]; };
    let path = null;
    el.onpointerdown = e => { if (e.button !== 0 || this.view !== "map") return; el.setPointerCapture(e.pointerId); drag = pos(e); path = this.brush === "lasso" ? [drag] : null; };
    el.onpointermove = e => { if (this.view !== "map") return; const p = pos(e);
      if (drag) { if (path) { const q = path[path.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 3) path.push(p); this.drawOver(null, path); } else this.drawOver([...drag, ...p]); $("#bgTip").hidden = true; return; }
      this.tip(p, e); };
    el.onpointerup = e => { if (!drag) return; const p = pos(e), d0 = drag, pth = path; drag = null; path = null; const [pa, pb] = this.plane;
      if (pth) {
        // lasso : polygone ferme d'au moins 3 sommets et d'une aire visible ; au plus 400 sommets transmis au calcul
        let area = 0; for (let i = 0; i < pth.length; i++) { const u = pth[i], v = pth[(i + 1) % pth.length]; area += u[0] * v[1] - v[0] * u[1]; }
        if (pth.length < 3 || Math.abs(area) / 2 < 300) { this.drawOver(); return; }
        const step = Math.ceil(pth.length / 400); return this.setFilter({ type: "poly", a: pa, b: pb, pts: pth.filter((q, i) => i % step === 0).map(data) }); }
      if (Math.abs(p[0] - d0[0]) < 8 && Math.abs(p[1] - d0[1]) < 8) { this.drawOver(); return; }
      const [ax, ay] = data(d0), [bx, by] = data(p); this.setFilter({ type: "rect", a: pa, b: pb, x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) }); };
    el.onpointerleave = () => { $("#bgTip").hidden = true; };
    el.ondblclick = () => { if (this.view === "relief") return; this.box = null; this.draw(); };
    el.addEventListener("wheel", e => { if (this.view !== "map") return; e.preventDefault(); const [px, py] = data(pos(e)), f = Math.exp(e.deltaY * 0.0015), [x0, x1, y0, y1] = this.box; this.box = [px + (x0 - px) * f, px + (x1 - px) * f, py + (y0 - py) * f, py + (y1 - py) * f]; this.drawOver(); clearTimeout(wheelT); wheelT = setTimeout(() => this.draw(), 70); }, { passive: false });
    if (!this.ro) { this.ro = new ResizeObserver(() => { clearTimeout(this.roT); this.roT = setTimeout(() => this.open_ && this.draw(), 150); }); } this.ro.disconnect(); this.ro.observe(el);
  },
  tip(p, e) {
    const d = this.dens, t = $("#bgTip"); if (!d || !t) return; const cx = Math.floor(p[0] / 1000 * d.G), cy = Math.floor(p[1] / 1000 * d.H); if (cx < 0 || cy < 0 || cx >= d.G || cy >= d.H) { t.hidden = true; return; }
    const k = d.cnt[cy * d.G + cx], [x0, x1, y0, y1] = this.box, x = x0 + p[0] / 1000 * (x1 - x0), y = y1 - p[1] / 1000 * (y1 - y0);
    t.innerHTML = `<b class="mono">${fmtInt(k)}</b> ligne${k > 1 ? "s" : ""} dans cette case<br><span class="mono muted">F${this.plane[0] + 1} = ${frs(x)} · F${this.plane[1] + 1} = ${frs(y)}</span>`; t.hidden = false;
    const r = $("#bgMap").getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; t.style.left = clamp(mx + 14, 4, r.width - t.offsetWidth - 4) + "px"; t.style.top = clamp(my + 14, 4, r.height - t.offsetHeight - 4) + "px";
  },
  /* ---------- filtres croises */
  // une zone (rectangle ou lasso) par plan factoriel : deux zones sur deux plans se combinent
  fkey: f => (f.type === "rect" || f.type === "poly" ? `zone${f.a}${f.b}` : `${f.type}:${f.col ?? ""}`),
  setFilter(f, remove = false) { this.pushHist(); const k = this.fkey(f); this.filters = this.filters.filter(x => this.fkey(x) !== k); if (!remove) this.filters.push(f); this.applyFilters(); },
  pushHist() { this.hist.push(JSON.stringify(this.filters)); if (this.hist.length > 60) this.hist.shift(); this.fut = []; },
  undo() { if (!this.hist.length) return toast("Rien à annuler."); this.fut.push(JSON.stringify(this.filters)); this.filters = JSON.parse(this.hist.pop()); this.applyFilters(); },
  redo() { if (!this.fut.length) return toast("Rien à rétablir."); this.hist.push(JSON.stringify(this.filters)); this.filters = JSON.parse(this.fut.pop()); this.applyFilters(); },
  async applyFilters() {
    const t0 = performance.now(); setBusy("filtrage de toutes les lignes");
    try { this.sel = await this.call("filter", { filters: this.filters }); } catch (e) { toast(e.message); } setBusy(null); this.times.filter = performance.now() - t0;
    if (this.filters.length && this.tab !== "sel") this.tab = "sel"; this.renderSide(); this.renderVars(); this.renderFilters(); this.draw();
  },
  filterLabel(f) { if (f.type === "rect") return `Rectangle sur le plan ${f.a + 1}·${f.b + 1}`; if (f.type === "poly") return `Lasso sur le plan ${f.a + 1}·${f.b + 1}`; if (f.type === "range") return `${f.col} entre ${fmtNum(f.lo)} et ${fmtNum(f.hi)}`; if (f.type === "cats") { const c = this.s.cat.find(x => x.name === f.col); return `${f.col} = ${liste(f.codes.map(k => c.labels[k] ?? "(autres)"), 3)}`; } if (f.type === "class") return `Classe${f.codes.length > 1 ? "s" : ""} ${f.codes.map(k => "C" + (k + 1)).join(", ")}`; return "Atypiques (T² ou Q)"; },
  renderFilters() { const el = $("#bgFilters"); if (!el) return;
    const ur = `<button class="btn sm ic" type="button" data-bg="undo" title="Annuler (Ctrl + Z)" ${this.hist.length ? "" : "disabled"}>↶</button><button class="btn sm ic" type="button" data-bg="redo" title="Rétablir (Ctrl + Maj + Z)" ${this.fut.length ? "" : "disabled"}>↷</button>`;
    el.innerHTML = (this.filters.length ? this.filters.map((f, i) => `<span class="fchip">${esc(this.filterLabel(f))}<button type="button" data-bgf="${i}" aria-label="Retirer le filtre">×</button></span>`).join("") + `<button class="btn sm" type="button" data-bg="clear">Tout effacer</button>` : `<span class="muted" style="font-size:12.5px">Aucun filtre</span>`) + ur; Hist.ui(); },
  renderVars() {
    const el = $("#bgVars"); if (!el) return; const S = this.sel && this.sel.count !== null ? this.sel : null;
    el.innerHTML = this.s.num.map((c, j) => this.histSVG(c, S ? S.num[j] : null, this.filters.find(f => f.type === "range" && f.col === c.name))).join("") + this.s.cat.map((c, j) => this.catHTML(c, S ? S.cat[j] : null, this.filters.find(f => f.type === "cats" && f.col === c.name))).join("");
    el.querySelectorAll("svg.bg-h").forEach(svg => this.bindHist(svg));
  },
  histSVG(c, sel, filt, w = 260, h = 96) {
    const { lo, hi, nb } = c.hb, H = c.hist.slice(1, nb + 1), mx = maxOf(H) || 1, Sh = sel && sel.n ? sel.hist.slice(1, nb + 1) : null, smx = Sh ? maxOf(Sh) || 1 : 1, L = 6, R = 6, T = 24, B = 20, bw = (w - L - R) / nb, yb = h - B, hh = yb - T;
    const X = v => L + (v - lo) / (hi - lo) * (w - L - R), out = c.hist[0] + c.hist[nb + 1];
    let s = `<svg viewBox="0 0 ${w} ${h}" class="bg-h" data-col="${esc(c.name)}" data-lo="${lo}" data-hi="${hi}" data-ints="${c.hb.ints ? 1 : 0}"><text x="${L}" y="14" class="hn">${esc(c.name.length > 30 ? c.name.slice(0, 29) + "…" : c.name)}</text>`;
    if (sel && sel.d !== undefined) s += `<text x="${w - R}" y="14" text-anchor="end" class="hd" style="fill:${sel.d >= 0 ? "var(--pos)" : "var(--neg)"}">${sel.d >= 0 ? "+" : "−"}${fr(Math.abs(sel.d), 2)} σ</text>`;
    if (filt) s += `<rect x="${X(Math.max(filt.lo, lo))}" y="${T - 4}" width="${Math.max(2, X(Math.min(filt.hi, hi)) - X(Math.max(filt.lo, lo)))}" height="${hh + 4}" class="hf"/>`;
    H.forEach((v, k) => { const y = hh * v / mx; s += `<rect x="${(L + k * bw + 0.4).toFixed(1)}" y="${(yb - y).toFixed(1)}" width="${Math.max(bw - 0.8, 0.6).toFixed(1)}" height="${y.toFixed(1)}" class="${Sh ? "hb dim" : "hb"}"/>`; });
    if (Sh) Sh.forEach((v, k) => { const y = hh * v / smx; if (v) s += `<rect x="${(L + k * bw + 0.4).toFixed(1)}" y="${(yb - y).toFixed(1)}" width="${Math.max(bw - 0.8, 0.6).toFixed(1)}" height="${y.toFixed(1)}" class="hs"/>`; });
    s += `<line x1="${L}" x2="${w - R}" y1="${yb}" y2="${yb}" class="hx"/><text x="${L}" y="${h - 5}" class="hl">${fmtNum(c.hb.ints ? lo + 0.5 : lo)}</text><text x="${w - R}" y="${h - 5}" text-anchor="end" class="hl">${fmtNum(c.hb.ints ? hi - 0.5 : hi)}</text>`;
    if (out) s += `<text x="${w / 2}" y="${h - 5}" text-anchor="middle" class="hl">${fmtInt(out)} hors cadre</text>`;
    return `<div class="bg-v">${s}<rect x="${L}" y="${T - 4}" width="${w - L - R}" height="${hh + 4}" class="hcap"/></svg></div>`;
  },
  bindHist(svg) {
    let d0 = null; const col = svg.dataset.col, lo = +svg.dataset.lo, hi = +svg.dataset.hi, ints = svg.dataset.ints === "1", w = 260, L = 6, R = 6;
    const val = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * w; return lo + clamp((x - L) / (w - L - R), 0, 1) * (hi - lo); };
    svg.onpointerdown = e => { svg.setPointerCapture(e.pointerId); d0 = val(e); };
    svg.onpointermove = e => { if (d0 === null) return; const v = val(e), a = Math.min(d0, v), b = Math.max(d0, v), X = t => L + (t - lo) / (hi - lo) * (w - L - R); let r = svg.querySelector(".hb2"); if (!r) { r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); r.setAttribute("class", "hb2"); svg.appendChild(r); } r.setAttribute("x", X(a)); r.setAttribute("y", 20); r.setAttribute("width", Math.max(1, X(b) - X(a))); r.setAttribute("height", 56); };
    svg.onpointerup = e => { if (d0 === null) return; const v = val(e), a = Math.min(d0, v), b = Math.max(d0, v); d0 = null;
      if (b - a < (hi - lo) / 200) { if (this.filters.some(f => f.type === "range" && f.col === col)) this.setFilter({ type: "range", col }, true); else svg.querySelector(".hb2")?.remove(); return; }
      this.setFilter({ type: "range", col, lo: ints ? Math.ceil(a) : a, hi: ints ? Math.floor(b) : b }); };
  },
  catHTML(c, sel, filt) {
    const tot = sum(c.counts) || 1, order = range(c.counts.length).sort((x, y) => c.counts[y] - c.counts[x]).slice(0, 10), on = new Set(filt ? filt.codes : []);
    return `<div class="bg-v bg-c"><div class="hn">${esc(c.name)} <span class="muted">· ${c.labels.length} modalité${c.labels.length > 1 ? "s" : ""}</span></div>${order.map(k => { const g = c.counts[k] / tot, m = sel ? sel.mods[k] : null;
      return `<button type="button" class="cb" data-cat="${esc(c.name)}" data-k="${k}" aria-pressed="${on.has(k)}" title="${esc(c.labels[k])} · ${fmtInt(c.counts[k])} lignes${m ? ` · ${pc(m.share * 100)} de la sélection (×${fr(m.lift, 2)})` : ""}"><span class="cl">${esc(c.labels[k])}</span><span class="ct"><i class="ca" style="width:${(g * 100).toFixed(1)}%"></i>${m ? `<i class="cs" style="width:${(m.share * 100).toFixed(1)}%"></i>` : ""}</span><span class="cv mono">${m ? "×" + fr(m.lift, 1) : pc(g * 100, 0)}</span></button>`; }).join("")}${c.counts.length > 10 ? `<div class="muted" style="font-size:11.5px;margin-top:4px">+ ${c.counts.length - 10} modalités moins fréquentes</div>` : ""}</div>`;
  },
  /* ---------- panneau lateral */
  renderSide() {
    const el = $("#bgSide"); if (!el) return; document.querySelectorAll("#bgTabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.bgt === this.tab));
    el.innerHTML = this.tab === "sel" ? this.pSel() : this.tab === "axes" ? this.pAxes() : this.tab === "cls" ? this.pCls() : this.pOut();
    if (this.tab === "out" && !this.outl) this.call("outliers", { top: 25 }).then(o => { this.outl = o; if (this.tab === "out") this.renderSide(); }).catch(() => {});
  },
  pSel() {
    const S = this.sel, a = this.acp;
    if (!S || S.count === null) return `<div class="bg-hintbox"><b>Sélectionnez pour comprendre.</b><p>Tracez un rectangle ou un lasso sur la carte, glissez sur un histogramme ou cliquez une modalité. Chaque sélection est décrite sur les ${fmtInt(a.N)} lignes : ce qui la distingue du reste, variable par variable.</p><div class="bg-kv"><span>Axe 1</span><b>${esc(this.axisWords(0))}</b><span>Axe 2</span><b>${esc(this.axisWords(1))}</b></div></div>`;
    if (!S.count) return `<div class="bg-hintbox"><b>Aucune ligne ne vérifie ces filtres.</b><p>Élargissez un intervalle ou retirez un filtre.</p><div class="bg-row"><button class="btn sm" type="button" data-bg="clear">Effacer les filtres</button></div></div>`;
    const f = S.count / S.total, R = 38, C = 2 * Math.PI * R, nums = S.num.filter(o => o.d !== undefined).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8), mxd = Math.max(0.5, ...nums.map(o => Math.abs(o.d)));
    const mods = S.cat.flatMap((c, j) => c.mods.map(m => ({ ...m, col: c.name, label: this.s.cat[j].labels[m.k] ?? "(autres)" }))).filter(m => m.x >= 30 && m.share >= 0.02).sort((x, y) => y.lift - x.lift);
    const over = mods.filter(m => m.lift > 1.1).slice(0, 6), under = mods.filter(m => m.lift < 0.9 && m.glob >= 0.05).sort((x, y) => x.lift - y.lift).slice(0, 3);
    return `<div class="bg-selhead"><svg viewBox="0 0 100 100" class="ring"><circle cx="50" cy="50" r="${R}" class="rb"/><circle cx="50" cy="50" r="${R}" class="rf" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="55" text-anchor="middle">${pc(f * 100, f < 0.1 ? 1 : 0)}</text></svg>
        <div><b class="mono">${fmtInt(S.count)}</b> lignes sélectionnées<br><span class="muted">sur ${fmtInt(S.total)} · recalcul en ${fmtMs(this.times.filter || 0)}</span></div></div>
      <h4 class="bg-h4">Ce qui distingue la sélection</h4>
      ${nums.map(o => { const w = Math.abs(o.d) / mxd * 50; return `<div class="dz"><span title="${esc(o.name)}">${esc(o.name)}</span><span class="zbar"><i style="left:${o.d < 0 ? 50 - w : 50}%;width:${w}%;background:${o.d < 0 ? "var(--neg)" : "var(--pos)"}"></i></span><span class="mono">${o.d >= 0 ? "+" : "−"}${fr(Math.abs(o.d), 2)} σ</span><small class="mono muted">${fmtNum(o.mean)} contre ${fmtNum(o.meanAll)} · v = ${Math.abs(o.v) > 999 ? (o.v > 0 ? "> 999" : "< −999") : fr(o.v, 1)}</small></div>`; }).join("")}
      ${over.length ? `<h4 class="bg-h4">Modalités sur-représentées</h4>${over.map(m => `<div class="md"><span>${esc(m.col)} = <b>${esc(m.label)}</b></span><span class="mono">×${fr(m.lift, 2)}</span><small class="muted">${pc(m.share * 100)} de la sélection contre ${pc(m.glob * 100)} au total</small></div>`).join("")}` : ""}
      ${under.length ? `<h4 class="bg-h4">Sous-représentées</h4>${under.map(m => `<div class="md"><span>${esc(m.col)} = <b>${esc(m.label)}</b></span><span class="mono">×${fr(m.lift, 2)}</span><small class="muted">${pc(m.share * 100)} contre ${pc(m.glob * 100)}</small></div>`).join("")}` : ""}
      <p class="panel-sub" style="margin-top:12px">Avec ${fmtBig(S.total)} lignes, presque tout écart est statistiquement significatif : les variables sont classées par <b>taille d'effet</b> (écart des moyennes en écarts-types, d de Cohen) ; la valeur-test v reste indiquée.</p>
      <div class="bg-row"><button class="btn sm prime" type="button" data-bg="studioSel">Explorer la sélection dans le Studio</button><button class="btn sm" type="button" data-bg="clear">Effacer</button></div>`;
  },
  axisWords(k) { const a = this.acp; if (k >= a.q) return "—"; const it = a.vars.map((v, j) => ({ v, c: a.coord[j][k] })).sort((x, y) => Math.abs(y.c) - Math.abs(x.c)).slice(0, 4); const pos = it.filter(o => o.c > 0).map(o => o.v), neg = it.filter(o => o.c < 0).map(o => o.v); return `${neg.length ? liste(neg, 2) : "—"} ↔ ${pos.length ? liste(pos, 2) : "—"}`; },
  pAxes() {
    const a = this.acp, b = this.bres, [pa, pb] = this.plane;
    return `<div class="svgbox">${svgScree(b, PAL_UI, 460, 230)}</div><p class="panel-sub">Kaiser : ${pl(a.rule, "axe")} · coude : ${pl(a.coude, "axe")} · ${esc(a.alg)} sur la matrice ${a.vars.length} × ${a.vars.length}.</p>
      <div class="svgbox" style="max-width:400px;margin:6px auto 0">${svgCircle(b, pa, pb, PAL_UI, 400)}</div>
      ${range(Math.min(a.nAxes, 3)).map(k => `<div class="md"><span><b style="color:var(--a${k + 1})">Axe ${k + 1}</b> · ${pc(a.pct[k])}</span><span></span><small class="muted">${esc(this.axisWords(k))}</small></div>`).join("")}`;
  },
  pCls() {
    const c = this.cls; if (!c || c.pending) return `<div class="prog"><i style="width:60%" class="indet"></i></div><p class="panel-sub">Classification en cours : HCPC (Ward + k-means) sur un échantillon de 20 000 lignes, puis affectation exacte de chaque ligne au centre le plus proche.</p>`;
    if (c.err) return `<div class="err">${esc(c.err)}</div>`;
    const tot = sum(c.sizes), top = c.prof.slice().sort((x, y) => maxOf(y.z.map(Math.abs)) - maxOf(x.z.map(Math.abs))).slice(0, 8);
    return `<div class="bg-kv"><span>Classes</span><b>${c.k}${c.kAuto === c.k ? " (automatique)" : ""}</b><span>Inertie expliquée</span><b>R² = ${fr(c.R2, 3)}</b><span>Calcul</span><b>${fmtMs(c.ms)} · ${fmtInt(tot)} lignes affectées</b></div>
      <div class="bg-cls">${c.sizes.map((s, j) => `<button type="button" class="clsb" data-cls="${j}" style="--c:var(--g${j % 10 + 1})"><i style="width:${(s / tot * 100).toFixed(1)}%"></i><span>C${j + 1}</span><span class="mono">${pc(s / tot * 100, 1)}</span></button>`).join("")}</div>
      <div class="svgbox" style="margin-top:10px">${svgHeat(top.map(p => p.z), top.map(p => p.name), range(c.k).map(j => "C" + (j + 1)), PAL_UI, { w: 420, cell: v => ({ t: frs(v, 1), f: v / 1.5 }) })}</div>
      <p class="panel-sub">Moyenne de chaque classe en écarts-types (bleu : au-dessus de la moyenne générale). Cliquez une classe pour la sélectionner.</p>
      ${c.catp.map(cp => `<div class="md"><span><b>${esc(cp.name)}</b></span><span></span><small class="muted">${cp.top.map((t, j) => t.length ? `C${j + 1} : ${t.map(o => `${esc(this.s.cat.find(x => x.name === cp.name).labels[o.k] ?? "(autres)")} ×${fr(o.lift, 1)}`).join(", ")}` : "").filter(Boolean).join(" · ")}</small></div>`).join("")}
      <div class="bg-row"><button class="btn sm" type="button" data-bg="colorCls">Colorer la carte par classe</button><label class="bg-sel">k <select id="bgK">${range(9).map(i => i + 2).map(k => `<option value="${k}" ${k === c.k ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>`;
  },
  pOut() {
    const a = this.acp, o = this.outl, exp = a.N * (1 - 0.95 * 0.95);
    return `<div class="bg-kv"><span>Limite T² (95 %)</span><b class="mono">${fr(a.ucT, 2)}</b><span>Limite Q (95 %)</span><b class="mono">${a.ucQ ? fr(a.ucQ, 2) : "—"}</b><span>Au-delà de T²</span><b class="mono">${fmtInt(a.nT)} (${pc(a.nT / a.N * 100)})</b><span>Au-delà de Q</span><b class="mono">${fmtInt(a.nQ)} (${pc(a.nQ / a.N * 100)})</b><span>L'un ou l'autre</span><b class="mono">${fmtInt(a.nAny)} · ${fr(a.nAny / exp, 2)} × l'attendu</b></div>
      <p class="panel-sub">T² : ligne extrême dans le plan des ${pl(a.nAxes, "axe")} retenus. Q : ligne mal résumée par ces axes (structure différente). Sous l'hypothèse normale, environ ${pc((1 - 0.95 * 0.95) * 100, 1)} des lignes dépassent l'une des deux limites.</p>
      <div class="bg-row"><button class="btn sm" type="button" data-bg="selOut">Sélectionner les atypiques</button><button class="btn sm" type="button" data-bg="colorT2">Colorer par T²</button></div>
      <h4 class="bg-h4">Les 25 lignes les plus éloignées du modèle</h4>
      ${o ? `<div class="scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>Ligne</th><th>× limite</th><th>Écarts les plus marqués</th></tr></thead><tbody>${o.map(r => `<tr><td>${fmtInt(r.line)}</td><td>${fr(r.ratio, 1)}</td><td style="font-family:var(--f-body);white-space:normal">${r.z.map(z => `${esc(z.name)} ${z.z >= 0 ? "+" : "−"}${fr(Math.abs(z.z), 1)} σ`).join(" · ")}</td></tr>`).join("")}</tbody></table></div><p class="panel-sub">Numéro de ligne dans le fichier (en-tête = ligne 1).</p>` : `<p class="panel-sub">Calcul…</p>`}`;
  },
  /* ---------- exports et passage au Studio */
  async toStudio(fromSel) {
    try { setBusy("échantillon pour le Studio"); const m = this.sampleN, t0 = performance.now(), t = await this.call("sample", { m, fromSel: !!fromSel });
      const rows = t.rows.map(r => { const o = {}; for (let j = 0; j < t.columns.length; j++) o[t.columns[j]] = r[j]; return o; });
      this.show(false); loadTable({ name: this.name, columns: t.columns, rows, numeric: new Set(t.numeric) }, `${this.name.replace(/\.[^.]+$/, "")} · échantillon ${fmtInt(t.n)} / ${fmtInt(t.total)}${t.fromSel ? " (sélection)" : ""}`, null);
      setBusy(null); toast(`Échantillon aléatoire de ${fmtInt(t.n)} lignes ouvert dans le Studio (${fmtMs(performance.now() - t0)}). Bouton « Grands volumes » pour revenir.`);
    } catch (e) { setBusy(null); toast(e.message); }
  },
  resultsJSON() {
    const s = this.s, a = this.acp, c = this.cls && this.cls.k ? this.cls : null, r6 = x => Math.round(x * 1e6) / 1e6;
    return { format: "prisme-studio-bigdata-results", version: PRISME_VERSION, generated: new Date().toISOString(), source: this.name, rows: s.n, bytes: s.bytes, parseMs: Math.round(this.times.parse),
      columns: s.cols, numeric: s.num.map(v => ({ name: v.name, ...Object.fromEntries(Object.entries(v.st).map(([k, x]) => [k, typeof x === "number" ? r6(x) : x])) })),
      categorical: s.cat.map(v => ({ name: v.name, missing: v.st.miss, modalities: v.labels.map((l, k) => ({ label: l, count: v.counts[k] })) })),
      pca: { variables: a.vars, completeRows: a.N, eigenvalues: a.vals.map(r6), inertiaPct: a.pct.map(r6), cumulativePct: a.cum.map(r6), retainedAxes: a.nAxes, loadings: a.coord.map(r => r.slice(0, 5).map(r6)), correlation: a.R.map(r => r.map(r6)),
        hotellingT2Limit95: r6(a.ucT), qLimit95: a.ucQ && r6(a.ucQ), beyondT2: a.nT, beyondQ: a.nQ },
      clusters: c ? { k: c.k, r2: r6(c.R2), sizes: c.sizes, centers: c.centers.map(v => v.map(r6)), profiles: c.prof.map(p => ({ variable: p.name, z: p.z.map(r6) })) } : null,
      selection: this.sel && this.sel.count !== null ? { filters: this.filters, count: this.sel.count, variables: this.sel.num.filter(o => o.d !== undefined).map(o => ({ name: o.name, mean: r6(o.mean), meanAll: r6(o.meanAll), cohenD: r6(o.d), vTest: r6(o.v) })) } : null };
  },
  png() { if (this.view === "relief") return Relief.png(`${this.name.replace(/\.[^.]+$/, "")}_relief_${this.plane[0] + 1}${this.plane[1] + 1}.png`); const cv = $("#bgCanvas"); if (!cv) return; const G = cv.width, out = document.createElement("canvas"); out.width = G; out.height = G; const g = out.getContext("2d"); g.fillStyle = cssVar("--bg-2") || "#090D17"; g.fillRect(0, 0, G, G); g.drawImage(cv, 0, 0);
    const [pa, pb] = this.plane; g.font = `${Math.round(G / 42)}px sans-serif`; g.fillStyle = cssVar("--a" + (pa + 1)); g.textAlign = "right"; g.fillText(`Axe ${pa + 1} · ${pc(this.acp.pct[pa])}`, G - 12, G - 14); g.textAlign = "left"; g.fillStyle = cssVar("--a" + (pb + 1)); g.fillText(`Axe ${pb + 1} · ${pc(this.acp.pct[pb])}`, 12, 28);
    g.fillStyle = cssVar("--muted"); g.fillText(`${this.name} · ${fmtInt(this.dens?.inside || 0)} lignes`, 12, G - 14);
    out.toBlob(b => b && saveFile(`${this.name.replace(/\.[^.]+$/, "")}_carte_${pa + 1}${pb + 1}.png`, b)); },
  bind() {
    const root = $("#big");
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-bg],[data-bgt],[data-bgp],[data-bgh],[data-bga],[data-bgf],[data-cat],[data-cls],[data-bgview],[data-bgbrush]"); if (!t) return; const d = t.dataset;
      if (d.bg === "cancel") { this.kill(); this.s = null; this.exit(); return toast("Lecture annulée."); }
      if (d.bg === "leave") { this.kill(); this.s = null; return this.exit(); }
      if (d.bg === "studio") return this.toStudio(false); if (d.bg === "studioSel") return this.toStudio(true);
      if (d.bg === "json") return saveFile(`${this.name.replace(/\.[^.]+$/, "")}_resultats.json`, JSON.stringify(this.resultsJSON(), null, 1));
      if (d.bg === "png") return this.png(); if (d.bg === "fit") { this.box = null; if (this.view === "relief") Relief.reset(); return this.draw(); }
      if (d.bg === "clear") { this.pushHist(); this.filters = []; return this.applyFilters(); }
      if (d.bg === "undo") return this.undo(); if (d.bg === "redo") return this.redo();
      if (d.bg === "retype") return this.retype(); if (d.bg === "untype") return this.retype(true);
      if (d.bgview) { this.view = d.bgview; this.renderToolbar(); return this.draw(); }
      if (d.bgbrush) { this.brush = d.bgbrush; return this.renderToolbar(); }
      if (d.bg === "selOut") return this.setFilter({ type: "outlier" }); if (d.bg === "colorT2") { this.color = { mode: "t2" }; this.renderToolbar(); return this.draw(); }
      if (d.bg === "colorCls") { this.color = { mode: "class" }; this.renderToolbar(); return this.draw(); }
      if (d.bgt) { this.tab = d.bgt; return this.renderSide(); }
      if (d.bgp) { this.plane = [+d.bgp[0], +d.bgp[1]]; this.box = null; this.renderToolbar(); if (this.tab === "axes") this.renderSide(); return this.draw(); }
      if (d.bgh) { this.how = d.bgh; this.renderToolbar(); return this.draw(); }
      if (d.bga) { this.arrows = !this.arrows; this.renderToolbar(); return this.drawOver(); }
      if (d.bgf !== undefined) { this.pushHist(); this.filters.splice(+d.bgf, 1); return this.applyFilters(); }
      if (d.cat) { const k = +d.k, f = this.filters.find(x => x.type === "cats" && x.col === d.cat), codes = new Set(f ? f.codes : []); codes.has(k) ? codes.delete(k) : codes.add(k); return this.setFilter({ type: "cats", col: d.cat, codes: [...codes] }, !codes.size); }
      if (d.cls !== undefined) { const k = +d.cls, f = this.filters.find(x => x.type === "class"), codes = new Set(f ? f.codes : []); codes.has(k) ? codes.delete(k) : codes.add(k); return this.setFilter({ type: "class", codes: [...codes] }, !codes.size); }
    });
    root.addEventListener("change", e => {
      if (e.target.id === "bgColor") { const v = e.target.value; this.color = v.startsWith("cat:") ? { mode: "cat", col: v.slice(4) } : v.startsWith("num:") ? { mode: "num", col: v.slice(4) } : { mode: v }; this.draw(); }
      if (e.target.id === "bgSampleN") this.sampleN = +e.target.value;
      if (e.target.dataset.bgty) { const c = this.s.cols.find(x => x.name === e.target.dataset.bgty); if (c) { if (e.target.value === c.role) delete this.pendTypes[c.name]; else this.pendTypes[c.name] = e.target.value; } const b = $('[data-bg="retype"]'); if (b) b.disabled = !Object.keys(this.pendTypes).length; }
      if (e.target.id === "bgK") { if (this.filters.some(f => f.type === "class")) this.pushHist(); this.filters = this.filters.filter(f => f.type !== "class"); this.computeClasses(+e.target.value).then(() => { if (this.color.mode === "class") this.draw(); if (this.filters.length) this.applyFilters(); }); }
    });
    new MutationObserver(() => { if (this.open_ && this.acp) requestAnimationFrame(() => this.draw()); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.open_ && this.acp && this.draw());
  },
};

// flou en boite separable (rayon r, bords prolonges), en temps lineaire grace aux sommes glissantes
function blur2(a, G, H, r) {
  const t = new Float64Array(G * H), o = new Float64Array(G * H), w = 2 * r + 1;
  for (let y = 0; y < H; y++) { const b = y * G; let s = 0; for (let k = -r; k <= r; k++) s += a[b + clamp(k, 0, G - 1)]; for (let x = 0; x < G; x++) { t[b + x] = s / w; s += a[b + Math.min(G - 1, x + r + 1)] - a[b + Math.max(0, x - r)]; } }
  for (let x = 0; x < G; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[clamp(k, 0, H - 1) * G + x]; for (let y = 0; y < H; y++) { o[y * G + x] = s / w; s += t[Math.min(H - 1, y + r + 1) * G + x] - t[Math.max(0, y - r) * G + x]; } }
  return o;
}
/* ============================================================================
   Relief 3D de la carte de densite : chaque case devient un sommet dont la hauteur
   suit le nombre de lignes (meme intensite que la carte : egalisee, log ou lineaire)
   et dont la couleur reprend celle de la carte (modalites, classes, selection).
   ============================================================================ */
const Relief = {
  r: null, scene: null, cam: null, mesh: null, host: null, az: -0.55, alt: 0.62, dist: 3.1, k: 1, raf: 0, labels: null,
  reset() { this.az = -0.55; this.alt = 0.62; this.dist = 3.1; this.render(); },
  show(host, d, o) {
    if (typeof THREE === "undefined") { host.innerHTML = `<div class="nowebgl">La 3D n'est pas disponible ici.</div>`; return; }
    if (!this.r || this.host !== host) { this.dispose(); if (!this.mount(host)) return; }
    this.build(d, o); this.resize();
    if (!reduced && !this.mesh.userData.shown) { this.mesh.userData.shown = true; const t0 = performance.now(), go = t => { this.k = Math.min(1, (t - t0) / 650); this.k = 1 - (1 - this.k) ** 3; this.render(); if (this.k < 1) this.raf = requestAnimationFrame(go); }; cancelAnimationFrame(this.raf); this.k = 0; this.raf = requestAnimationFrame(go); }
    else { this.k = 1; this.render(); }
  },
  mount(host) {
    try { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { host.innerHTML = `<div class="nowebgl">La 3D n'est pas disponible sur cet appareil.</div>`; return false; }
    this.host = host; host.innerHTML = ""; this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.appendChild(this.r.domElement);
    this.labels = document.createElement("div"); this.labels.className = "rl-labels"; host.appendChild(this.labels);
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 0.75)); const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(-1.5, 3, 2); this.scene.add(dl);
    let drag = null; const el = this.r.domElement;
    el.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, this.az, this.alt]; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", e => { if (!drag) return; this.az = drag[2] - (e.clientX - drag[0]) * 0.008; this.alt = clamp(drag[3] + (e.clientY - drag[1]) * 0.006, 0.08, 1.45); this.render(); });
    el.addEventListener("pointerup", () => { drag = null; });
    el.addEventListener("wheel", e => { e.preventDefault(); this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), 1.4, 7); this.render(); }, { passive: false });
    el.addEventListener("dblclick", () => this.reset());
    this.ro = new ResizeObserver(() => { this.resize(); this.render(); }); this.ro.observe(host);
    return true;
  },
  build(d, o) {
    const G = d.G, H = d.H, cnt = d.cnt, img = d.img;
    // lissage des effectifs (trois flous en boite, proche d'un noyau gaussien) : rayon choisi pour que le bruit de comptage
    // (loi de Poisson, ecart relatif 1 / racine de l'effectif lisse) reste sous 5 % ; peu de lignes par case = relief plus lisse
    let nzc = 0; for (let i = 0; i < cnt.length; i++) if (cnt[i]) nzc++;
    const r = clamp(Math.round(Math.sqrt(400 / Math.max(1, d.inside / Math.max(1, nzc))) / 2), 1, 6);
    let sm = Float64Array.from(cnt); for (let k = 0; k < 3; k++) sm = blur2(sm, G, H, r);
    let mx = 0; const nz = []; for (let i = 0; i < sm.length; i++) if (sm[i] > 1e-9) { nz.push(sm[i]); if (sm[i] > mx) mx = sm[i]; }
    const srt = Float64Array.from(nz).sort(), L = srt.length || 1, how = o.how;
    const inten = c => { if (!(c > 1e-9)) return 0; if (how === "lin") return c / mx; if (how === "log") return Math.log1p(c) / Math.log1p(mx); let lo = 0, hi = srt.length; while (lo < hi) { const m = (lo + hi) >> 1; if (srt[m] <= c) lo = m + 1; else hi = m; } return lo / L; };
    const bg = hexRGB(cssVar("--bg-2") || "#0B1020"), geo = new THREE.PlaneGeometry(2, 2, G - 1, H - 1), pos = geo.attributes.position, col = new Float32Array(G * H * 3), base = new Float32Array(G * H);
    for (let i = 0; i < G * H; i++) {
      base[i] = 0.62 * inten(sm[i]); const p = i * 4, al = img[p + 3] / 255;
      // couleur de la carte posee sur le fond ; cases vides : fond legerement assombri
      for (let c = 0; c < 3; c++) col[i * 3 + c] = ((cnt[i] ? img[p + c] * al + bg[c] * (1 - al) : bg[c] * 0.85)) / 255;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.userData = { base };
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04, side: THREE.DoubleSide }));
    this.mesh.rotation.x = -Math.PI / 2; this.scene.add(this.mesh);
    // cadre au sol et axes factoriels (la ou la coordonnee vaut 0)
    if (this.deco) { this.scene.remove(this.deco); this.deco.traverse(x => { x.geometry?.dispose(); x.material?.dispose(); }); }
    this.deco = new THREE.Group(); const [x0, x1, y0, y1] = o.box, [pa, pb] = o.plane, line = (pts, color, op = 0.9) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0.002, z))); this.deco.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }))); };
    line([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]], new THREE.Color(cssVar("--line-2") || "#555"), 0.8);
    const u = x0 < 0 && x1 > 0 ? -1 + 2 * (-x0) / (x1 - x0) : null, v = y0 < 0 && y1 > 0 ? 1 - 2 * (-y0) / (y1 - y0) : null;
    if (v !== null) line([[-1, v], [1, v]], new THREE.Color(cssVar(`--a${pa + 1}`) || "#f55"));
    if (u !== null) line([[u, -1], [u, 1]], new THREE.Color(cssVar(`--a${pb + 1}`) || "#5f5"));
    this.scene.add(this.deco);
    this.axes = [{ p: new THREE.Vector3(1.08, 0, v ?? 1), t: `Axe ${pa + 1} · ${pc(o.pct[pa])}`, c: `var(--a${pa + 1})` }, { p: new THREE.Vector3(u ?? -1, 0, -1.1), t: `Axe ${pb + 1} · ${pc(o.pct[pb])}`, c: `var(--a${pb + 1})` }];
    this.labels.innerHTML = this.axes.map(a => `<span style="color:${a.c}">${esc(a.t)}</span>`).join("");
  },
  resize() { if (!this.r || !this.host) return; const w = this.host.clientWidth || 600, h = this.host.clientHeight || w; this.r.setSize(w, h, false); this.r.domElement.style.width = "100%"; this.r.domElement.style.height = "100%"; this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); },
  render() {
    if (!this.r || !this.mesh) return; const geo = this.mesh.geometry, pos = geo.attributes.position, base = geo.userData.base;
    if (geo.userData.k !== this.k) { for (let i = 0; i < base.length; i++) pos.setZ(i, base[i] * this.k); pos.needsUpdate = true; geo.computeVertexNormals(); geo.userData.k = this.k; }
    const c = this.cam; c.position.set(this.dist * Math.cos(this.alt) * Math.sin(this.az), this.dist * Math.sin(this.alt), this.dist * Math.cos(this.alt) * Math.cos(this.az)); c.lookAt(0, 0.12, 0);
    this.r.render(this.scene, c);
    const w = this.host.clientWidth, h = this.host.clientHeight; [...this.labels.children].forEach((el, i) => { const q = this.axes[i].p.clone().project(c); el.style.left = ((q.x + 1) / 2 * w).toFixed(0) + "px"; el.style.top = ((1 - q.y) / 2 * h).toFixed(0) + "px"; el.style.visibility = q.z < 1 ? "visible" : "hidden"; });
  },
  png(name) { if (!this.r) return; this.render(); this.r.domElement.toBlob(b => b && saveFile(name, b)); },
  dispose() {
    cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.ro = null;
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    if (this.deco) { this.deco.traverse(x => { x.geometry?.dispose(); x.material?.dispose(); }); this.deco = null; }
    if (this.r) { this.r.dispose(); this.r.forceContextLoss?.(); this.r.domElement.remove(); this.r = null; }
    if (this.labels) { this.labels.remove(); this.labels = null; } this.host = null; this.scene = null;
  },
};
