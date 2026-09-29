
/* ------------------------------------------------------------------ etat */
const state = { animKPI: false, table: null, types: null, source: "", example: "luxe", method: "ACP", params: {}, res: null, inter: null, axisNames: {}, tab: "synthese", plan: [0, 1],
  search: "", sort: null, error: null, clusters: null, colorMode: "groups", sim: null, labo: null, why: "",
  enc: { color: "groups", size: "uniform" }, hyperUI: { key: null, brush: {}, net: "brut", thr: 0.3, shepK: 2, recK: 2 },
  work: null, impInfo: null, prep: { missing: "drop", tr: {} }, supp: { quanti: [], quali: [] }, sel: new Set(), selSrc: "", isolate: false, groups: [],
  hc: null, hcOpts: { k: null, dims: null, consol: true }, emb: {}, trustFrom: null, insights: null, insFilter: "tous", scag: null, mat: {}, calVar: null,
  target: null, tgt: null, tgtSel: null, cmp: null, time: null, timeCache: null, quality: null };
const UI = {};
function syncViews(v = "3d") { document.querySelectorAll("#views button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v)); document.querySelector('[data-tool="anat"]')?.setAttribute("aria-pressed", v === "anat"); $("#stage").classList.toggle("hyper", v === "hyper" || v === "anat"); }

function defaultParams(m) {
  const t = state.table, ty0 = state.types, tc = state.target?.col, ty = tc ? { ...ty0, quanti: ty0.quanti.filter(c => c !== tc), quali: ty0.quali.filter(c => c !== tc) } : ty0;   // la cible reste hors des variables actives
  if (m === "ACP") return { ident: ty.ident, vars: ty.quanti.slice(), color: ty.quali.find(c => new Set(t.rows.map(r => r[c])).size <= 10) || null, nAxes: null };
  if (m === "AFDM") { const card = c => new Set(t.rows.map(r => r[c]).filter(v => v !== null && v !== undefined)).size; return { ident: ty.ident, vars: ty.quanti.concat(ty.quali.filter(c => { const k = card(c); return k >= 2 && k <= 15; })), color: ty.quali.find(c => card(c) <= 10) || null, nAxes: null }; }
  if (m === "ACM") return { ident: ty.ident, vars: ty.quali.filter(c => { const k = new Set(t.rows.map(r => r[c]).filter(v => v !== null && v !== undefined)).size; return k >= 2 && k <= 15; }), color: null, nAxes: null };
  const tab = isContingency(t, ty); return { mode: tab ? "tableau" : "brut", ident: ty.ident, vars: ty.quanti.slice(), rowVar: ty.quali[0] || null, colVar: ty.quali[1] || null,
    rowName: tab ? (ty.ident || "Lignes") : ty.quali[0] || "Lignes", colName: tab ? "Colonnes" : ty.quali[1] || "Colonnes", nAxes: null };
}
function loadTable(table, source, exampleKey = null) {
  if (typeof BigUI !== "undefined" && BigUI.open_) BigUI.show(false);
  state.table = table; state.types = detect(table); state.source = source; state.example = exampleKey; state.axisNames = {}; state.enc = { color: "groups", size: "uniform" };
  state.prep = { missing: "drop", tr: {} }; state.supp = { quanti: [], quali: [] }; state.groups = []; state.calVar = null; state.mat = {}; state.hcOpts = { k: null, dims: null, consol: true }; Sel.clear(true); Drawer.close?.();
  state.target = null; state.tgt = null; state.tgtSel = null; state.cmp = null; state.time = null; state.timeCache = null; state.quality = null;
  const [m, why] = suggest(table, state.types); state.method = m; state.why = why; state.params = defaultParams(m);
  renderRail(); run("project");
}
function setMethod(m) { if (m === state.method) return; state.method = m; state.params = defaultParams(m); state.axisNames = {}; state.enc = { color: "groups", size: "uniform" }; state.supp = { quanti: [], quali: [] }; state.groups = []; state.calVar = null; state.prep.missing = "drop"; renderRail(); run("project"); }
function run(mode = "morph") {
  state.error = null; const prevN = state.res?.n, prevM = state.res?.method;
  try {
    const t0 = applyTransforms(state.table, state.method === "ACP" || state.method === "AFDM" ? state.prep.tr : {}), mi = applyMissing(t0, state.prep.missing === "modal" ? "modal" : state.prep.missing, state.params, state.method); state.work = mi.table; state.impInfo = mi.info;
    const t = state.work; state.res = state.method === "ACP" ? runACP(t, state.params) : state.method === "ACM" ? runACM(t, state.params) : state.method === "AFDM" ? runAFDM(t, state.params) : runAFC(t, state.params);
    state.res.supp = supplementary(state.res, t, state.supp.quanti, state.supp.quali); state.inter = interpret(state.res);
  } catch (e) { state.error = e.message; }
  $("#errBox").hidden = !state.error; $("#errBox").textContent = state.error || "";
  if (state.error) return;
  if (prevN !== state.res.n || prevM !== state.res.method) { state.clusters = null; state.groups = []; if (["clusters", "user", "trust"].includes(state.enc.color)) { state.enc.color = "groups"; } }
  state.colorMode = ["clusters", "hcpc", "user"].includes(state.enc.color) ? state.enc.color : "groups";
  state.hc = null; state.scag = null; state.insights = null; state.emb = {}; Sel.clear(true); if (Drawer.kind) Drawer.close(); const ib = $("#insBadge"); if (ib) ib.hidden = true;
  state.labo = null; state.sim = null; Stage.setGhost(null); if (Tour.active) Tour.stop(); renderEnc();
  Stage.build(state.res, mode); renderHeader(); renderKPIs(); renderPanel(); UI.fiche(null); renderSelBar();
  clearTimeout(run.ins); run.ins = setTimeout(() => Studio.computeInsights(), mode === "project" ? 1800 : 600);
  PrismeAPI.emit("result", PrismeAPI.summary());
}

/* ------------------------------------------------------------------ en-tete, indicateurs */
function renderHeader() {
  const r = state.res; $("#dsName").textContent = state.example ? EXEMPLES[state.example].label : state.source;
  $("#dsDim").innerHTML = `· ${r.method === "AFC" ? `${r.I} × ${r.J}` : `${r.n.toLocaleString("fr-FR")} × ${r.method === "ACP" ? r.p : r.method === "AFDM" ? r.p + r.K : r.K}`}${state.example ? ' <span class="tag">exemple</span>' : ""}`;
  $("#engPill").innerHTML = `${r.method} · ${r.engine.alg} ${r.engine.mat} · <b>${fr(r.engine.ms, 2)} ms</b>`;
  const S = Math.min(r.q, 3); $("#stageEyebrow").textContent = `Espace factoriel · ${pl(S, "axe")} · ${r.method}`;
  $("#stageTitle").textContent = r.method === "ACP" ? `${pc(r.cum[S - 1])} de l'information dans cet espace` : r.method === "AFDM" ? `${pc(r.cum[S - 1])} de l'information · ${r.p} quantitatives et ${r.K} qualitatives` : r.method === "ACM" ? `${r.M} modalités, ${r.n} individus projetés` : `${r.I} ${r.rowName.toLowerCase()} × ${r.J} ${r.colName.toLowerCase()} projetés`;
  $("#encLegend").innerHTML = encLegendHTML(r) + (hasQ(r) && state.calVar && r.vars.includes(state.calVar) ? (() => { const j = r.vars.indexOf(state.calVar), q2 = sum(r.vcos2[j].slice(0, 3)); return `<span><b>Axe gradué</b>${esc(state.calVar)}<em>qualité de lecture ${fr(q2)}</em></span>`; })() : "");
  const lod = Stage.lod; $("#axisLegend").innerHTML = range(S).map(k => `<span><i style="background:var(--a${k + 1})"></i>Axe ${k + 1} · ${pc(r.pct[k])}${axisName(k) ? " · " + esc(axisName(k)) : ""}</span>`).join("") +
    (lod && lod.shown < lod.total ? `<span class="lodchip" title="Tous les individus sont calculés ; un échantillon aléatoire est dessiné pour garder la 3D fluide.">affichage ${lod.shown.toLocaleString("fr-FR")} / ${lod.total.toLocaleString("fr-FR")} points</span>` : "");
  const gi = groupIndex(r);
  const tg = [["names", "Noms", "N"], ...(hasQ(r) ? [["arrows", "Variables", ""], ["sphere", "Sphère", ""]] : []), ...(S >= 3 ? [["drops", "Projections", "P"]] : []), ...(gi && r.method !== "AFC" ? [["bary", "Barycentres", "B"]] : []), ["net", "Réseau", "M"], ["dens", "Densité", "D"], ...(r.method === "ACP" ? [["unc", "Incertitude", "U"]] : []), ["rotate", "Rotation", "R"]];
  $("#toggles").innerHTML = tg.map(([k, l, key]) => `<button class="tog" type="button" data-k="${k}" aria-pressed="${Stage.show[k]}"><i></i>${l}${key ? ` <span class="kbd">${key}</span>` : ""}</button>`).join("");
  $("#views").querySelector('[data-v="23"]').hidden = r.q < 3; $("#views").querySelector('[data-v="13"]').hidden = r.q < 3;
  $("#views").querySelector('[data-v="hyper"]').hidden = !Stage.canHyper("tour"); $("#views").querySelector('[data-v="hyper"]').innerHTML = `R<sup>${r.q}</sup>`; document.querySelector('[data-tool="anat"]').hidden = !Stage.canHyper("anat");
}
function countUp(el, to, fmt) { if (reduced || !state.animKPI) { el.textContent = fmt(to); return; } const t0 = performance.now(); const f = t => { const k = clamp((t - t0) / 1100, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function renderKPIs() {
  const r = state.res, S = r.nAxes, box = $("#kpis");
  const specW = r.pct.slice(0, 8).map((p, i) => `<i style="width:${p}%;background:${i < 3 ? `var(--a${i + 1})` : "var(--line-2)"};opacity:${i < S ? 1 : .5}"></i>`).join("");
  const k4 = r.method === "AFC" ? ["Liaison χ²", fr(r.chi2, 1), `${r.ddl} ddl · p ${r.pval < 0.001 ? "< 0,001" : "= " + fr(r.pval, 3)}`] : ["Individus", String(r.n), r.removed ? pl(r.removed, "ligne incomplète retirée", "lignes incomplètes retirées") : "toutes les lignes sont complètes"];
  box.innerHTML = `
    <div class="card kpi"><div class="l">Information conservée</div><div class="v" id="kv1">0</div><div class="s">sur les ${pl(S, "axe")} retenus</div><div class="bar"><i id="kbar" style="width:0%"></i></div></div>
    <div class="card kpi"><div class="l">Axes retenus</div><div class="v">${S}<small>/ ${r.q}</small></div><div class="s">${r.method === "ACP" ? `Kaiser ${r.rule} · coude ${r.coude}` : r.method === "AFDM" ? `λ ≥ 1 (moyenne) : ${r.rule} · coude ${r.coude}` : r.method === "ACM" ? `λ > 1/K : ${r.rule} · coude ${r.coude}` : `λ > moyenne : ${r.rule} · coude ${r.coude}`}</div><div class="spec">${specW}</div></div>
    <div class="card kpi">${svgSpark(r.vals)}<div class="l">Premier axe · λ1</div><div class="v" id="kv3">0</div><div class="s">${pc(r.pct[0])} de l'inertie ${r.pct[0] >= 60 ? "· domine" : "· sans écraser"}</div></div>
    <div class="card kpi"><div class="l">${k4[0]}</div><div class="v">${k4[1]}</div><div class="s">${k4[2]}</div></div>`;
  countUp($("#kv1"), r.cum[S - 1], x => fr(x, 1) + " %"); countUp($("#kv3"), r.vals[0], x => fr(x, r.vals[0] >= 1 ? 2 : 3));
  if (state.animKPI) requestAnimationFrame(() => requestAnimationFrame(() => ($("#kbar").style.width = r.cum[S - 1] + "%"))); else $("#kbar").style.width = r.cum[S - 1] + "%";
  state.animKPI = true;
}

/* ------------------------------------------------------------------ barre laterale */
function renderRail() {
  $("#examples").innerHTML = ["ecommerce", "luxe", "clients", "ventes"].filter(k => EXEMPLES[k]).map(k => [k, EXEMPLES[k]]).map(([k, e]) => `<button class="ex" type="button" data-ex="${k}" aria-pressed="${state.example === k}"><span class="m">${e.m}</span><span><b>${e.label}</b><span>${e.sub}</span></span></button>`).join("");
  document.querySelectorAll("#methodSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === state.method));
  $("#methodHint").innerHTML = `Suggestion : <b>${suggest(state.table, state.types)[0]}</b>, car ${esc(state.why)}.`;
  const t = state.table, ty = state.types, p = state.params, cols = t.columns;
  const opt = (arr, cur, none) => (none ? `<option value="">${none}</option>` : "") + arr.map(c => `<option value="${esc(c)}" ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
  const axesSel = `<div class="field"><label for="fAxes">Axes à interpréter</label><select id="fAxes" data-p="nAxes">${[["", "Automatique (règle du cours)"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]].map(([v, l]) => `<option value="${v}" ${String(p.nAxes ?? "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
  let h = "";
  if (state.method === "ACP" || state.method === "ACM" || state.method === "AFDM") {
    const pool = state.method === "ACP" ? ty.quanti : state.method === "AFDM" ? ty.quanti.concat(ty.quali) : cols.filter(c => c !== p.ident), mixed = state.method === "AFDM";
    h += `<div class="chips" id="varChips">${pool.map(c => `<button class="chip" type="button" data-var="${esc(c)}" aria-pressed="${p.vars.includes(c)}" title="${esc(c)}${mixed ? (ty.quanti.includes(c) ? " · quantitative" : " · qualitative") : ""}">${mixed ? `<i class="ck ${ty.quanti.includes(c) ? "q" : "l"}"></i>` : ""}${esc(c)}</button>`).join("") || '<span class="muted">Aucune variable compatible.</span>'}</div>`;
    h += `<div class="field"><label for="fIdent">Noms des individus</label><select id="fIdent" data-p="ident">${opt(cols, p.ident, "Numéroter les lignes")}</select></div>`;
    h += `<div class="field"><label for="fColor">Couleur des points</label><select id="fColor" data-p="color">${opt(ty.quali, p.color, "Aucune")}</select></div>`;
  } else {
    h += `<div class="seg" id="afcMode" style="grid-template-columns:1fr 1fr"><button type="button" data-mode="tableau" aria-pressed="${p.mode === "tableau"}" style="font-size:11px">Tableau croisé</button><button type="button" data-mode="brut" aria-pressed="${p.mode === "brut"}" style="font-size:11px">Croiser 2 colonnes</button></div>`;
    if (p.mode === "tableau") {
      h += `<div class="field"><label for="fIdent">Noms des lignes</label><select id="fIdent" data-p="ident">${opt(cols, p.ident, "—")}</select></div>`;
      h += `<p class="hint">Colonnes d'effectifs :</p><div class="chips" id="varChips">${ty.quanti.map(c => `<button class="chip" type="button" data-var="${esc(c)}" aria-pressed="${p.vars.includes(c)}">${esc(c)}</button>`).join("")}</div>`;
    } else h += `<div class="field"><label for="fRow">Variable en lignes</label><select id="fRow" data-p="rowVar">${opt(cols, p.rowVar, "—")}</select></div><div class="field"><label for="fCol">Variable en colonnes</label><select id="fCol" data-p="colVar">${opt(cols, p.colVar, "—")}</select></div>`;
    h += `<div class="field"><label for="fRowName">Nom des lignes</label><input id="fRowName" data-p="rowName" value="${esc(p.rowName)}"></div><div class="field"><label for="fColName">Nom des colonnes</label><input id="fColName" data-p="colName" value="${esc(p.colName)}"></div>`;
  }
  $("#varsBox").innerHTML = h + axesSel + (state.method !== "AFC" ? `<p class="hint">Rôles (actives, illustratives), transformations et valeurs manquantes : onglet <a href="#" data-goto="profil">Profil</a>.</p>` : "");
}

/* ------------------------------------------------------------------ panneaux */
function renderPanel() {
  const r = state.res; if (!r) return; document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.t === state.tab));
  if (state.tab !== "simulateur") Stage.setGhost(null);
  if (state.tab !== "hyper") Hyper.leave(); ProjUI.plots = {};
  $("#panel").innerHTML = ({ synthese: pSynthese, axes: pAxes, variables: pVariables, individus: pIndividus, insights: pInsights, projections: pProjections, classes: pClasses, matrices: pMatrices, hyper: pHyper, cible: pCible, comparer: pCompare, temps: pTemps, profil: pProfil, simulateur: pSim, labo: pLabo, rapport: pRapport })[state.tab](r);
  if (state.tab === "hyper") Hyper.mount(); if (state.tab === "projections") ProjUI.mount(); if (state.tab === "matrices") MatUI.mount(); if (state.tab === "individus") markSelRows();
  if (state.tab === "simulateur") Sim.update();
  if (state.tab === "labo") Labo.autostart();
}
const heatCorr = (r, P) => svgHeat(r.R, r.vars, r.vars, P, { tri: true, rot: true, cell: (v, i, j) => ({ t: i === j ? "1" : frs(v), f: i === j ? .35 : v }) });
const heatRatio = (r, P) => svgHeat(r.ratio, r.rowL, r.colL, P, { rot: true, cell: v => ({ t: (v >= 1 ? "+" : "−") + Math.round(Math.abs(v - 1) * 100) + " %", f: Math.log2(Math.max(v, 1e-3)) / 1.5 }) });
function pSynthese(r) {
  const b = brief(r, state.inter).map(([h, c]) => `<li style="--c:${c}">${h}</li>`).join("");
  let right = "";
  if (r.method === "AFDM") right = `<div class="card"><h3 class="panel-title">Carré des liaisons</h3><p class="panel-sub">Chaque variable, quantitative (r²) ou qualitative (η²), selon sa liaison avec les axes 1 et 2 : plus elle est loin de l'origine, plus elle structure le plan.</p><div class="svgbox" style="max-width:460px;margin:auto">${svgLinkMap(r, 0, 1, PAL_UI)}</div></div>`;
  else if (r.method === "ACP") right = `<div class="card"><h3 class="panel-title">Corrélations</h3><p class="panel-sub">Bleu : les variables montent ensemble · orange : elles s'opposent.</p><div class="svgbox">${heatCorr(r, PAL_UI)}</div></div>`;
  else if (r.method === "AFC") right = `<div class="card"><h3 class="panel-title">Écarts à l'indépendance</h3><p class="panel-sub">Effectif observé ÷ attendu − 1 : bleu = association plus fréquente qu'au hasard.</p><div class="svgbox">${heatRatio(r, PAL_UI)}</div></div>`;
  else { const rares = r.mods.filter((m, j) => r.eff[j] / r.n < .05);
    right = `<div class="card"><h3 class="panel-title">Fréquence des modalités</h3><p class="panel-sub">${rares.length ? `Modalités rares (< 5 %) : ${esc(liste(rares))}. Elles peuvent tirer un axe à elles seules.` : "Aucune modalité rare : toutes dépassent 5 % des individus."}</p><div class="scroll" style="max-height:360px"><table class="tbl"><thead><tr><th>Modalité</th><th>Effectif</th><th>%</th></tr></thead><tbody>${r.mods.map((m, j) => `<tr><td>${esc(m)}</td><td>${r.eff[j]}</td><td>${fr(r.eff[j] / r.n * 100, 1)}</td></tr>`).join("")}</tbody></table></div></div>`; }
  const axesTxt = r.method === "AFDM" ? `Valeur propre moyenne = 1 : <b>${pl(r.rule, "axe")}</b> au-dessus ; coude : <b>${pl(r.coude, "axe")}</b>. Chaque variable apporte au plus 1 par axe (r² ou η²).` : r.method === "ACP" ? `Critère de Kaiser : <b>${pl(r.rule, "axe")}</b> (λ ≥ 1). Critère du coude : <b>${pl(r.coude, "axe")}</b>, la plus forte cassure après le premier axe se situant entre l'axe ${r.coude} et l'axe ${r.coude + 1}.${r.nAxes >= 3 && r.vals[r.nAxes - 1] < 1.15 ? ` λ${r.nAxes} = ${fr(r.vals[r.nAxes - 1])} reste proche du seuil : cet axe est le plus fragile.` : ""}`
    : r.method === "ACM" ? `Seuil 1/K = ${fr(r.threshold, 3)} : <b>${pl(r.rule, "axe")}</b> au-dessus de l'inertie moyenne ; coude : <b>${pl(r.coude, "axe")}</b>.` : `Inertie moyenne ${fr(r.threshold, 4)} : <b>${pl(r.rule, "axe")}</b> au-dessus ; coude : <b>${pl(r.coude, "axe")}</b>.`;
  return `<div class="grid2">
    <div class="card wide"><h3 class="panel-title">En bref</h3><p class="panel-sub">Généré automatiquement à partir des règles du cours · ${esc(state.example ? EXEMPLES[state.example].label : state.source)}</p><ul class="brief">${b}</ul></div>
    <div class="card"><h3 class="panel-title">Spectre des valeurs propres</h3><p class="panel-sub">${axesTxt}</p><div class="svgbox">${svgScree(r, PAL_UI)}</div></div>
    ${right}
    <div class="card wide"><details><summary>Aperçu des données (${state.table.rows.length} lignes × ${state.table.columns.length} colonnes)</summary><div class="scroll" style="margin-top:10px"><table class="tbl"><thead><tr>${state.table.columns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${state.table.rows.slice(0, 60).map(row => `<tr>${state.table.columns.map(c => `<td>${esc(row[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details></div>
  </div>`;
}
function chipsHTML(list, cls, max = 10, total = list.length) { if (!list.length) return '<span class="muted" style="font-size:12.5px">—</span>'; const x = list.slice(0, max).map(e => `<span class="${cls}">${esc(typeof e === "string" ? e : `${e.l} · ${fr(e.c, 1)} %`)}</span>`).join(""); return x + (total > max ? `<span class="muted" style="font-size:12px;padding:5px 2px">+${(total - Math.min(max, list.length)).toLocaleString("fr-FR")}</span>` : ""); }
function pAxes(r) {
  const seuil = seuilOf(r);
  return `<div class="grid2">${state.inter.map(it => { const k = it.k, c = `var(--a${Math.min(k, 2) + 1})`, nm = axisName(k); const what = r.method === "ACP" ? "Variables" : r.method === "AFDM" ? "Variables et modalités" : r.method === "ACM" ? "Modalités" : esc(r.rowName);
    return `<div class="card axis-card wide" style="--c:${c}">
      <div class="axis-head"><span class="num">AXE ${k + 1}</span><span class="pct">${pc(r.pct[k])}</span><span class="lam mono">λ = ${fr(r.vals[k], r.vals[k] >= .1 ? 3 : 4)}</span>
        <input type="text" id="axisName${k}" data-axis="${k}" value="${esc(nm)}" placeholder="Nommer l'axe · ex. ${esc(it.auto)}" aria-label="Nom de l'axe ${k + 1}"></div>
      <div class="svgbox" style="max-width:880px;margin:0 auto">${svgDiverging(contribItems(r, k), seuil, PAL_UI, c)}</div>
      <p class="panel-sub" style="margin:6px 0 0">Seuil de contribution : ${fr(seuil, 1)} % ${r.method === "AFC" ? "(colonnes ramenées au même seuil)" : ""} · le signe de la coordonnée donne le côté.</p>
      <div class="sides"><div class="side"><h4>${what} · côté −</h4><div class="chips">${chipsHTML(it.main.minus, "")}</div></div><div class="side"><h4>${what} · côté +</h4><div class="chips">${chipsHTML(it.main.plus, "plus")}</div></div></div>
      ${it.cols ? `<div class="sides"><div class="side"><h4>${esc(r.colName)} · côté −</h4><div class="chips">${chipsHTML(it.cols.minus, "")}</div></div><div class="side"><h4>${esc(r.colName)} · côté +</h4><div class="chips">${chipsHTML(it.cols.plus, "plus")}</div></div></div>` : ""}
      ${hasQ(r) ? `<div class="sides"><div class="side"><h4>Individus · coord. < −${fr(Math.sqrt(r.vals[k]))}</h4><div class="chips">${chipsHTML(it.indM, "", 8, it.nM)}</div></div><div class="side"><h4>Individus · coord. > +${fr(Math.sqrt(r.vals[k]))}</h4><div class="chips">${chipsHTML(it.indP, "plus", 8, it.nP)}</div></div></div>` : ""}
      <p class="sentence">${axisPhrase(r, it)}</p></div>`; }).join("")}</div>`;
}
function planPicker(q) { const opts = [[0, 1], [0, 2], [1, 2]].filter(([a, b]) => b < q); return `<div class="planpick">${opts.map(([a, b]) => `<button type="button" data-plan="${a}${b}" aria-pressed="${state.plan[0] === a && state.plan[1] === b}">Plan ${a + 1}·${b + 1}</button>`).join("")}</div>`; }
function pVariables(r) {
  const [a, b] = state.plan[1] < r.q ? state.plan : [0, 1], S = r.nAxes;
  if (r.method === "AFDM") { const mp = planPoints(r, a, b, PAL_UI).pts;
    return `<div class="grid2"><div class="card"><div class="rowhead"><div><h3 class="panel-title">Carré des liaisons</h3><p class="panel-sub" style="margin:0">r² (quantitatives) et η² (qualitatives) avec les deux axes du plan.</p></div>${planPicker(r.q)}</div><div class="svgbox" style="max-width:520px;margin:auto">${svgLinkMap(r, a, b, PAL_UI)}</div></div>
      <div class="card"><h3 class="panel-title">Cercle des corrélations</h3><p class="panel-sub">Variables quantitatives seulement.</p><div class="svgbox" style="max-width:520px;margin:auto">${svgCircle(r, a, b, PAL_UI)}</div></div>
      <div class="card wide"><h3 class="panel-title">Carte des modalités</h3><p class="panel-sub">Chaque modalité au barycentre des individus qui la portent (points gris).</p><div class="svgbox">${svgPlan(mp, a, b, r, PAL_UI)}</div></div>
      <div class="card wide"><h3 class="panel-title">Liaison de chaque variable avec les axes</h3><p class="panel-sub">r² pour une quantitative, η² pour une qualitative ; leur somme sur un axe donne sa valeur propre.</p><div class="scroll"><table class="tbl"><thead><tr><th>Variable</th><th>Type</th>${range(S).map(k => `<th>Axe ${k + 1}</th>`).join("")}</tr></thead><tbody>${r.link.map(l => `<tr><td>${esc(l.v)}</td><td style="font-family:var(--f-body)">${l.type === "q" ? "quantitative · r²" : "qualitative · η²"}</td>${range(S).map(k => `<td style="${l.r2[k] >= .3 ? `color:var(--a${Math.min(k, 2) + 1});font-weight:600` : ""}">${fr(l.r2[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div></div>`; }
  if (r.method === "ACP") return `<div class="grid2"><div class="card"><div class="rowhead"><div><h3 class="panel-title">Cercle des corrélations</h3><p class="panel-sub" style="margin:0">Couleur de flèche = axe sur lequel la variable est la mieux représentée.</p></div>${planPicker(r.q)}</div><div class="svgbox" style="max-width:520px;margin:auto">${svgCircle(r, a, b, PAL_UI)}</div></div>
      <div class="card"><h3 class="panel-title">Coordonnées, contributions, cos²</h3><p class="panel-sub">Contribution significative au-delà de ${fr(100 / r.p, 1)} % (1/p).</p><div class="scroll"><table class="tbl"><thead><tr><th>Variable</th>${range(S).map(k => `<th>F${k + 1}</th>`).join("")}${range(S).map(k => `<th>CTR ${k + 1}</th>`).join("")}<th>cos² ${S} axes</th></tr></thead><tbody>
      ${r.vars.map((v, j) => `<tr><td>${esc(v)}</td>${range(S).map(k => `<td>${frs(r.coord[j][k])}</td>`).join("")}${range(S).map(k => `<td style="${r.vctr[j][k] > 100 / r.p ? `color:var(--a${Math.min(k, 2) + 1});font-weight:600` : ""}">${fr(r.vctr[j][k], 1)}</td>`).join("")}<td>${fr(sum(r.vcos2[j].slice(0, S)))}</td></tr>`).join("")}</tbody></table></div></div></div>`;
  const { pts } = planPoints(r, a, b, PAL_UI);
  const tbl = r.method === "ACM"
    ? `<h3 class="panel-title">Liaison variables-axes (η²)</h3><p class="panel-sub">Proche de 1 : la variable structure l'axe.</p><div class="scroll"><table class="tbl"><thead><tr><th>Variable</th>${range(S).map(k => `<th>η² axe ${k + 1}</th>`).join("")}</tr></thead><tbody>${r.vars.map((v, j) => `<tr><td>${esc(v)}</td>${range(S).map(k => `<td style="${r.eta2[j][k] >= .3 ? `color:var(--a${Math.min(k, 2) + 1});font-weight:600` : ""}">${fr(r.eta2[j][k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<h3 class="panel-title">${esc(r.rowName)} et ${esc(r.colName.toLowerCase())}</h3><p class="panel-sub">Seuils : ${fr(100 / r.I, 1)} % (lignes), ${fr(100 / r.J, 1)} % (colonnes).</p><div class="scroll"><table class="tbl"><thead><tr><th>Élément</th>${range(S).map(k => `<th>F${k + 1}</th>`).join("")}${range(S).map(k => `<th>CTR ${k + 1}</th>`).join("")}</tr></thead><tbody>${r.rowL.map((l, i) => `<tr><td>${esc(l)}</td>${range(S).map(k => `<td>${frs(r.F[i][k], 3)}</td>`).join("")}${range(S).map(k => `<td>${fr(r.rctr[i][k], 1)}</td>`).join("")}</tr>`).join("")}${r.colL.map((l, j) => `<tr><td><b>${esc(l)}</b></td>${range(S).map(k => `<td>${frs(r.G[j][k], 3)}</td>`).join("")}${range(S).map(k => `<td>${fr(r.cctr[j][k], 1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return `<div class="grid2"><div class="card wide"><div class="rowhead"><div><h3 class="panel-title">${r.method === "ACM" ? "Carte des modalités" : "Représentation simultanée"}</h3><p class="panel-sub" style="margin:0">${r.method === "ACM" ? "Deux modalités proches sont souvent choisies par les mêmes individus (points gris)." : "Une ligne proche d'une colonne : association plus fréquente qu'au hasard."}</p></div>${planPicker(r.q)}</div><div class="svgbox">${svgPlan(pts, a, b, r, PAL_UI)}</div></div><div class="card wide">${tbl}</div></div>`;
}
function pIndividus(r) {
  if (r.method === "AFC") return pVariables(r);
  const [a, b] = state.plan[1] < r.q ? state.plan : [0, 1], gi = groupIndex(r);
  const indPts = r.method === "AFDM" ? planPoints(r, a, b, PAL_UI, false).pts : r.method === "ACM" ? svgRows(r.n).map(i => ({ v: r.F[i], label: r.names[i], col: gi ? PAL_UI.g[gi.idx[i] % 10] : PAL_UI.a[1], r: r.n > 800 ? 2.2 : 3.5 })) : planPoints(r, a, b, PAL_UI).pts;
  const arrows = hasQ(r) ? r.coord.map((c, j) => ({ v: c, label: r.vars[j], col: PAL_UI.a[dominantAxis(r.vcos2[j], r.nAxes)] })) : null;
  const S = r.nAxes, q = state.search.toLowerCase(); let rows = range(r.n).filter(i => r.names[i].toLowerCase().includes(q));
  if (state.sort) { const [key, dir] = state.sort; rows.sort((x, y) => dir * (key === "name" ? r.names[x].localeCompare(r.names[y], "fr") : key.startsWith("F") ? r.F[x][+key.slice(1)] - r.F[y][+key.slice(1)] : r.ctr[x][+key.slice(1)] - r.ctr[y][+key.slice(1)])); }
  // pagination : le tableau n'affiche que les premieres lignes (tri et recherche portent sur toutes)
  const totalRows = rows.length, limit = state.indLimit || 300; rows = rows.slice(0, limit);
  return `<div class="grid2"><div class="card wide"><div class="rowhead"><div><h3 class="panel-title">${hasQ(r) ? "Représentation superposée" : "Carte des individus"}</h3><p class="panel-sub" style="margin:0">${hasQ(r) ? "Un individu placé dans la direction d'une flèche a une valeur élevée pour cette variable." : "Points colorés selon la variable choisie dans les réglages."}</p></div>${planPicker(r.q)}</div><div class="svgbox">${svgPlan(indPts, a, b, r, PAL_UI, { arrows })}</div></div>
    <div class="card wide"><div class="rowhead"><h3 class="panel-title">Tous les individus</h3><input class="search" id="searchInd" type="search" placeholder="Rechercher un individu" value="${esc(state.search)}" aria-label="Rechercher un individu"></div>
    <div class="scroll"><table class="tbl" id="indTable"><thead><tr><th data-sort="name">Individu</th>${gi ? `<th>${state.colorMode === "clusters" && state.clusters ? "Classe" : esc(r.color)}</th>` : ""}${range(S).map(k => `<th data-sort="F${k}">F${k + 1}</th>`).join("")}<th>cos² 1·2</th>${range(S).map(k => `<th data-sort="C${k}">CTR ${k + 1}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(i => `<tr data-ind="${i}" class="${state.sel.has(i) ? "insel" : ""}"><td>${esc(r.names[i])}</td>${gi ? `<td style="font-family:var(--f-body)">${esc(gi.cats[gi.idx[i]])}</td>` : ""}${range(S).map(k => `<td>${frs(r.F[i][k])}</td>`).join("")}<td>${fr(r.cos2[i][0] + (r.cos2[i][1] || 0))}</td>${range(S).map(k => `<td style="${hasQ(r) && r.ctr[i][k] > 100 / r.n ? `color:var(--a${Math.min(k, 2) + 1});font-weight:600` : ""}">${fr(r.ctr[i][k], 1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${totalRows > rows.length ? `<div class="more"><span class="mono muted">${rows.length.toLocaleString("fr-FR")} lignes affichées sur ${totalRows.toLocaleString("fr-FR")}</span><button class="btn sm" type="button" data-act="more">Afficher ${Math.min(300, totalRows - rows.length)} de plus</button></div>` : ""}</div></div>`;
}

/* ------------------------------------------------------------------ simulateur (individu supplementaire) */
const Sim = {
  init(r) {
    if (state.sim && state.sim.method === r.method) return;
    const topMod = (j, vars) => { let best = -1; r.mods.forEach((m, i) => { if (r.modCol[i] === j && (best < 0 || r.eff[i] > r.eff[best])) best = i; }); return best; };
    if (r.method === "AFDM") state.sim = { method: "AFDM", vals: r.mu.slice(), pick: r.qvars.map((v, j) => topMod(j)) };
    else if (r.method === "ACP") state.sim = { method: "ACP", vals: r.mu.slice() };
    else if (r.method === "ACM") state.sim = { method: "ACM", pick: r.vars.map((v, j) => { let best = -1; r.mods.forEach((m, i) => { if (r.modCol[i] === j && (best < 0 || r.eff[i] > r.eff[best])) best = i; }); return best; }) };
    else state.sim = { method: "AFC", counts: r.colL.map((_, j) => Math.round(r.c[j] * r.n / r.I)) };
  },
  input(r) { return r.method === "AFDM" ? { vals: state.sim.vals, pick: state.sim.pick } : r.method === "ACP" ? state.sim.vals : r.method === "ACM" ? state.sim.pick : state.sim.counts; },
  update() {
    const r = state.res; if (!state.sim) return; const pr = projectSupp(r, Sim.input(r)), nb = neighbors(r, pr.F, 3);
    Stage.setGhost(pr.F, Stage.idxOf(r.method === "AFC" ? "row" : "ind", nb.map(o => o.i)));
    const out = $("#simOut"); if (!out) return; const S = Math.min(r.q, 3);
    out.innerHTML = `<div class="coords">${range(S).map(k => { const f = pr.F[k], sq = Math.sqrt(r.vals[k]), side = Math.abs(f) > sq ? `nettement côté ${f > 0 ? "+" : "−"}` : Math.abs(f) > sq / 2 ? `plutôt côté ${f > 0 ? "+" : "−"}` : "proche du centre";
        return `<div style="--c:var(--a${k + 1})"><span>AXE ${k + 1}${axisName(k) ? " · " + esc(axisName(k)) : ""}</span><b class="mono">${frs(f)}</b><small>${side}</small></div>`; }).join("")}</div>
      <p class="panel-sub" style="margin:12px 0 6px">${sum(pr.F.map(f => f * f)) < 1e-8 ? "Le point est exactement au centre de gravité : c'est le profil moyen, sa qualité de représentation (cos²) n'est pas définie. Bougez un curseur." : `Qualité sur le plan 1·2 : <b class="mono">cos² = ${fr(pr.cos2[0] + (pr.cos2[1] || 0))}</b>${hasQ(r) ? ` · sur ${pl(r.nAxes, "axe")} : <b class="mono">${fr(sum(pr.cos2.slice(0, r.nAxes)))}</b>` : ""}`}</p>
      <h3 class="panel-title" style="font-size:13px;margin-top:14px">Voisins les plus proches</h3>${nb.map(o => `<div class="nb" data-nb="${o.i}"><span>${esc(o.name)}</span><span>d = ${fr(o.d)}</span></div>`).join("")}
      <p class="panel-sub" style="margin-top:12px">Le point doré se déplace en direct dans l'espace 3D. Il est projeté sur les axes déjà calculés, sans les modifier : c'est un individu supplémentaire, au sens du cours.</p>`;
  },
};
function pSim(r) {
  Sim.init(r); let rows = "";
  const selQ = (vars, off) => vars.map((v, j) => `<div class="sim-row"><label for="simq${j}">${esc(v)}</label><select id="simq${j}" data-simq="${j}">${r.mods.map((m, i) => r.modCol[i] === j ? `<option value="${i}" ${state.sim.pick[j] === i ? "selected" : ""}>${esc(r.modName[i])}</option>` : "").join("")}</select></div>`).join("");
  if (hasQ(r)) rows = r.vars.map((v, j) => { const lo = r.min[j], hi = r.max[j], span = hi - lo || 1, st = span / 200, val = state.sim.vals[j];
    return `<div class="sim-row"><label for="sim${j}" title="${esc(v)}">${esc(v)}</label><input type="range" id="sim${j}" data-sim="${j}" min="${lo - span * .15}" max="${hi + span * .15}" step="${st}" value="${val}"><output id="simv${j}">${fr(val, Math.abs(val) >= 100 ? 0 : 2)}</output></div>`; }).join("") + (r.method === "AFDM" ? selQ(r.qvars) : "");
  else if (r.method === "ACM") rows = r.vars.map((v, j) => `<div class="sim-row"><label for="sim${j}">${esc(v)}</label><select id="sim${j}" data-simq="${j}">${r.mods.map((m, i) => r.modCol[i] === j ? `<option value="${i}" ${state.sim.pick[j] === i ? "selected" : ""}>${esc(r.modName[i])}</option>` : "").join("")}</select></div>`).join("");
  else rows = r.colL.map((c, j) => { const mx = maxOf(r.N.map(row => row[j])) * 1.5; return `<div class="sim-row"><label for="sim${j}">${esc(c)}</label><input type="range" id="sim${j}" data-sim="${j}" min="0" max="${Math.ceil(mx)}" step="1" value="${state.sim.counts[j]}"><output id="simv${j}">${state.sim.counts[j]}</output></div>`; }).join("");
  const start = r.method === "AFC" ? "" : r.n <= 500 ? `<div class="field" style="margin-top:0"><label for="simFrom">Partir d'un individu existant</label><select id="simFrom"><option value="">—</option>${r.names.map((nm, i) => `<option value="${i}">${esc(nm)}</option>`).join("")}</select></div>`
    : `<div class="field" style="margin-top:0"><label for="simFromName">Partir d'un individu existant (nom exact, puis Entrée)</label><input id="simFromName" placeholder="ex. ${esc(r.names[0])}" autocomplete="off"></div>`;
  return `<div class="sim"><div class="card"><h3 class="panel-title">${r.method === "AFC" ? "Nouvelle ligne à projeter" : "Nouvel individu à projeter"} <span class="beyond">en direct</span></h3>
      <p class="panel-sub">${r.method === "AFDM" ? "Réglez les valeurs et choisissez les modalités : le point se place aussitôt dans l'espace factoriel." : r.method === "ACP" ? "Réglez les valeurs : le point se place aussitôt dans l'espace factoriel." : r.method === "ACM" ? "Choisissez une modalité par variable : le point se place au barycentre de ses modalités." : "Réglez les effectifs par colonne : la ligne se place selon son profil."}</p>
      ${start}<div style="margin-top:8px">${rows}</div><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn sm" type="button" data-act="simReset">Réinitialiser</button><button class="btn sm" type="button" data-act="simView">Voir dans la 3D</button></div></div>
    <div class="card"><h3 class="panel-title">Position sur les axes</h3><p class="panel-sub">Mise à jour à chaque réglage.</p><div id="simOut"></div></div></div>`;
}

/* ------------------------------------------------------------------ labo (au-dela du cours) */
const Labo = {
  key: r => `${r.method}|${r.n}|${(r.vars || r.colL).join(",")}|${r.nAxes}`,
  autostart() { const r = state.res; if (!state.labo || state.labo.key !== Labo.key(r)) { state.labo = { key: Labo.key(r), boot: null, horn: null, prog: 0, running: false, sil: null, k: null }; Labo.clusterScan(); Labo.run(); } },
  async run() {
    const r = state.res, L = state.labo; if (L.running) return; L.running = true; const t0 = performance.now(); const tot = r.method === "ACP" ? 2 : 1; let part = 0;
    const onP = p => { L.prog = (part + p) / tot; const bar = $("#laboProg"); if (bar) bar.style.width = (L.prog * 100).toFixed(1) + "%"; const tx = $("#laboProgTxt"); if (tx) tx.textContent = `${Math.round(L.prog * 100)} %`; };
    if (r.method === "ACP") { L.horn = await runHorn(r, 200, onP); part = 1; }
    L.boot = await runBoot(r, 300, onP); L.ms = performance.now() - t0; L.running = false;
    if (state.tab === "labo" && state.labo === L) renderPanel();
  },
  clusterScan() {
    const r = state.res, L = state.labo; if (r.method === "AFC") return; const P = r.F.map(f => f.slice(0, r.nAxes)), rnd = mulberry(3), sIdx = P.length > 5000 ? sampleRows(P.length, 5000, 21) : null, Ps = sIdx ? sIdx.map(i => P[i]) : P;
    // grands tableaux : k-means sur un echantillon de 5 000 individus, puis chaque individu est affecte au centre le plus proche
    L.sil = range(7).map(i => { const k = i + 2; if (k >= r.n) return null; const km0 = kmeans(Ps, k, rnd, sIdx ? 4 : 8), km = sIdx ? { ...km0, labels: assignNearest(P, km0.centers) } : km0; return { k, s: silhouette(P, km.labels, k), km }; }).filter(Boolean); L.sampled = !!sIdx;
    const best = L.sil.reduce((a, b) => (b.s > a.s ? b : a), L.sil[0]); L.k = best?.k ?? 3;
  },
  applyClusters(on) {
    const r = state.res, L = state.labo, sel = L.sil.find(s => s.k === L.k); if (!sel) return;
    state.clusters = { k: L.k, labels: sel.km.labels, n: r.n }; state.colorMode = on ? "clusters" : "groups"; state.enc.color = on ? "clusters" : "groups"; renderEnc();
    Stage.build(r, "morph"); renderHeader(); renderPanel();
  },
};
function pLabo(r) {
  const L = state.labo || {}, v = r.method === "ACP" ? validity(r) : null;
  const boot = L.boot ? `<div class="svgbox" style="max-width:820px;margin:0 auto">${svgScree(r, PAL_UI, 640, 300, { lo: L.boot.lo, hi: L.boot.hi, horn: L.horn })}</div>
      <div class="scroll" style="margin-top:12px"><table class="tbl"><thead><tr><th>Axe</th><th>λ</th><th>IC 95 % bootstrap (corrigé du biais)</th>${L.horn ? "<th>Seuil du hasard</th>" : ""}<th>P(λ > seuil)</th></tr></thead><tbody>${r.vals.slice(0, Math.min(8, L.boot.lo.length)).map((x, k) => `<tr><td>Axe ${k + 1}</td><td>${fr(x, 3)}</td><td>${fr(L.boot.lo[k], 3)} – ${fr(L.boot.hi[k], 3)}</td>${L.horn ? `<td style="${x > L.horn[k] ? "color:var(--ok)" : "color:var(--warn)"}">${fr(L.horn[k], 3)}</td>` : ""}<td>${Math.round(L.boot.above[k] * 100)} %</td></tr>`).join("")}</tbody></table></div>
      <p class="sentence">${(() => { const robust = range(r.nAxes).filter(k => L.boot.lo[k] > r.threshold), fragile = range(r.nAxes).filter(k => L.boot.lo[k] <= r.threshold); return `${robust.length ? `<b>${robust.map(k => "Axe " + (k + 1)).join(", ")}</b> : l'intervalle reste au-dessus du seuil, ${robust.length > 1 ? "ces axes sont solides" : "cet axe est solide"}. ` : ""}${fragile.length ? `<b>${fragile.map(k => "Axe " + (k + 1)).join(", ")}</b> : l'intervalle touche le seuil, ${fragile.length > 1 ? "ces axes sont à confirmer" : "cet axe est à confirmer"} sur plus de données.` : ""}${L.horn ? ` Analyse parallèle : ${pl(r.vals.filter((x, k) => x > L.horn[k]).length, "axe")} au-dessus de ce que donnerait le hasard.` : ""}`; })()}</p>
      <p class="panel-sub">${L.boot.B} tirages bootstrap${L.boot.m < L.boot.N ? ` « m parmi n » (m = ${L.boot.m} sur ${L.boot.N}, écarts remis à l'échelle √(m/n))` : ""}${L.horn ? ` · 200 tableaux aléatoires (Horn${r.n > MBOOT ? `, calculés pour n = ${MBOOT} : seuils prudents` : ""})` : ""} · calculés en ${fr(L.ms / 1000, 2)} s dans votre navigateur.</p>`
    : `<div class="prog"><i id="laboProg" style="width:${(L.prog || 0) * 100}%"></i></div><p class="panel-sub mono">Rééchantillonnage en cours · <span id="laboProgTxt">${Math.round((L.prog || 0) * 100)} %</span></p>`;
  let clus = `<p class="panel-sub">La classification porte sur les individus : elle n'est pas proposée pour un tableau croisé.</p>`;
  if (r.method !== "AFC" && L.sil) {
    const sel = L.sil.find(s => s.k === L.k), lab = sel.km.labels, K = L.k, on = state.colorMode === "clusters" && state.clusters?.k === K;
    let prof = "";
    if (hasQ(r)) { const acc = range(K).map(() => new Float64Array(r.p)), cnt = new Array(K).fill(0); for (let i = 0; i < r.n; i++) { const c = lab[i], x = r.X[i], a = acc[c]; cnt[c]++; for (let j = 0; j < r.p; j++) a[j] += (x[j] - r.mu[j]) / r.sdPop[j]; }
      const Mz = acc.map((a, c) => Array.from(a, v => v / (cnt[c] || 1)));
      prof = `<div class="svgbox" style="margin-top:10px">${svgHeat(Mz, range(K).map(c => `Classe ${c + 1} · ${lab.filter(l => l === c).length}`), r.vars, PAL_UI, { rot: true, w: 640, cell: v => ({ t: frs(v, 1), f: v / 1.6 }) })}</div><p class="panel-sub">Moyenne de chaque classe en écarts-types : bleu au-dessus de la moyenne générale, orange en dessous.</p>`; }
    else { prof = `<div class="scroll" style="margin-top:10px"><table class="tbl"><thead><tr><th>Classe</th><th>Effectif</th><th>Modalités sur-représentées</th></tr></thead><tbody>${range(K).map(c => { const mem = range(r.n).filter(i => lab[i] === c);
      const over = r.mods.map((m, j) => ({ m, x: mem.filter(i => r.answers[i][r.modCol[j]] === r.modName[j]).length / (mem.length || 1) / (r.eff[j] / r.n) })).sort((a, b) => b.x - a.x).slice(0, 3);
      return `<tr><td>Classe ${c + 1}</td><td>${mem.length}</td><td style="font-family:var(--f-body);white-space:normal">${over.map(o => `${esc(o.m)} (×${fr(o.x, 1)})`).join(" · ")}</td></tr>`; }).join("")}</tbody></table></div>`; }
    clus = `<div class="rowhead"><div class="planpick">${L.sil.map(s => `<button type="button" data-k="${s.k}" aria-pressed="${s.k === K}">k = ${s.k}</button>`).join("")}</div><button class="btn ${on ? "prime" : ""} sm" type="button" data-act="clusters">${on ? "Couleurs d'origine" : "Colorer la 3D par classe"}</button></div>
      <div class="svgbox" style="max-width:640px">${svgSil(L.sil.map(s => ({ k: s.k, s: s.s })), K, PAL_UI)}</div>
      <p class="panel-sub">Silhouette moyenne : plus elle est haute, mieux les classes sont séparées. Meilleur score ici : <b>k = ${L.sil.reduce((a, b) => (b.s > a.s ? b : a)).k}</b>.</p>${prof}`;
  }
  const valid = v ? `<div class="stat"><div><span>Bartlett</span><b class="mono">χ² = ${fr(v.chi2, 1)}</b><small>${v.ddl} ddl · p ${v.pval < 0.001 ? "< 0,001" : "= " + fr(v.pval, 3)} : ${v.pval < .05 ? "corrélations non nulles, l'ACP a du sens" : "corrélations trop faibles"}</small></div>
      <div><span>Indice KMO</span><b class="mono">${fr(v.kmo, 3)}</b><small>${v.kmo >= .8 ? "excellent" : v.kmo >= .7 ? "bon" : v.kmo >= .6 ? "moyen" : v.kmo >= .5 ? "acceptable" : "insuffisant"} · un KMO modeste signale des liens par petits blocs</small></div></div>` : "";
  return `<div class="grid2">
    <div class="card wide"><h3 class="panel-title">Stabilité des valeurs propres <span class="beyond">au-delà du cours</span></h3><p class="panel-sub">On tire au hasard des échantillons à partir de vos données et on recalcule l'analyse à chaque fois : les barres d'erreur montrent l'intervalle où tombent 95 % des valeurs propres, recentré sur la valeur observée (correction du biais).</p>${boot}</div>
    ${v ? `<div class="card wide"><h3 class="panel-title">Validité de l'ACP <span class="beyond">au-delà du cours</span></h3><p class="panel-sub">Deux tests classiques avant une ACP.</p>${valid}</div>` : ""}
    <div class="card wide"><h3 class="panel-title">Classification k-means sur les axes retenus <span class="beyond">au-delà du cours</span></h3><p class="panel-sub">Regroupe les individus proches dans l'espace factoriel (${pl(r.nAxes, "axe")}), puis compare les découpages de 2 à 8 classes.</p>${clus}</div>
  </div>`;
}

/* ------------------------------------------------------------------ rapport */
function reportModel(r) {
  const S = r.nAxes, P = PAL_PAPER, secs = [], it = state.inter;
  secs.push({ t: "En bref", b: [{ ul: brief(r, it).map(x => x[0]) }, { kp: r.method === "AFC" ? [["Effectif total", String(r.n)], ["Lignes × colonnes", `${r.I} × ${r.J}`], ["Axes retenus", String(S)], ["Inertie conservée", pc(r.cum[S - 1])]] : [["Individus", String(r.n)], [r.method === "ACP" || r.method === "AFDM" ? "Variables" : "Modalités", String(r.method === "ACP" ? r.p : r.method === "AFDM" ? r.p + r.K : r.M)], ["Axes retenus", String(S)], ["Information conservée", pc(r.cum[S - 1])]] }] });
  if (r.method === "ACP") {
    secs.push({ t: "1. Les données", b: [{ p: `L'analyse porte sur <b>${r.n} individus</b> décrits par <b>${r.p} variables quantitatives</b>.${r.removed ? ` ${pl(r.removed, "ligne incomplète a été retirée", "lignes incomplètes ont été retirées")}.` : ""} Les unités diffèrent : l'ACP est <b>normée</b> (données centrées-réduites).` },
      { table: [["Variable", "Moyenne", "Écart-type", "Min", "Max", "CV"], ...r.vars.map((v, j) => [esc(v), fr(r.mu[j]), fr(r.sd[j]), fr(r.min[j]), fr(r.max[j]), r.mu[j] ? fr(r.sd[j] / Math.abs(r.mu[j]) * 100, 0) + " %" : "—"])], cap: "Statistiques descriptives (CV = écart-type ÷ moyenne)." }] });
    secs.push({ t: "2. La méthode", b: [{ table: [["Étape", "Règle utilisée"], ["Nombre d'axes", "Critère de Kaiser (λ ≥ 1) et critère du coude"], ["Variables qui construisent un axe", `Contribution > 1/p = ${fr(100 / r.p, 1)} % ; le signe de la coordonnée donne le côté`], ["Individus qui construisent un axe", "Coordonnée au-delà de ±√λ"], ["Qualité de représentation", "cos² proche de 1 = bien représenté ; prudence près du centre"]] }] });
    const allPos = r.R.every((row, i) => row.every((v, j) => j <= i || v > 0));
    secs.push({ t: "3. Les corrélations", b: [{ svg: heatCorr(r, P), cap: "Bleu : corrélation positive ; orange : négative." }, { p: allPos ? "<b>Effet taille probable</b> : toutes les corrélations sont positives." : "<b>Pas d'effet taille</b> : toutes les corrélations ne sont pas positives ; les axes opposeront des groupes de variables (effet forme)." }] });
  } else if (r.method === "AFDM") {
    secs.push({ t: "1. Les données", b: [{ p: `L'analyse porte sur <b>${r.n} individus</b> décrits par <b>${r.p} variables quantitatives</b> et <b>${r.K} qualitatives</b> (${r.M} modalités).${r.removed ? ` ${pl(r.removed, "ligne incomplète a été retirée", "lignes incomplètes ont été retirées")}.` : ""} L'AFDM les analyse ensemble : quantitatives centrées-réduites, modalités pondérées pour que chaque variable pèse au plus 1 sur un axe.` },
      { table: [["Variable", "Moyenne", "Écart-type", "Min", "Max"], ...r.vars.map((v, j) => [esc(v), fr(r.mu[j]), fr(r.sd[j]), fr(r.min[j]), fr(r.max[j])])], cap: "Variables quantitatives." },
      { table: [["Modalité", "Effectif", "%"], ...r.mods.map((m, j) => [esc(m), String(r.eff[j]), fr(r.eff[j] / r.n * 100, 1)])], cap: "Variables qualitatives." }] });
    secs.push({ t: "2. La méthode", b: [{ table: [["Étape", "Règle utilisée"], ["Nombre d'axes", "Valeur propre au-dessus de la moyenne (λ ≥ 1) et critère du coude"], ["Variables liées à un axe", "r² (quantitative) ou η² (qualitative), de 0 à 1 ; leur somme sur un axe vaut λ"], ["Éléments qui construisent un axe", `Contribution > 100/(p + M) = ${fr(100 / (r.p + r.M), 1)} % ; le signe donne le côté`], ["Individus qui construisent un axe", "Coordonnée au-delà de ±√λ"]] }] });
    secs.push({ t: "3. Les liaisons entre variables", b: [{ svg: svgLinkMap(r, 0, 1, P), cap: "Carré des liaisons, plan (1, 2)." }].concat(r.p >= 2 ? [{ svg: heatCorr(r, P), cap: "Corrélations entre variables quantitatives." }] : []) });
  } else if (r.method === "ACM") {
    const rares = r.mods.filter((m, j) => r.eff[j] / r.n < .05);
    secs.push({ t: "1. Les données", b: [{ p: `L'analyse porte sur <b>${r.n} individus</b> décrits par <b>${r.K} variables qualitatives</b>, soit <b>${r.M} modalités</b>.${r.removed ? ` ${pl(r.removed, "ligne incomplète a été retirée", "lignes incomplètes ont été retirées")}.` : ""}` },
      { table: [["Modalité", "Effectif", "%"], ...r.mods.map((m, j) => [esc(m), String(r.eff[j]), fr(r.eff[j] / r.n * 100, 1)])] }, { p: rares.length ? `<b>Modalités rares (< 5 %)</b> : ${esc(liste(rares))}.` : "Aucune modalité rare." }] });
    secs.push({ t: "2. La méthode", b: [{ table: [["Étape", "Règle utilisée"], ["Nombre d'axes", `Valeur propre > 1/K = ${fr(1 / r.K, 3)} et critère du coude`], ["Modalités qui construisent un axe", `Contribution > 100/M = ${fr(100 / r.M, 1)} % ; le signe donne le côté`], ["Variables liées à un axe", "Rapport de corrélation η² (de 0 à 1)"], ["Qualité de représentation", "cos² proche de 1"]] }] });
  } else {
    secs.push({ t: "1. Les données", b: [{ table: [[esc(r.rowName), ...r.colL.map(esc), "Total"], ...r.rowL.map((l, i) => [esc(l), ...r.N[i].map(x => String(Math.round(x))), String(Math.round(sum(r.N[i])))])], cap: "Effectifs observés." }] });
    secs.push({ t: "2. La méthode", b: [{ table: [["Étape", "Règle utilisée"], ["Liaison", "Test du χ² d'indépendance (p < 0,05 : variables liées)"], ["Nombre d'axes", "Valeur propre > inertie moyenne et critère du coude"], ["Lignes", `Contribution > 100/I = ${fr(100 / r.I, 1)} %`], ["Colonnes", `Contribution > 100/J = ${fr(100 / r.J, 1)} %`]] }] });
    secs.push({ t: "3. Test du χ² et écarts à l'indépendance", b: [{ p: `χ² = ${fr(r.chi2, 1)} pour ${r.ddl} degrés de liberté, p ${r.pval < .001 ? "< 0,001" : "= " + fr(r.pval, 3)} : ${r.pval < .05 ? "<b>la liaison est significative</b>." : "<b>pas de liaison significative</b>."}` }, { svg: heatRatio(r, P), cap: "Effectif observé ÷ attendu − 1." }] });
  }
  const nb = r.method === "ACM" ? 3 : 4;
  secs.push({ t: `${nb}. Combien d'axes garder ?`, b: [{ svg: svgScree(r, P), cap: "Barres pleines : axes retenus." }, { table: [["Axe", "Valeur propre", "% d'inertie", "% cumulé"], ...r.vals.slice(0, 10).map((v, i) => [String(i + 1), fr(v, 3), fr(r.pct[i], 1), fr(r.cum[i], 1)])] },
    { ul: [`<b>${r.method === "ACP" ? "Critère de Kaiser" : r.method === "AFDM" ? "Valeur propre moyenne (λ ≥ 1)" : r.method === "ACM" ? "Seuil 1/K" : "Inertie moyenne"} : ${pl(r.rule, "axe")}.</b>`, `<b>Critère du coude : ${pl(r.coude, "axe")}.</b>`, `<b>Choix retenu : ${pl(S, "axe")}.</b>`] }] });
  const vis = [[0, 1]].concat(r.q >= 3 && S >= 3 ? [[0, 2]] : []);
  if (r.method === "AFDM") secs.push({ t: "5. Les variables", b: vis.map(([a, b]) => ({ svg: svgCircle(r, a, b, P), cap: `Cercle des corrélations (quantitatives), plan (${a + 1}, ${b + 1}).` })).concat(vis.map(([a, b]) => ({ svg: svgPlan(planPoints(r, a, b, P).pts, a, b, r, P), cap: `Carte des modalités, plan (${a + 1}, ${b + 1}).` })), [{ table: [["Variable", "Type", ...range(S).map(k => `Liaison axe ${k + 1}`)], ...r.link.map(l => [esc(l.v), l.type === "q" ? "r²" : "η²", ...range(S).map(k => fr(l.r2[k]))])] }]) });
  else if (r.method === "ACP") secs.push({ t: "5. Les variables", b: vis.map(([a, b]) => ({ svg: svgCircle(r, a, b, P), cap: `Cercle des corrélations, plan (${a + 1}, ${b + 1}).` })).concat([{ table: [["Variable", ...range(S).map(k => `Coord. ${k + 1}`), ...range(S).map(k => `CTR ${k + 1} (%)`), `cos² ${S} axes`], ...r.vars.map((v, j) => [esc(v), ...range(S).map(k => frs(r.coord[j][k])), ...range(S).map(k => fr(r.vctr[j][k], 1)), fr(sum(r.vcos2[j].slice(0, S)))])] }]) });
  else secs.push({ t: `${nb + 1}. ${r.method === "ACM" ? "Carte des modalités" : "Représentation simultanée"}`, b: vis.map(([a, b]) => ({ svg: svgPlan(planPoints(r, a, b, P).pts, a, b, r, P), cap: `Plan (${a + 1}, ${b + 1}).` })) });
  const ib = []; it.forEach(x => { const nm = axisName(x.k); ib.push({ h3: `Axe ${x.k + 1} (${pc(r.pct[x.k])})${nm ? " : " + esc(nm) : ""}` });
    const nmax = Math.max(x.main.minus.length, x.main.plus.length, 1), lab = r.method === "ACP" ? "Variables" : r.method === "AFDM" ? "Éléments" : r.method === "ACM" ? "Modalités" : esc(r.rowName);
    ib.push({ table: [[`${lab} côté −`, `${lab} côté +`], ...range(nmax).map(i => [x.main.minus[i] ? `${esc(x.main.minus[i].l)} (${fr(x.main.minus[i].c, 1)} %)` : "", x.main.plus[i] ? `${esc(x.main.plus[i].l)} (${fr(x.main.plus[i].c, 1)} %)` : ""])] });
    if (hasQ(r)) ib.push({ table: [[`Individus côté − (< −${fr(Math.sqrt(r.vals[x.k]))})`, `Individus côté + (> +${fr(Math.sqrt(r.vals[x.k]))})`], [esc(liste(x.indM, 12, x.nM)), esc(liste(x.indP, 12, x.nP))]] });
    ib.push({ p: axisPhrase(r, x) }); });
  secs.push({ t: `${hasQ(r) ? 6 : nb + 2}. Interprétation des axes`, b: ib });
  if (r.method !== "AFC") { const gi = groupIndex(r), pp = hasQ(r) ? planPoints(r, 0, 1, P, false).pts : svgRows(r.n).map(i => ({ v: r.F[i], label: r.names[i], col: gi ? P.g[gi.idx[i] % 10] : P.a[1], r: r.n > 800 ? 2.2 : 3.5 }));
    secs.push({ t: `${hasQ(r) ? 7 : nb + 3}. ${hasQ(r) ? "Représentation superposée" : "Carte des individus"}`, b: [{ svg: svgPlan(pp, 0, 1, r, P, { arrows: hasQ(r) ? r.coord.map((c, j) => ({ v: c, label: r.vars[j], col: P.a[dominantAxis(r.vcos2[j], r.nAxes)] })) : null }), cap: "Plan (1, 2)." }] }); }
  const lim = [r.method === "ACP" ? "L'ACP montre des liens linéaires, pas des relations de cause à effet." : r.method === "AFDM" ? "L'AFDM décrit des liaisons (linéaires pour les quantitatives), pas des relations de cause à effet." : "L'analyse décrit des associations, pas des causes."];
  if (r.method !== "AFC" && r.n < 30) lim.push(`Seulement ${r.n} individus : résultats à confirmer sur un échantillon plus grand.`);
  if (r.method === "ACM") lim.push("Les pourcentages d'inertie d'une ACM sont faibles par construction.");
  secs.push({ t: "Ce qu'on retient", b: [{ ul: it.map(x => axisPhrase(r, x)) }, { p: "<b>Limites</b>" }, { ul: lim }] });
  return secs;
}
function reportHTML(r, forExport) {
  const secs = reportModel(r), title = `Rapport ${r.method} : ${state.example ? EXEMPLES[state.example].label : state.source.replace(/\.[^.]+$/, "")}`;
  const names = { AFDM: "Analyse factorielle de données mixtes", ACP: "Analyse en composantes principales", ACM: "Analyse des correspondances multiples", AFC: "Analyse factorielle des correspondances" };
  const body = secs.map(s => `<h2>${esc(s.t)}</h2>` + s.b.map(b => b.p ? `<p>${b.p}</p>` : b.ul ? `<ul>${b.ul.map(x => `<li>${x}</li>`).join("")}</ul>` : b.h3 ? `<h3>${b.h3}</h3>` : b.kp ? `<div class="kp">${b.kp.map(([l, v]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`
    : b.table ? `<table><thead><tr>${b.table[0].map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${b.table.slice(1).map(row => `<tr>${row.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>${b.cap ? `<div class="cap">${b.cap}</div>` : ""}`
    : b.svg ? `<div class="fig">${b.svg}${b.cap ? `<div class="cap">${b.cap}</div>` : ""}</div>` : "").join("")).join("");
  const head = `<div class="eyebrow">${names[r.method]} · Prisme</div><h1>${esc(title)}</h1><div class="meta">${new Date().toLocaleDateString("fr-FR")} · Données : ${esc(state.source)}</div>`;
  if (!forExport) return head + body;
  const css = `body{margin:0;background:#fff;color:#1B2030;font:15px/1.6 "Instrument Sans","Segoe UI",Arial,sans-serif}main{max-width:900px;margin:0 auto;padding:48px 28px 72px}.eyebrow{font:600 11px/1 "Instrument Sans",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8A6634}h1{font:600 32px/1.15 Unbounded,"Segoe UI",sans-serif;margin:10px 0 6px;color:#0D1222}h2{font:600 20px/1.25 Unbounded,"Segoe UI",sans-serif;margin:36px 0 10px;padding-top:14px;border-top:1px solid #E6E1D6;color:#0D1222}h3{font-size:15px;margin:20px 0 6px;color:#0D1222}.meta{color:#6B7185;font-size:13px}table{border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0 4px}th{background:#F6F2EA;text-align:left}th,td{border:1px solid #E6E1D6;padding:5px 8px;vertical-align:top}.cap{font-size:12px;color:#6B7185;font-style:italic}.fig{margin:14px 0;break-inside:avoid}.fig svg{max-width:100%;height:auto}.kp{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.kp div{flex:1 1 140px;border:1px solid #E6E1D6;border-radius:10px;padding:10px 12px;background:#FBF8F2}.kp b{display:block;font:500 22px/1.1 Unbounded,"Segoe UI",sans-serif}.kp span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6B7185}footer{margin-top:40px;color:#6B7185;font-size:12px}@media print{h2{break-before:page}}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600&family=JetBrains+Mono&family=Unbounded:wght@500;600&display=swap"><style>${css}</style></head><body><main>${head}${body}<footer>Rapport généré par Prisme. Pour un PDF : ouvrez ce fichier dans un navigateur, puis Ctrl + P et « Enregistrer au format PDF ».</footer></main></body></html>`;
}
function pRapport(r) {
  return `<div class="paper-wrap"><div class="paper-actions"><button class="btn prime" type="button" data-act="export"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>Télécharger le rapport (HTML)</button>
    <button class="btn" type="button" data-act="csv">Coordonnées (CSV)</button><button class="btn" type="button" data-act="json" title="Valeurs propres, coordonnées, contributions, classes et insights, pour un pipeline de données">Résultats (JSON)</button><button class="btn" type="button" data-act="png">Vue 3D (PNG)</button><button class="btn" type="button" data-act="copy">Copier le texte</button><span class="muted" style="font-size:12.5px">Le HTML s'ouvre dans un navigateur ; Ctrl + P pour l'enregistrer en PDF.</span></div>
    <article class="paper" id="paper">${reportHTML(r, false)}</article></div>`;
}
let downloadsNS;
async function saveFile(filename, data) {
  if (!data) return;
  try { if (window.claude?.use) { downloadsNS ??= await window.claude.use("downloads"); if (downloadsNS) { await downloadsNS.save({ filename, data }); toast("Fichier prêt : " + filename); return; } } } catch (e) { if (e?.code === "declined") return toast("Téléchargement annulé."); if (e?.code === "rate_limited") return toast("Une demande est déjà en cours."); }
  const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv" : filename.endsWith(".json") ? "application/json" : "text/html" });
  const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); toast("Téléchargement lancé : " + filename);
}
function exportCSV(r) {
  const S = Math.min(r.q, 5), sep = ";", L = [], num = (x, d) => fr(x, d).replace(/−/g, "-").replace(/\s/g, ""), f = x => num(x, 4);
  if (r.method === "AFC") { L.push(["Element", "Type", ...range(S).map(k => "F" + (k + 1))].join(sep)); r.rowL.forEach((l, i) => L.push([l, "ligne", ...r.F[i].slice(0, S).map(f)].join(sep))); r.colL.forEach((l, j) => L.push([l, "colonne", ...r.G[j].slice(0, S).map(f)].join(sep))); }
  else { L.push(["Individu", ...range(S).map(k => "F" + (k + 1)), ...range(S).map(k => "CTR" + (k + 1)), "cos2_plan12"].join(sep)); r.names.forEach((nm, i) => L.push([nm, ...r.F[i].slice(0, S).map(f), ...r.ctr[i].slice(0, S).map(x => num(x, 3)), f(r.cos2[i][0] + (r.cos2[i][1] || 0))].join(sep)));
    if (hasM(r)) { L.push(""); L.push(["Modalite", ...range(S).map(k => "F" + (k + 1))].join(sep)); r.mods.forEach((m, j) => L.push([m, ...r.G[j].slice(0, S).map(f)].join(sep))); } }
  return "﻿" + L.join("\n");
}
async function capturePNG() { const b = await Stage.capture(); if (!b) return toast("Capture indisponible sans 3D."); const r = state.res; saveFile(`prisme_${r.method}_vue3d.png`, b); }

/* ------------------------------------------------------------------ fiche */
UI.fiche = (it, nbrs = []) => {
  const box = $("#fiche"); if (!it) { box.hidden = true; return; } const r = state.res; let body = "";
  if (hasQ(r) && it.kind === "ind") { const z = r.X[it.i].map((x, j) => (x - r.mu[j]) / r.sdPop[j]), gi = groupIndex(r);
    body = `<div class="sub">${gi ? esc(gi.cats[gi.idx[it.i]]) + " · " : ""}profil en écarts-types à la moyenne</div>` + r.vars.map((v, j) => { const zz = clamp(z[j], -3, 3), w = Math.abs(zz) / 3 * 50;
      return `<div class="zrow"><span title="${esc(v)}">${esc(v)}</span><span class="zbar"><i style="left:${zz < 0 ? 50 - w : 50}%;width:${w}%;background:${zz < 0 ? "var(--neg)" : "var(--pos)"}"></i></span><span class="mono" style="text-align:right">${fr(r.X[it.i][j], Math.abs(r.X[it.i][j]) >= 100 ? 0 : 2)}</span></div>`; }).join("") + (r.method === "AFDM" ? r.qvars.map((v, j) => `<div class="zrow" style="grid-template-columns:110px 1fr"><span>${esc(v)}</span><span>${esc(r.answers[it.i][j])}</span></div>`).join("") : ""); }
  else if (r.method === "ACM" && it.kind === "ind") body = `<div class="sub">Réponses</div>` + r.vars.map((v, j) => `<div class="zrow" style="grid-template-columns:110px 1fr"><span>${esc(v)}</span><span>${esc(r.answers[it.i][j])}</span></div>`).join("");
  else if (it.kind === "sup") { const v = r.supp.quali.find(q => q.name === it.ref[0]), m = v.mods[it.ref[1]]; body = `<div class="sub">Modalité illustrative · ${m.n} individus · ne participe pas au calcul des axes</div>` + range(Math.min(r.q, 3)).map(k => `<div class="zrow" style="grid-template-columns:110px 1fr 50px"><span>Valeur-test axe ${k + 1}</span><span class="zbar"><i style="left:${m.vtest[k] < 0 ? 50 - clamp(Math.abs(m.vtest[k]) * 8, 0, 50) : 50}%;width:${clamp(Math.abs(m.vtest[k]) * 8, 0, 50)}%;background:${m.vtest[k] < 0 ? "var(--neg)" : "var(--pos)"}"></i></span><span class="mono">${frs(m.vtest[k], 1)}</span></div>`).join("") + `<div class="sub" style="margin-top:8px">|v| > 2 : la modalité est significativement du côté indiqué de l'axe.</div>`; }
  else if (it.kind === "mod") body = `<div class="sub">${r.eff[it.i]} individus (${fr(r.eff[it.i] / r.n * 100, 1)} %)</div>` + range(Math.min(r.nAxes, 3)).map(k => `<div class="zrow" style="grid-template-columns:110px 1fr 50px"><span>Contribution axe ${k + 1}</span><span class="zbar"><i style="left:0;width:${clamp(r.mctr[it.i][k] * 3, 0, 100)}%;background:var(--a${k + 1})"></i></span><span class="mono">${fr(r.mctr[it.i][k], 1)} %</span></div>`).join("");
  else { const isRow = it.kind === "row", ratios = isRow ? r.ratio[it.i] : r.ratio.map(row => row[it.i]), labs = isRow ? r.colL : r.rowL;
    body = `<div class="sub">Sur- et sous-représentations (observé ÷ attendu − 1)</div>` + labs.map((l, j) => { const e = ratios[j] - 1, w = clamp(Math.abs(e) * 50, 0, 50); return `<div class="zrow"><span title="${esc(l)}">${esc(l)}</span><span class="zbar"><i style="left:${e < 0 ? 50 - w : 50}%;width:${w}%;background:${e < 0 ? "var(--neg)" : "var(--pos)"}"></i></span><span class="mono" style="text-align:right">${e >= 0 ? "+" : "−"}${Math.round(Math.abs(e) * 100)} %</span></div>`; }).join(""); }
  const nbh = nbrs.length ? `<h4>Voisins les plus proches</h4>` + nbrs.map(o => `<div class="nb" data-sel="${Stage.items.indexOf(o)}"><span>${esc(o.label)}</span><span>d = ${fr(o.target.distanceTo(it.target) / (9 / maxOf(Stage.items.map(p => maxOf(p.v.slice(0, 3).map(Math.abs))))), 2)}</span></div>`).join("") : "";
  box.innerHTML = `<header><h3>${esc(it.label)}</h3><button class="x" type="button" aria-label="Fermer la fiche">×</button></header>${body}${nbh}`; box.hidden = false;
};

/* ------------------------------------------------------------------ tour guide */
const Tour = {
  active: false, i: 0, steps: [], timer: null, DUR: 7500,
  build() {
    const r = state.res, it = state.inter, S = Math.min(r.nAxes, 3), who = r.method === "AFC" ? `${r.I} ${r.rowName.toLowerCase()} et ${r.J} ${r.colName.toLowerCase()}` : `${r.n} individus`;
    const st = [{ title: "L'espace factoriel", text: `${esc(who)} projetés dans l'espace des ${pl(S, "premier axe", "premiers axes")} : <b>${pc(r.cum[S - 1])}</b> de l'information.`, view: "3d", focus: null }];
    it.slice(0, S).forEach((x, k) => {
      let idx = [];
      if (hasQ(r)) idx = Stage.idxOf("ind", x.idxM.concat(x.idxP));
      else if (r.method === "ACM") idx = Stage.idxOf("mod", r.mods.map((m, j) => j).filter(j => r.mctr[j][k] > 100 / r.M));
      else idx = Stage.idxOf("row", r.rowL.map((_, i) => i).filter(i => r.rctr[i][k] > 100 / r.I)).concat(Stage.idxOf("col", r.colL.map((_, j) => j).filter(j => r.cctr[j][k] > 100 / r.J)));
      st.push({ title: `Axe ${k + 1} · ${pc(r.pct[k])}${axisName(k) ? " · " + esc(axisName(k)) : ""}`, text: axisPhrase(r, x).replace(/^<b>[^<]*<\/b> : /, "") + (hasQ(r) && (x.indM.length || x.indP.length) ? ` Individus en avant : ${esc(liste(x.indM.concat(x.indP), 5, x.nM + x.nP))}.` : ""), view: k === 2 ? "13" : "12", focus: { axis: k, idx, arrows: false } });
    });
    if (hasQ(r)) st.push({ title: "Les variables", text: `Les flèches sont les corrélations des variables avec les axes. ${brief(r, it).at(-1)[0]}`, view: "3d", focus: { axis: null, idx: [], arrows: true } });
    st.push({ title: "À retenir", text: brief(r, it)[0][0], view: "3d", focus: null });
    return st;
  },
  start() { if (!state.res || !Stage.ok) return; if (Stage.mode !== "normal") Stage.exitHyper(); this.steps = this.build(); this.active = true; this.go(0); },
  stop() { this.active = false; clearTimeout(this.timer); $("#tour").hidden = true; Stage.setFocus(null); Stage.setView("3d"); },
  go(i) {
    if (i < 0) i = 0; if (i >= this.steps.length) return this.stop(); this.i = i; const s = this.steps[i]; clearTimeout(this.timer);
    Stage.setView(s.view); Stage.setFocus(s.focus);
    const box = $("#tour"); box.hidden = false;
    box.innerHTML = `<div class="step">ÉTAPE ${i + 1} / ${this.steps.length} · TOUR GUIDÉ</div><h3>${s.title}</h3><p>${s.text}</p><div class="ctl"><button class="btn sm" type="button" data-tour="prev" ${i === 0 ? "disabled" : ""}>←</button><div class="prog"><i></i></div><button class="btn sm" type="button" data-tour="next">${i === this.steps.length - 1 ? "Terminer" : "→"}</button><button class="btn sm" type="button" data-tour="stop" aria-label="Fermer le tour">×</button></div>`;
    const bar = box.querySelector(".prog i"); requestAnimationFrame(() => { bar.style.transition = reduced ? "none" : `width ${this.DUR}ms linear`; bar.style.width = "100%"; });
    this.timer = setTimeout(() => this.go(this.i + 1), this.DUR);
  },
};

/* ------------------------------------------------------------------ palette de commandes */
const Palette = {
  sel: 0, list: [],
  cmds() {
    const r = state.res, C = [];
    [["3d", "Vue 3D", "1"], ["12", "Vue plan 1·2", "2"], ["13", "Vue plan 1·3", "3"], ["23", "Vue plan 2·3", "4"]].forEach(([v, l, k]) => C.push({ l, k, g: "Vue", run: () => Stage.setView(v) }));
    [["cible", "Cible : ce qui explique une variable (arbre de décision)"], ["comparer", "Comparer deux groupes"], ["temps", "Temps : évolution par période"], ["synthese", "Synthèse"], ["axes", "Axes"], ["variables", "Variables"], ["individus", "Individus"], ["insights", "Insights automatiques"], ["projections", "Projections : ACP, t-SNE, UMAP"], ["classes", "Classes (HCPC)"], ["matrices", "Matrices : scagnostics et Bertin"], ["profil", "Profil des données"], ["simulateur", "Simulateur d'individu"], ["labo", "Labo : bootstrap, Horn, k-means"], ["hyper", "Hyperespace : coordonnées parallèles, flux, réseau, Shepard"], ["rapport", "Rapport"]].forEach(([t, l]) => C.push({ l: "Ouvrir " + l, g: "Onglet", run: () => { state.tab = t; renderPanel(); $("#tabs").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); } }));
    ["ACP", "ACM", "AFC"].forEach(m => C.push({ l: "Méthode " + m, g: "Analyse", run: () => setMethod(m) }));
    Object.entries(EXEMPLES).forEach(([k, e]) => C.push({ l: `Charger l'exemple « ${e.label} »`, g: "Données", run: () => loadTable(parseCSV(e.csv, e.file), e.file, k) }));
    C.push({ l: "Importer un fichier", g: "Données", run: () => $("#fileInput").click(), big: true });
    if (BigUI.s) C.push({ l: `Tableau de bord grands volumes (${fmtBig(BigUI.s.n)} lignes)`, g: "Données", big: true, run: () => { BigUI.show(true); requestAnimationFrame(() => BigUI.draw()); } });
    if (Stage.canHyper("tour")) C.push({ l: "Tour de l'hyperespace (Grand Tour)", k: "H", g: "Hyperespace", run: () => Stage.startHyper("tour") }, { l: "Converger vers le point de vue de l'ACP", k: "C", g: "Hyperespace", run: () => { if (Stage.mode !== "tour") Stage.startHyper("tour"); Stage.hyCmd("pca"); } });
    if (Stage.canHyper("anat")) C.push({ l: "Anatomie de l'ACP : brut, centré, réduit, tourné", k: "A", g: "Hyperespace", run: () => Stage.startHyper("anat") });
    encOptions(r).col.forEach(([v, l]) => C.push({ l: "Couleur : " + l, g: "Encodage", run: () => setEnc("color", v) })); encOptions(r).size.forEach(([v, l]) => C.push({ l: "Taille : " + l, g: "Encodage", run: () => setEnc("size", v) }));
    C.push({ l: "Lasso : sélectionner dans la 3D", k: "L", g: "Sélection", run: () => toggleLasso() }, { l: "Expliquer la sélection", k: "E", g: "Sélection", run: () => (state.sel.size ? explainSelection() : toast("Sélectionnez d'abord des points (Maj + glisser dans la 3D).")) }, { l: "Effacer la sélection", g: "Sélection", run: () => Sel.clear() });
    if (r.method !== "AFC") C.push({ l: "Arbre hiérarchique 3D (HCPC)", g: "Classes", run: () => { setEnc("color", "hcpc"); Stage.showTree(Studio.ensureHC()); } });
    C.push({ l: "Enregistrer le projet (.prisme.json)", g: "Projet", run: saveProject }, { l: "Ouvrir un projet", g: "Projet", run: () => $("#projInput").click() }, { l: "Méthodes et références", g: "Aide", run: showAbout });
    C.push({ l: "Lancer le tour guidé", k: "T", g: "Présentation", run: () => Tour.start() }, { l: "Rejouer la projection", k: "Espace", g: "Scène", run: () => Stage.replay() }, { l: "Capturer la vue 3D (PNG)", g: "Scène", run: capturePNG }, { l: "Plein écran", k: "F", g: "Scène", run: fullscreen });
    Object.entries({ names: "noms", drops: "projections", bary: "barycentres", rotate: "rotation", arrows: "flèches des variables", sphere: "sphère des corrélations", net: "réseau (arbre couvrant)", dens: "relief de densité", unc: "nuages d'incertitude" }).forEach(([k, l]) => C.push({ l: `Afficher ou masquer : ${l}`, g: "Scène", run: () => toggle(k) }));
    C.push({ l: "Télécharger le rapport (HTML)", g: "Export", run: () => saveFile(`rapport_${r.method}.html`, reportHTML(r, true)) }, { l: "Télécharger les coordonnées (CSV)", g: "Export", run: () => saveFile(`coordonnees_${r.method}.csv`, exportCSV(r)) }, { l: "Changer de thème", g: "Affichage", run: () => $("#themeBtn").click() });
    return C;
  },
  open() { $("#palette").hidden = false; const i = $("#palInput"); i.value = ""; this.sel = 0; this.render(""); i.focus(); },
  close() { $("#palette").hidden = true; },
  render(q) {
    const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), words = norm(q).split(/\s+/).filter(Boolean);
    this.list = this.cmds().filter(c => words.every(w => norm(c.l + " " + c.g).includes(w))); this.sel = clamp(this.sel, 0, Math.max(0, this.list.length - 1));
    $("#palList").innerHTML = this.list.map((c, i) => `<li role="option" data-i="${i}" aria-selected="${i === this.sel}"><span>${esc(c.l)}<small>${esc(c.g)}</small></span>${c.k ? `<span class="kbd">${c.k}</span>` : ""}</li>`).join("") || `<li>Aucune commande</li>`;
    $("#palList").querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  },
  exec(i) { const c = this.list[i]; if (!c) return; this.close(); if (BigUI.open_ && !c.big) BigUI.show(false); c.run(); },
};

/* ------------------------------------------------------------------ demarrage anime */
function boot() {
  const b = $("#boot"), log = $("#bootLog"), r = state.res; if (reduced || !r || !Stage.ok) return;
  const e = r.engine, t = state.table, ty = state.types;
  const lines = [`<b>›</b> Prisme · moteur d'analyse factorielle`, `<b>›</b> lecture     ${esc(state.source)} · ${t.rows.length} lignes × ${t.columns.length} colonnes`,
    `<b>›</b> types       ${ty.quanti.length} quantitatives · ${ty.quali.length} qualitatives${ty.ident ? " · identifiant " + esc(ty.ident) : ""}`, `<b>›</b> méthode     ${r.method} (suggestion : ${esc(state.why)})`,
    `<b>›</b> décomposition  ${e.alg} ${e.mat} · ${e.sweeps} balayages · ${fr(e.ms, 2)} ms`, `<b>›</b> contrôle    Σλ = ${fr(e.trace, 4)} <i>✓</i> · ‖VᵀV − I‖ = ${sci(e.ortho)} <i>✓</i>`,
    `<b>›</b> projection  ${r.method === "AFC" ? r.I + r.J : r.n} points → ${pl(Math.min(r.q, 3), "axe")} · ${pc(r.cum[Math.min(r.q, 3) - 1])}`,
    `<b>›</b> hyperespace R<sup>${r.q}</sup> · Grand Tour géodésique · arbre couvrant · densité de Scott <i>✓</i>`,
    `<b>›</b> studio      sélection liée · valeurs-tests · HCPC · t-SNE / UMAP · scagnostics · insights <i>✓</i>`];
  b.hidden = false; log.innerHTML = ""; let i = 0;
  const step = () => { if (i < lines.length) { log.innerHTML += (i ? "\n" : "") + lines[i++]; setTimeout(step, 115); } else setTimeout(() => { b.classList.add("done"); setTimeout(() => (b.hidden = true), 650); }, 280); };
  step();
}

/* ------------------------------------------------------------------ evenements */
function setEnc(kind, v) { state.enc[kind] = v; if (kind === "color") state.colorMode = ["clusters", "hcpc", "user"].includes(v) ? v : "groups"; if (v === "hcpc") Studio.ensureHC(); renderEnc(); Stage.build(state.res, "morph"); renderHeader(); if (["individus", "hyper", "projections", "matrices", "classes"].includes(state.tab)) renderPanel(); }
function toggleLasso() { const on = !Stage.lassoOn; Stage.setLasso(on); document.querySelector('[data-tool="lasso"]')?.setAttribute("aria-pressed", on); toast(on ? "Lasso actif : entourez des points dans la 3D (Échap pour quitter)." : "Lasso désactivé."); }
function markSelRows() { document.querySelectorAll("#indTable tr[data-ind]").forEach(tr => tr.classList.toggle("insel", state.sel.has(+tr.dataset.ind))); }
function saveProject() {
  const r = state.res; if (!r) return; const proj = { format: "prisme-studio", version: 1, saved: new Date().toISOString(), source: state.source, example: state.example, table: state.example ? null : state.table,
    method: state.method, params: state.params, prep: state.prep, supp: state.supp, enc: state.enc, axisNames: state.axisNames, calVar: state.calVar, hcOpts: state.hcOpts, groups: state.groups.map(g => ({ name: g.name, idx: [...g.idx] })) };
  saveFile((state.source || "projet").replace(/\.[^.]+$/, "") + ".prisme.json", JSON.stringify(proj));
}
function openProject(text, name) {
  let pj; try { pj = JSON.parse(text); } catch (e) { return toast("Fichier de projet illisible."); } if (pj.format !== "prisme-studio") return toast("Ce fichier n'est pas un projet Prisme Studio.");
  const table = pj.example && EXEMPLES[pj.example] ? parseCSV(EXEMPLES[pj.example].csv, EXEMPLES[pj.example].file) : pj.table; if (!table) return toast("Le projet ne contient pas de données.");
  state.table = table; state.types = detect(table); state.source = pj.source || name; state.example = pj.example || null; state.method = pj.method; state.params = pj.params; state.prep = pj.prep || { missing: "drop", tr: {} }; state.supp = pj.supp || { quanti: [], quali: [] };
  state.enc = pj.enc || { color: "groups", size: "uniform" }; state.axisNames = pj.axisNames || {}; state.calVar = pj.calVar || null; state.hcOpts = pj.hcOpts || { k: null, dims: null, consol: true };
  state.why = suggest(table, state.types)[1]; renderRail(); run("project"); state.groups = (pj.groups || []).map(g => ({ name: g.name, idx: new Set(g.idx) })); if (state.groups.length) { renderEnc(); Stage.build(state.res, "none"); }
  toast(`Projet « ${state.source} » ouvert.`);
}
function toggle(k) { if (k === "unc" && state.res?.method !== "ACP") return; const v = !Stage.show[k]; Stage.setShow(k, v); document.querySelectorAll(`#toggles [data-k="${k}"]`).forEach(b => b.setAttribute("aria-pressed", v)); }
function fullscreen() { const s = $("#stage"); if (document.fullscreenElement) document.exitFullscreen?.(); else s.requestFullscreen?.().catch(() => toast("Plein écran indisponible ici.")); }
function bind() {
  $("#examples").addEventListener("click", e => { const b = e.target.closest("[data-ex]"); if (!b) return; const ex = EXEMPLES[b.dataset.ex]; loadTable(parseCSV(ex.csv, ex.file), ex.file, b.dataset.ex); });
  const fi = $("#fileInput"), drop = $("#drop");
  const take = async f => { if (!f) return;
    if (bigKind(f.name) && ($("#bigForce").checked || await isBigFile(f))) { try { await BigUI.open({ file: f }); } catch (e) { $("#errBox").hidden = false; $("#errBox").textContent = e.message; } return; }
    if (f.size > BIG_THRESHOLD) toast("Fichier volumineux : cochez « Grands volumes » pour le lire en flux (plusieurs millions de lignes).");
    try { setBusy(`lecture de ${f.name} (${fr(f.size / 1048576, 1)} Mo)`); await new Promise(r => setTimeout(r, 30)); const t0 = performance.now(), t = await readFile(f); setBusy("calcul de l'analyse"); await new Promise(r => setTimeout(r, 30)); loadTable(t, f.name, null); setBusy(null); toast(`${f.name} : ${t.rows.length.toLocaleString("fr-FR")} lignes × ${t.columns.length} colonnes, lues et analysées en ${fr((performance.now() - t0) / 1000, 1)} s`); } catch (e) { setBusy(null); $("#errBox").hidden = false; $("#errBox").textContent = e.message; } };
  $("#urlForm").addEventListener("submit", async e => { e.preventDefault(); const u = $("#urlIn").value.trim(); if (!u) return;
    if ($("#bigForce").checked || await isBigURL(u)) { try { await BigUI.open({ url: u, force: true }); } catch (err) { $("#errBox").hidden = false; $("#errBox").textContent = err.message; } return; }
    try { setBusy("chargement depuis l'URL"); await PrismeAPI.loadURL(u); setBusy(null); toast(`${state.source} chargé depuis l'URL.`); } catch (err) { setBusy(null); $("#errBox").hidden = false; $("#errBox").textContent = err.message + " (le serveur doit autoriser l'accès, en-tête CORS)."; } });
  $("#importBtn").onclick = () => fi.click(); drop.onclick = () => fi.click(); drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fi.click(); } };
  fi.onchange = () => { take(fi.files[0]); fi.value = ""; };
  ["dragenter", "dragover"].forEach(ev => document.addEventListener(ev, e => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); drop.classList.add("over"); } }));
  ["dragleave", "drop"].forEach(ev => document.addEventListener(ev, e => { if (ev === "dragleave" && e.relatedTarget) return; drop.classList.remove("over"); }));
  document.addEventListener("drop", e => { if (e.dataTransfer?.files?.length) { e.preventDefault(); take(e.dataTransfer.files[0]); } });
  $("#methodSeg").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) setMethod(b.dataset.m); });
  $("#varsBox").addEventListener("click", e => {
    const c = e.target.closest("[data-var]"); if (c) { const v = c.dataset.var, p = state.params; p.vars = p.vars.includes(v) ? p.vars.filter(x => x !== v) : [...p.vars, v].sort((a, b) => state.table.columns.indexOf(a) - state.table.columns.indexOf(b)); c.setAttribute("aria-pressed", p.vars.includes(v)); state.axisNames = {}; run("morph"); return; }
    const m = e.target.closest("[data-mode]"); if (m) { state.params.mode = m.dataset.mode; renderRail(); run("project"); }
  });
  $("#varsBox").addEventListener("change", e => { const k = e.target.dataset.p; if (!k) return; const v = e.target.value; state.params[k] = k === "nAxes" ? (v ? +v : null) : v || null; if (k === "rowName" || k === "colName") state.params[k] = v || (k === "rowName" ? "Lignes" : "Colonnes"); run(k === "nAxes" || k === "color" || k.endsWith("Name") ? "none" : "morph"); });
  $("#views").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b) return; if (b.dataset.v === "hyper") Stage.mode === "tour" ? Stage.exitHyper() : Stage.startHyper("tour"); else Stage.setView(b.dataset.v); });
  $("#encBox").addEventListener("change", e => { if (e.target.id === "encColor") setEnc("color", e.target.value); if (e.target.id === "encSize") setEnc("size", e.target.value); if (e.target.id === "calSel") { state.calVar = e.target.value || null; Stage.refreshCal(); renderHeader(); } });
  bindSelection(); bindStudio(); bindAnalyses(); BigUI.bind();
  $("#bigBack").onclick = () => { BigUI.show(true); requestAnimationFrame(() => BigUI.draw()); };
  document.addEventListener("prisme:sel", () => { if (state.tab === "hyper") Hyper.syncSel?.(); if (state.tab === "projections") ProjUI.redraw(); if (state.tab === "matrices") MatUI.redraw(); if (state.tab === "individus") markSelRows(); });
  document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) { e.preventDefault(); state.tab = g.dataset.goto; renderPanel(); $("#tabs").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); } });
  $("#projBtn").onclick = e => { e.stopPropagation(); $("#projMenu").hidden = !$("#projMenu").hidden; }; document.addEventListener("click", e => { if (!e.target.closest("#projMenu")) $("#projMenu").hidden = true; });
  $("#projMenu").addEventListener("click", e => { const b = e.target.closest("[data-pm]"); if (!b) return; $("#projMenu").hidden = true; if (b.dataset.pm === "save") saveProject(); if (b.dataset.pm === "open") $("#projInput").click(); if (b.dataset.pm === "about") showAbout(); });
  $("#projInput").onchange = async () => { const f = $("#projInput").files[0]; $("#projInput").value = ""; if (f) openProject(await f.text(), f.name); };
  $("#about").addEventListener("click", e => { if (e.target.id === "about" || e.target.closest(".ab-x")) $("#about").hidden = true; });
  document.querySelector(".tools").addEventListener("click", e => { const b = e.target.closest("[data-tool]"); if (!b) return; const t = b.dataset.tool;
    if (t === "lasso") toggleLasso(); if (t === "replay") Stage.replay(); if (t === "tour") Tour.active ? Tour.stop() : Tour.start(); if (t === "capture") capturePNG(); if (t === "full") fullscreen(); if (t === "anat") Stage.mode === "anat" ? Stage.exitHyper() : Stage.startHyper("anat"); });
  $("#toggles").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) toggle(b.dataset.k); });
  $("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; state.tab = b.dataset.t; renderPanel(); });
  $("#tour").addEventListener("click", e => { const b = e.target.closest("[data-tour]"); if (!b) return; const a = b.dataset.tour; if (a === "prev") Tour.go(Tour.i - 1); if (a === "next") Tour.go(Tour.i + 1); if (a === "stop") Tour.stop(); });
  $("#panel").addEventListener("click", e => {
    const pp = e.target.closest("[data-plan]"); if (pp) { state.plan = [+pp.dataset.plan[0], +pp.dataset.plan[1]]; renderPanel(); return; }
    const tr = e.target.closest("[data-ind]"); if (tr) { Stage.selectRef("ind", +tr.dataset.ind); document.querySelectorAll("#indTable tr.sel").forEach(x => x.classList.remove("sel")); tr.classList.add("sel"); $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); return; }
    const th = e.target.closest("[data-sort]"); if (th) { const k = th.dataset.sort; state.sort = state.sort && state.sort[0] === k ? [k, -state.sort[1]] : [k, k === "name" ? 1 : -1]; renderPanel(); return; }
    const nb = e.target.closest("[data-nb]"); if (nb) { Stage.selectRef(state.res.method === "AFC" ? "row" : "ind", +nb.dataset.nb); return; }
    const kb = e.target.closest("[data-k]"); if (kb && state.labo) { state.labo.k = +kb.dataset.k; if (state.colorMode === "clusters") Labo.applyClusters(true); else renderPanel(); return; }
    const a = e.target.closest("[data-act]"); if (!a) return; const r = state.res, base = (state.example ? EXEMPLES[state.example].file : state.source).replace(/\.[^.]+$/, "");
    if (a.dataset.act === "export") saveFile(`rapport_${r.method}_${base}.html`, reportHTML(r, true));
    if (a.dataset.act === "csv") saveFile(`coordonnees_${r.method}_${base}.csv`, exportCSV(r));
    if (a.dataset.act === "more") { state.indLimit = (state.indLimit || 300) + 300; renderPanel(); return; }
    if (a.dataset.act === "json") saveFile(`resultats_${r.method}_${base}.json`, JSON.stringify(resultsJSON(r), null, 1));
    if (a.dataset.act === "png") capturePNG();
    if (a.dataset.act === "copy") { const txt = $("#paper").innerText; navigator.clipboard?.writeText(txt).then(() => toast("Texte du rapport copié."), () => { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($("#paper")); s.removeAllRanges(); s.addRange(rg); toast("Texte sélectionné : Ctrl + C pour copier."); }); }
    if (a.dataset.act === "simReset") { state.sim = null; renderPanel(); }
    if (a.dataset.act === "simView") $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (a.dataset.act === "clusters") Labo.applyClusters(!(state.colorMode === "clusters"));
  });
  $("#panel").addEventListener("input", e => {
    if (e.target.id === "searchInd") { state.search = e.target.value; const pos = e.target.selectionStart; renderPanel(); const s = $("#searchInd"); s.focus(); s.setSelectionRange(pos, pos); return; }
    const j = e.target.dataset.sim; if (j !== undefined && state.sim) { const v = +e.target.value; if (hasQ(state.res)) state.sim.vals[+j] = v; else state.sim.counts[+j] = Math.round(v); const o = $("#simv" + j); if (o) o.textContent = hasQ(state.res) ? fr(v, Math.abs(v) >= 100 ? 0 : 2) : Math.round(v); Sim.update(); return; }
    const k = e.target.dataset.axis; if (k === undefined) return; state.axisNames[+k] = e.target.value; clearTimeout(bind.t);
    bind.t = setTimeout(() => { renderHeader(); Stage.build(state.res, "none"); document.querySelectorAll(".axis-card .sentence").forEach((p, i) => (p.innerHTML = axisPhrase(state.res, state.inter[i]))); }, 250);
  });
  $("#panel").addEventListener("change", e => {
    const q = e.target.dataset.simq; if (q !== undefined && state.sim) { state.sim.pick[+q] = +e.target.value; Sim.update(); return; }
    if ((e.target.id === "simFrom" && e.target.value !== "") || (e.target.id === "simFromName" && state.res.names.includes(e.target.value.trim()))) { const r = state.res, i = e.target.id === "simFrom" ? +e.target.value : r.names.indexOf(e.target.value.trim()); if (r.method === "AFDM") { state.sim.vals = r.X[i].slice(); state.sim.pick = r.answers[i].map((a, j) => r.mods.findIndex((m, t) => r.modCol[t] === j && r.modName[t] === a)); } else if (r.method === "ACP") state.sim.vals = r.X[i].slice(); else state.sim.pick = r.answers[i].map((a, j) => r.mods.findIndex((m, t) => r.modCol[t] === j && r.modName[t] === a)); renderPanel(); }
  });
  $("#exportTop").onclick = () => { state.tab = "rapport"; renderPanel(); $("#tabs").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); };
  $("#fiche").addEventListener("click", e => { if (e.target.closest(".x")) { $("#fiche").hidden = true; Stage.select(-1); return; } const nb = e.target.closest("[data-sel]"); if (nb) Stage.select(+nb.dataset.sel); });
  $("#cmdBtn").onclick = () => Palette.open();
  $("#palette").addEventListener("click", e => { if (e.target.id === "palette") return Palette.close(); const li = e.target.closest("[data-i]"); if (li) Palette.exec(+li.dataset.i); });
  $("#palInput").addEventListener("input", e => { Palette.sel = 0; Palette.render(e.target.value); });
  $("#palInput").addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); Palette.sel = clamp(Palette.sel + (e.key === "ArrowDown" ? 1 : -1), 0, Palette.list.length - 1); Palette.render(e.target.value); }
    if (e.key === "Enter") { e.preventDefault(); Palette.exec(Palette.sel); } if (e.key === "Escape") Palette.close();
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").hidden ? Palette.open() : Palette.close(); return; }
    if (BigUI.open_ && (e.ctrlKey || e.metaKey) && !e.target.closest?.("input, select, textarea") && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) { e.preventDefault(); return e.key.toLowerCase() === "y" || e.shiftKey ? BigUI.redo() : BigUI.undo(); }
    if (BigUI.open_) { if (e.key === "Escape") { if (!$("#palette").hidden) Palette.close(); else if (!$("#about").hidden) $("#about").hidden = true; else if (BigUI.filters.length) { BigUI.pushHist(); BigUI.filters = []; BigUI.applyFilters(); } } return; }
    if (e.key === "Escape") { if (!$("#palette").hidden) return Palette.close(); if (!$("#about").hidden) return ($("#about").hidden = true); if (Drawer.kind) return Drawer.close(); if (Tour.active) return Tour.stop(); if (Stage.mode !== "normal") return Stage.exitHyper(); if (Stage.lassoOn) return toggleLasso(); if (state.sel.size) return Sel.clear(); if (!$("#fiche").hidden) { $("#fiche").hidden = true; Stage.select(-1); } return; }
    if (e.target.closest?.("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey || !$("#palette").hidden) return;
    const k = e.key.toLowerCase();
    if (Tour.active && (k === "arrowright" || k === "arrowleft")) { e.preventDefault(); Tour.go(Tour.i + (k === "arrowright" ? 1 : -1)); return; }
    if (Stage.mode === "anat" && (k === "arrowright" || k === "arrowleft")) { e.preventDefault(); Stage.hyCmd(k === "arrowright" ? "next" : "prev"); return; }
    if (Stage.mode !== "normal" && k === " ") { e.preventDefault(); Stage.hyCmd("play"); return; }
    if (k === "h") { Stage.mode === "tour" ? Stage.exitHyper() : Stage.startHyper("tour"); return; } if (k === "a") { Stage.mode === "anat" ? Stage.exitHyper() : Stage.startHyper("anat"); return; }
    if (k === "c") { if (Stage.mode !== "tour") Stage.startHyper("tour"); Stage.hyCmd("pca"); return; }
    if (k === "m") return toggle("net"); if (k === "d") return toggle("dens"); if (k === "u") return toggle("unc");
    if (k === "l") return toggleLasso(); if (k === "e") return state.sel.size ? explainSelection() : toast("Sélectionnez d'abord des points (Maj + glisser dans la 3D).");
    const views = { "1": "3d", "2": "12", "3": "13", "4": "23" }; if (views[k]) { if (k === "3" || k === "4") { if (state.res.q < 3) return; } Stage.setView(views[k]); return; }
    if (k === "t") Tour.active ? Tour.stop() : Tour.start(); else if (k === " ") { e.preventDefault(); Stage.replay(); } else if (k === "f") fullscreen();
    else if (k === "r") toggle("rotate"); else if (k === "n") toggle("names"); else if (k === "p") toggle("drops"); else if (k === "b") toggle("bary");
  });
  $("#themeBtn").onclick = () => { const root = document.documentElement; const dk = isDark(); root.dataset.theme = dk ? "light" : "dark"; try { localStorage.setItem("prisme-theme", root.dataset.theme); } catch (e) {} };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => Stage.applyTheme());
  new MutationObserver(() => requestAnimationFrame(() => Stage.applyTheme())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

/* ------------------------------------------------------------------ demarrage */
try { const th = localStorage.getItem("prisme-theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
const TABS = ["synthese", "axes", "variables", "individus", "insights", "projections", "classes", "matrices", "hyper", "cible", "comparer", "temps", "profil", "simulateur", "labo", "rapport"];
bind(); bindAPI(); Stage.init();
{ const h = location.hash.slice(1); if (TABS.includes(h)) state.tab = h; }
(async () => {
  const fromURL = await startFromURL(); if (!TABS.includes(state.tab)) state.tab = "synthese";
  if (fromURL !== true) loadTable(parseCSV(EXEMPLES.ecommerce.csv, EXEMPLES.ecommerce.file), EXEMPLES.ecommerce.file, "ecommerce");
  else renderPanel();
  if (fromURL && fromURL.big) BigUI.open({ url: fromURL.big, force: true }).catch(e => toast(e.message));
  $("#verTag").textContent = "v" + PRISME_VERSION; boot();
  // version deployee (site) : application installable et utilisable hors ligne (seuls le code et les bibliotheques sont mis en cache, jamais les donnees)
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]')) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
