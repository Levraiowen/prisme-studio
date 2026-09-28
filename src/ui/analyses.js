
/* ============================================================================
   Onglets d'analyse : Cible (mode supervise), Comparer (deux groupes), Temps
   (dates), et carte « Qualite des donnees » de l'onglet Profil.
   ============================================================================ */
const svgBox = (w, h, cls = "") => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="${cls}" font-family="Instrument Sans, sans-serif">`;
const pctTxt = (x, d = 1) => (Number.isFinite(x) ? pc(x * 100, d) : "—");
const pTxt = p => (p < 1e-4 ? "p < 0,0001" : "p = " + fr(p, p < 0.01 ? 4 : 3));

/* ------------------------------------------------------------------ qualite des donnees */
function qualityOf() { const q = state.quality; if (q && q.table === state.table && q.rep) return q.rep; ensureQuality(); return null; }
async function ensureQuality() {
  const t = state.table; if (!t || (state.quality && state.quality.table === t)) return; state.quality = { table: t, rep: null }; setBusy("contrôle de la qualité des données");
  let rep = null;
  try { rep = Compute.worker() ? await Compute.onTable("quality", t, { types: state.types }) : null; } catch (e) { rep = null; }
  if (!rep) { await new Promise(r => setTimeout(r, 30)); try { rep = qualityReport(t, state.types); } catch (e) { rep = { issues: [{ level: "info", title: "Contrôle de qualité indisponible", detail: e.message }], score: null, dupRows: 0, dupIdx: [] }; } }
  if (state.quality?.table !== t) return; state.quality.rep = rep; setBusy(null); if (state.tab === "profil") renderPanel();
}
function qualityCard(Q) {
  if (!Q) return `<div class="card wide qual-card"><h3 class="panel-title">Qualité des données</h3><div class="prog"><i class="indet"></i></div><p class="panel-sub">Recherche des doublons, identifiants répétés, colonnes vides ou constantes, types ambigus et dates…</p></div>`;
  const chip = { haute: ["à corriger", "var(--a1)"], moyenne: ["à surveiller", "var(--amber)"], info: ["info", "var(--a2)"] };
  const act = o => o.action === "dups" ? `<button class="btn sm" type="button" data-qa="dropdups">Retirer les doublons</button><button class="btn sm" type="button" data-qa="csvdups">Exporter (CSV)</button>`
    : o.action === "iddups" ? `<button class="btn sm" type="button" data-qa="csvids" data-c="${esc(o.col)}">Exporter les lignes concernées</button>`
    : o.col && /nombres mêlés/.test(o.title) ? `<button class="btn sm" type="button" data-qa="toquanti" data-c="${esc(o.col)}">Passer en quantitative</button>` : "";
  return `<div class="card wide qual-card"><div class="rowhead"><div><h3 class="panel-title">Qualité des données</h3><p class="panel-sub" style="margin:0">${Q.issues.length ? `${pl(Q.issues.filter(o => o.level !== "info").length, "point à vérifier", "points à vérifier")} avant d'interpréter l'analyse.` : "Aucun problème détecté : pas de doublon, d'identifiant répété, de colonne vide ou de type ambigu."}</p></div></div>
    ${Q.issues.map(o => `<div class="q-issue"><span class="q-lv" style="--c:${chip[o.level][1]}">${chip[o.level][0]}</span><div><b>${esc(o.title)}</b><p>${esc(o.detail)}</p></div><div class="q-act">${act(o)}</div></div>`).join("")}</div>`;
}
function typeSel(c, isQ) {
  if (c === state.types.ident) return `<span class="ty l">identifiant</span>`;
  return `<select class="ty-sel ${isQ ? "q" : "l"}" data-type="${esc(c)}" aria-label="Type de ${esc(c)}" title="Type de la colonne : changez-le si la détection automatique se trompe"><option value="quanti" ${isQ ? "selected" : ""}>quantitative</option><option value="quali" ${!isQ ? "selected" : ""}>qualitative</option></select>`;
}
// apres une modification du tableau (type, variables derivees, doublons) : types, variables et analyse recalcules
function tableChanged(table, msg) {
  state.table = table; state.types = detect(table); state.quality = null; state.tgt = null; const ty = state.types, p = state.params;
  if (p.vars) p.vars = p.vars.filter(v => table.columns.includes(v) && (state.method === "ACP" ? ty.quanti.includes(v) : state.method === "ACM" ? !ty.quanti.includes(v) : true));
  state.supp.quanti = state.supp.quanti.filter(v => ty.quanti.includes(v)); state.supp.quali = state.supp.quali.filter(v => !ty.quanti.includes(v) && table.columns.includes(v));
  renderRail(); run("morph"); if (msg) toast(msg);
}
function exportRows(idx, name) { const t = state.table, q = v => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  saveFile(name, "﻿" + [["ligne", ...t.columns].join(";"), ...idx.map(i => [i + 2, ...t.columns.map(c => q(t.rows[i][c]))].join(";"))].join("\n")); }
function qualityAction(b) {
  const a = b.dataset.qa, Q = state.quality?.rep, t = state.table;
  if (a === "dropdups" && Q) { const drop = new Set(Q.dupIdx); tableChanged({ ...t, rows: t.rows.filter((_, i) => !drop.has(i)) }, `${Q.dupRows.toLocaleString("fr-FR")} doublons retirés du tableau de travail (le fichier d'origine n'est pas modifié).`); }
  if (a === "csvdups" && Q) exportRows(Q.dupIdx, "doublons.csv");
  if (a === "csvids") { const c = b.dataset.c, cnt = new Map(); t.rows.forEach(r => { const v = r[c]; if (v !== null && v !== undefined) cnt.set(v, (cnt.get(v) || 0) + 1); }); exportRows(range(t.rows.length).filter(i => cnt.get(t.rows[i][c]) > 1), `identifiants_repetes_${c}.csv`); }
  if (a === "toquanti") { const r = retype(t, b.dataset.c, "quanti"); tableChanged(r.table, `${b.dataset.c} passée en quantitative${r.lost ? ` (${r.lost.toLocaleString("fr-FR")} valeurs non numériques deviennent manquantes)` : ""}.`); }
}

/* ------------------------------------------------------------------ Cible (mode supervise) */
const tgtKey = () => JSON.stringify([state.target?.col, state.target?.positive ?? null, state.target?.depth || 3]);
function setTarget(col, positive = null) {
  if (!col) { state.target = null; state.tgt = null; renderPanel(); return; }
  state.target = { col, positive, depth: state.target?.depth || 3 }; state.tgt = null;
  // la cible devient illustrative : elle ne doit pas construire les axes qu'on utilise pour l'expliquer
  const p = state.params, isQ = state.types.quanti.includes(col); let moved = false;
  if (p.vars && p.vars.includes(col)) { p.vars = p.vars.filter(v => v !== col); moved = true; }
  if (state.method !== "AFC") { const L = isQ ? state.supp.quanti : state.supp.quali; if (!L.includes(col)) L.push(col); }
  if (moved) { renderRail(); run("morph"); toast(`${col} est maintenant la cible : retirée des variables actives, projetée en illustrative.`); } else renderPanel();
}
async function computeTarget() {
  const T = state.target, work = state.work, key = tgtKey(); if (!T || state.tgtBusy === key) return; state.tgtBusy = key; setBusy("mode supervisé : importance et arbre");
  const cols = work.columns.filter(c => c !== state.types.ident && c !== T.col), payload = { target: T.col, positive: T.positive, cols, depth: T.depth || 3 };
  let out;
  try { out = Compute.worker() ? await Compute.onTable("target", work, payload) : null; if (!out) { await new Promise(r => setTimeout(r, 30)); out = targetRun(work, payload); } } catch (e) { out = { err: e.message }; }
  state.tgtBusy = null; setBusy(null); if (tgtKey() !== key) return; state.tgt = { key, work, ...out }; if (!out.err && !state.tgtSel) state.tgtSel = null; if (state.tab === "cible") renderPanel();
}
function tgtY(r) {   // cible alignee sur les lignes de l'analyse (couleur de la 3D, taux par classe)
  const T = state.target; if (!T) return null; const spec = targetSpec(state.work.rows, T.col, T.positive); if (!spec) return null;
  return { spec, y: r.rowsKept ? r.rowsKept.map(i => spec.y[i]) : Array.from(spec.y) };
}
function pCible(r) {
  const T = state.target, ty = state.types, cols = state.table.columns.filter(c => c !== ty.ident);
  const binCand = cols.filter(c => { const ci = colInfo(state.work.rows, c); if (ci.isNum) { const s = new Set(); for (let i = 0; i < ci.num.length && s.size <= 2; i += Math.max(1, Math.floor(ci.num.length / 5000))) if (ci.num[i] === ci.num[i]) s.add(ci.num[i]); return s.size === 2 && [...s].every(v => v === 0 || v === 1); } return ci.cats.names.length === 2; });
  const catT = T && !ty.quanti.includes(T.col) ? colInfo(state.work.rows, T.col).cats : null;
  const head = `<div class="card wide tg-head"><div><h3 class="panel-title">Variable cible <span class="beyond">supervisé</span></h3><p class="panel-sub" style="margin:0">Choisissez ce que vous cherchez à expliquer : un défaut de paiement, un départ, un montant… Prisme classe les variables qui l'expliquent et construit un arbre de décision lisible. La cible devient illustrative : elle n'influence pas les axes.</p></div>
    <div class="tg-ctl"><label>Cible <select id="tgCol"><option value="">—</option>${cols.map(c => `<option value="${esc(c)}" ${T?.col === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      ${catT && catT.names.length > 2 && catT.names.length <= 20 ? `<label>Événement <select id="tgPos"><option value="">toutes les classes</option>${catT.names.map(n => `<option value="${esc(n)}" ${T.positive === n ? "selected" : ""}>${esc(n)} contre les autres</option>`).join("")}</select></label>` : ""}
      <label>Profondeur de l'arbre <select id="tgDepth">${[2, 3, 4, 5].map(d => `<option ${(T?.depth || 3) === d ? "selected" : ""}>${d}</option>`).join("")}</select></label></div></div>`;
  if (!T) return `<div class="grid2">${head}<div class="card wide"><h3 class="panel-title">Par où commencer</h3><p class="panel-sub">${binCand.length ? "Variables binaires repérées dans vos données, candidates naturelles :" : "Aucune variable binaire repérée : choisissez une variable numérique (montant, score) ou qualitative."}</p><div class="chips">${binCand.slice(0, 12).map(c => `<button class="chip" type="button" data-tgpick="${esc(c)}">${esc(c)}</button>`).join("")}</div></div></div>`;
  const C = state.tgt; if (!C || C.key !== tgtKey() || C.work !== state.work) { computeTarget(); return `<div class="grid2">${head}<div class="card wide"><div class="prog"><i class="indet"></i></div><p class="panel-sub">Importance de chaque variable (valeur d'information, AUC), arbre de décision…</p></div></div>`; }
  if (C.err) return `<div class="grid2">${head}<div class="card wide"><div class="err">${esc(C.err)}</div></div></div>`;
  const S = C.spec, bin = S.kind === "bin", num = S.kind === "num", L = C.imp.list, sel = L.find(o => o.col === state.tgtSel) || L.find(o => !C.leak.includes(o.col)) || L[0];
  const gl = bin ? `Taux global : <b>${pctTxt(S.mean)}</b> (${esc(S.col)} = ${esc(S.posLabel)})` : num ? `Moyenne globale : <b>${fmtNum(S.mean)}</b>` : `${S.names.length} classes`;
  const mx = maxOf(L.map(o => o.score), 1e-9), band = o => (bin ? (C.leak.includes(o.col) ? "fuite" : IV_LABEL(o.iv)) : o.score >= 0.5 ? "fort" : o.score >= 0.3 ? "moyen" : o.score >= 0.1 ? "faible" : "inutile");
  const bc = { "très fort": "var(--a2)", fuite: "var(--a1)", fort: "var(--a2)", moyen: "var(--a3)", faible: "var(--amber)", inutile: "var(--faint)" };
  const rank = `<div class="card"><h3 class="panel-title">Ce qui explique ${esc(S.col)}</h3><p class="panel-sub">${bin ? "Valeur d'information (IV, usage du scoring : < 0,02 inutile, 0,1 à 0,3 moyen, > 0,5 très fort)" : num ? "|ρ| de Spearman (quantitatives) ou √η² (qualitatives)" : "V de Cramér ou √η²"}. ${C.imp.sampled ? `Calculé sur ${C.imp.n.toLocaleString("fr-FR")} lignes tirées au hasard.` : ""} Cliquez une variable pour le détail.</p>
    ${C.leak.length ? `<div class="warnbox"><b>Fuite de données probable</b> : ${esc(liste(C.leak))} ${C.leak.length > 1 ? "prédisent" : "prédit"} presque parfaitement la cible (AUC ≥ 0,95). Souvent, ${C.leak.length > 1 ? "ces variables sont mesurées" : "la variable est mesurée"} après l'événement ou ${C.leak.length > 1 ? "le définissent" : "le définit"} : à exclure d'un modèle de prévision. L'arbre ci-dessous est construit sans ${C.leak.length > 1 ? "elles" : "elle"}.</div>` : ""}
    <div class="imp-list">${L.slice(0, 18).map(o => `<button type="button" class="imp-row ${o === sel ? "on" : ""}" data-tgsel="${esc(o.col)}"><span class="imp-n">${esc(o.col)}</span><span class="imp-bar"><i style="width:${(o.score / mx * 100).toFixed(1)}%;background:${bc[band(o)]}"></i></span><span class="imp-v mono">${bin ? fr(o.iv, 3) : fr(o.score, 3)}</span><span class="imp-b" style="color:${bc[band(o)]}">${band(o)}</span>${bin && o.auc !== undefined ? `<small class="mono muted">AUC ${fr(Math.max(o.auc, 1 - o.auc), 3)}</small>` : ""}</button>`).join("")}</div></div>`;
  // detail d'une variable : taux (ou moyenne) par decile ou par modalite
  const items = sel.type === "num" ? sel.bins.map(b => ({ l: `${fmtNum(b.lo)} – ${fmtNum(b.hi)}`, n: b.n, m: b.m })) : sel.mods.slice(0, 16).map(m => ({ l: m.l, n: m.n, m: m.m }));
  const W = 560, H = 36 + items.length * 26, mm = maxOf(items.map(i => i.m).concat([S.mean]), 1e-9), X0 = 190, XW = W - X0 - 90;
  const detail = `<div class="card"><h3 class="panel-title">${esc(sel.col)} × ${esc(S.col)}</h3><p class="panel-sub">${bin ? "Taux de l'événement" : "Moyenne de la cible"} par ${sel.type === "num" ? "décile" : "modalité"} ; trait vertical : ${bin ? "taux" : "moyenne"} global.</p>
    <div class="svgbox">${svgBox(W, H)}${items.map((it, k) => { const y = 18 + k * 26, w = XW * it.m / mm, hi = it.m > S.mean; return `<text x="${X0 - 8}" y="${y + 13}" text-anchor="end" font-size="11" style="fill:var(--text)">${esc(String(it.l).slice(0, 26))}</text><rect x="${X0}" y="${y + 2}" width="${Math.max(w, 1).toFixed(1)}" height="16" rx="4" style="fill:${hi ? "var(--a1)" : "var(--a2)"};fill-opacity:.8"/><text x="${X0 + w + 6}" y="${y + 14}" font-size="10.5" style="fill:var(--muted);font-family:var(--f-mono)">${bin ? pctTxt(it.m) : fmtNum(it.m)} · ${it.n.toLocaleString("fr-FR")}</text>`; }).join("")}<line x1="${X0 + XW * S.mean / mm}" x2="${X0 + XW * S.mean / mm}" y1="10" y2="${H - 6}" style="stroke:var(--amber)" stroke-dasharray="4 3" stroke-width="1.5"/></svg></div></div>`;
  // arbre : lignes indentees, chaque noeud avec son effectif et son taux
  const rows = []; (function walk(nd, depth) { rows.push({ nd, depth }); if (nd.left) { walk(nd.left, depth + 1); walk(nd.right, depth + 1); } })(C.tree.root, 0);
  const val = nd => (nd.valueAll ?? nd.value), vtxt = v => (bin ? pctTxt(v) : num ? fmtNum(v) : ""), rootV = bin || num ? S.mean : null;
  const tvals = rows.map(r0 => (bin || num ? val(r0.nd) : 0)).filter(Number.isFinite), tmin = minOf(tvals), tmax = maxOf(tvals);
  const tree = `<div class="card wide"><div class="rowhead"><div><h3 class="panel-title">Arbre de décision <span class="beyond">CART</span></h3><p class="panel-sub" style="margin:0">Chaque branche coupe le groupe en deux selon la variable qui ${bin ? "sépare le mieux les taux" : "sépare le mieux la cible"} (Breiman et al. 1984). ${C.tree.sampled ? `Appris sur ${C.tree.learned.toLocaleString("fr-FR")} lignes, effectifs et ${bin ? "taux" : "moyennes"} recalculés sur toutes.` : ""} ${bin && C.tree.auc ? `AUC de l'arbre : <b>${fr(C.tree.auc, 3)}</b>.` : num && C.tree.r2 !== undefined ? `R² de l'arbre : <b>${fr(C.tree.r2, 3)}</b>.` : ""}</p></div></div>
    <div class="tree">${rows.map(({ nd, depth }) => { const v = val(nd), f = Number.isFinite(v) && tmax > tmin ? (v - tmin) / (tmax - tmin) : 0.5; return `<div class="tnode ${nd.leaf !== null ? "leaf" : ""}" style="--d:${depth}"><span class="trule">${depth ? esc(nd.rule) : "Toutes les lignes"}</span><span class="tn mono">${(nd.nAll ?? nd.n).toLocaleString("fr-FR")}</span>${bin || num ? `<span class="tbar"><i style="width:${(f * 100).toFixed(1)}%;background:${ramp(f)}"></i></span><span class="tv mono">${vtxt(v)}</span>` : `<span></span><span></span>`}</div>`; }).join("")}</div>
    ${bin || num ? `<h4 class="bg-h4">Règles, de la plus à la moins ${bin ? "risquée" : "élevée"}</h4><div class="scroll"><table class="tbl"><thead><tr><th>${bin ? "Taux" : "Moyenne"}</th><th>${bin ? "× global" : "écart"}</th><th>Lignes</th><th>Règle</th></tr></thead><tbody>${C.tree.leaves.slice().sort((a, b) => val(b) - val(a)).map(lf => `<tr><td>${vtxt(val(lf))}</td><td>${bin ? "×" + fr(val(lf) / rootV, 2) : frs(val(lf) - rootV, 2)}</td><td>${(lf.nAll ?? lf.n).toLocaleString("fr-FR")}</td><td style="font-family:var(--f-body);white-space:normal">${esc(lf.path.join(" et ") || "toutes les lignes")}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`;
  // taux par classe (HCPC) et couleur de la 3D
  let cls = ""; const hc = r.method !== "AFC" ? state.hc : null;
  if (hc && hc.res === r && (bin || num)) { const Y = tgtY(r); if (Y) { const k = hc.k, s = new Float64Array(k), c = new Float64Array(k); hc.labels.forEach((l, i) => { const v = Y.y[i]; if (v === v) { s[l] += v; c[l]++; } }); const vs = range(k).map(j => (c[j] ? s[j] / c[j] : NaN)), m2 = maxOf(vs.filter(Number.isFinite), 1e-9);
    cls = `<div class="card"><h3 class="panel-title">${bin ? "Taux" : "Moyenne"} par classe (HCPC)</h3><p class="panel-sub">Les classes de l'analyse factorielle, construites sans la cible, la séparent-elles ?</p>${range(k).map(j => `<div class="dz"><span>Classe ${j + 1}</span><span class="zbar" style="background:none"><i style="left:0;width:${(vs[j] / m2 * 100).toFixed(1)}%;background:var(--g${j % 10 + 1})"></i></span><span class="mono">${vtxt(vs[j])}</span><small class="mono muted">${c[j].toLocaleString("fr-FR")} individus</small></div>`).join("")}</div>`; } }
  else if (r.method !== "AFC") cls = `<div class="card"><h3 class="panel-title">Par classe</h3><p class="panel-sub">Ouvrez l'onglet Classes pour calculer la classification, puis revenez ici.</p></div>`;
  return `<div class="grid2">${head}<div class="card wide tg-sum"><span>${gl}</span><span>${S.n.toLocaleString("fr-FR")} lignes</span><span class="mono muted">calculé en ${fr(C.ms / 1000, 1)} s</span>
      <span class="tg-act">${r.method !== "AFC" ? `<button class="btn sm" type="button" data-tgact="color">Colorer la 3D par la cible</button>` : ""}${bin ? `<button class="btn sm" type="button" data-tgact="compare">Comparer ${esc(S.posLabel)} et ${esc(S.negLabel)}</button>` : ""}</span></div>
    ${rank}${detail}${tree}${cls}</div>`;
}

/* ------------------------------------------------------------------ Comparer deux groupes */
function groupDefs(r) {
  const out = []; if (state.sel.size && r.method !== "AFC") out.push(["sel", `Sélection actuelle (${state.sel.size.toLocaleString("fr-FR")})`]);
  if (state.target && state.tgt?.spec?.kind === "bin") out.push(["target", `Cible : ${state.target.col} = ${state.tgt.spec.posLabel}`]);
  if (state.hc && state.hc.res === r) range(state.hc.k).forEach(k => out.push([`class:${k}`, `Classe ${k + 1} (HCPC, ${state.hc.sizes[k]})`]));
  if (hasQ(r)) out.push(["out", "Individus atypiques (T² ou Q)"]);
  state.types.quali.forEach(c => { const cats = colInfo(state.work.rows, c).cats; if (cats.names.length <= 12) cats.names.forEach(nm => out.push([`mod:${c}\u0001${nm}`, `${c} = ${nm}`])); });
  return out;
}
function groupRows(r, def) {   // indices des lignes du tableau de travail
  const map = i => (r.rowsKept ? r.rowsKept[i] : i);
  if (def === "sel") return [...state.sel].map(map);
  if (def === "target") { const s = targetSpec(state.work.rows, state.target.col, state.target.positive); return range(state.work.rows.length).filter(i => s.y[i] === 1); }
  if (def.startsWith("class:")) { const k = +def.slice(6); return range(state.hc.n).filter(i => state.hc.labels[i] === k).map(map); }
  if (def === "out") { const d = diagCache(r); return range(r.n).filter(i => d.T2[i] > d.ucT || (d.ucQ && d.Q[i] > d.ucQ)).map(map); }
  if (def.startsWith("mod:")) { const [c, v] = def.slice(4).split("\u0001"); return range(state.work.rows.length).filter(i => { const x = state.work.rows[i][c]; return x !== null && x !== undefined && String(x) === v; }); }
  return [];
}
function pCompare(r) {
  const defs = groupDefs(r), C = state.cmp || (state.cmp = { a: null, b: "rest" }); if (!C.a || !defs.some(d => d[0] === C.a)) C.a = defs[0]?.[0] || null;
  const opt = (cur, extra = []) => extra.concat(defs).map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("");
  const head = `<div class="card wide cmp-head"><div><h3 class="panel-title">Comparer deux groupes</h3><p class="panel-sub" style="margin:0">Quantitatives : écart des moyennes en écarts-types (d de Cohen) et test de Welch. Qualitatives : V de Cramér et écarts de proportions. Les variables sont classées par taille d'effet.</p></div>
    <div class="cmp-ctl"><label>Groupe A <select id="cmpA">${opt(C.a)}</select></label><label>Groupe B <select id="cmpB">${opt(C.b, [["rest", "Tout le reste"]])}</select></label></div></div>`;
  if (!C.a) return `<div class="grid2">${head}<div class="card wide"><p class="panel-sub">Aucun groupe disponible : sélectionnez des points (lasso), choisissez une cible ou calculez les classes.</p></div></div>`;
  const A = groupRows(r, C.a), aSet = new Set(A), universe = ["sel", "out"].includes(C.a) || C.a.startsWith("class:") ? (r.rowsKept || range(r.n)) : range(state.work.rows.length);
  const B = C.b === "rest" ? universe.filter(i => !aSet.has(i)) : groupRows(r, C.b).filter(i => !aSet.has(i));
  if (A.length < 2 || B.length < 2) return `<div class="grid2">${head}<div class="card wide"><p class="panel-sub">Chaque groupe doit compter au moins deux lignes (A : ${A.length}, B : ${B.length}).</p></div></div>`;
  const key = `${C.a}|${C.b}|${A.length}|${B.length}`; if (!C.res || C.key !== key || C.work !== state.work) { C.res = compareGroups(state.work, state.work.rows, A, B, { skip: [state.types.ident].filter(Boolean) }); C.key = key; C.work = state.work; C.A = A; C.B = B; }
  const R = C.res, la = defs.find(d => d[0] === C.a)?.[1] || "A", lb = C.b === "rest" ? "le reste" : defs.find(d => d[0] === C.b)?.[1] || "B", big = R.nA + R.nB > 5000;
  const top = R.num.filter(o => Math.abs(o.d) >= 0.2).slice(0, 3).map(o => `${o.col} ${o.d > 0 ? "plus élevé" : "plus faible"} (d = ${frs(o.d)})`), topC = R.cat.filter(o => o.V >= 0.1).slice(0, 2).map(o => `${o.col} (${o.mods[0].nm} : ${frs(o.mods[0].diff * 100, 1)} pts)`);
  const sentence = top.length || topC.length ? `A se distingue surtout par ${liste(top.concat(topC), 5)}.` : "Aucune différence notable : les deux groupes se ressemblent (tous les |d| < 0,2 et V < 0,1).";
  const mxd = Math.max(0.5, ...R.num.slice(0, 20).map(o => Math.abs(o.d)));
  const numT = R.num.length ? `<div class="card wide"><h3 class="panel-title">Variables quantitatives</h3><p class="panel-sub">d > 0 : plus élevé dans A. Repères usuels : 0,2 petit, 0,5 moyen, 0,8 grand.${big ? " Avec autant de lignes, presque tout est « significatif » : lisez d plutôt que p." : ""}</p><div class="scroll"><table class="tbl"><thead><tr><th>Variable</th><th>Moyenne A</th><th>Moyenne B</th><th style="min-width:170px">Écart d</th><th>Test de Welch</th></tr></thead><tbody>${R.num.slice(0, 25).map(o => { const w = Math.abs(o.d) / mxd * 50; return `<tr><td>${esc(o.col)}</td><td>${fmtNum(o.mA)}</td><td>${fmtNum(o.mB)}</td><td><span class="zbar" style="display:inline-block;width:110px;vertical-align:middle"><i style="left:${o.d < 0 ? 50 - w : 50}%;width:${w}%;background:${o.d < 0 ? "var(--neg)" : "var(--pos)"}"></i></span> <span class="mono">${frs(o.d)}</span></td><td class="mono">${pTxt(o.p)}</td></tr>`; }).join("")}</tbody></table></div></div>` : "";
  const catT = R.cat.length ? `<div class="card wide"><h3 class="panel-title">Variables qualitatives</h3><p class="panel-sub">V de Cramér (0 : aucun lien, 1 : groupes totalement différents) et modalités dont la part diffère le plus.</p><div class="scroll"><table class="tbl"><thead><tr><th>Variable</th><th>V</th><th>Test du χ²</th><th>Plus grands écarts (A contre B)</th></tr></thead><tbody>${R.cat.slice(0, 20).map(o => `<tr><td>${esc(o.col)}</td><td class="mono">${fr(o.V, 3)}</td><td class="mono">${pTxt(o.p)}</td><td style="font-family:var(--f-body);white-space:normal">${o.mods.slice(0, 3).map(m => `${esc(m.nm)} : ${pc(m.a * 100, 0)} contre ${pc(m.b * 100, 0)}`).join(" · ")}</td></tr>`).join("")}</tbody></table></div></div>` : "";
  // distributions superposees des 6 variables les plus differentes
  const hists = R.num.slice(0, 6).map(o => { const x = colInfo(state.work.rows, o.col).num, vals = C.A.map(i => x[i]).concat(C.B.map(i => x[i])).filter(v => v === v), rr = robustRange(vals), nb = 24, w = (rr[1] - rr[0]) / nb || 1;
    const h = idx => { const a = new Float64Array(nb); let k = 0; for (const i of idx) { const v = x[i]; if (v !== v) continue; k++; a[clamp(Math.floor((v - rr[0]) / w), 0, nb - 1)]++; } return Array.from(a, v => v / (k || 1)); }, ha = h(C.A), hb = h(C.B), m = maxOf(ha.concat(hb), 1e-9), W = 260, H = 110, bw = (W - 16) / nb;
    const path = hh => hh.map((v, k) => `${k ? "L" : "M"}${(8 + k * bw + bw / 2).toFixed(1)},${(H - 20 - (H - 34) * v / m).toFixed(1)}`).join("");
    return `<div class="cmp-h"><b>${esc(o.col)}</b>${svgBox(W, H)}<path d="${path(hb)}" fill="none" style="stroke:var(--a2)" stroke-width="2"/><path d="${path(ha)}" fill="none" style="stroke:var(--a1)" stroke-width="2"/><text x="8" y="${H - 5}" font-size="9.5" style="fill:var(--faint)">${fmtNum(rr[0])}</text><text x="${W - 8}" y="${H - 5}" text-anchor="end" font-size="9.5" style="fill:var(--faint)">${fmtNum(rr[1])}</text></svg></div>`; }).join("");
  return `<div class="grid2">${head}<div class="card wide cmp-sum"><div class="cmp-n"><span style="--c:var(--a1)"><b class="mono">${R.nA.toLocaleString("fr-FR")}</b> A · ${esc(la)}</span><span style="--c:var(--a2)"><b class="mono">${R.nB.toLocaleString("fr-FR")}</b> B · ${esc(lb)}</span></div><p class="sentence">${esc(sentence)}</p></div>
    ${hists ? `<div class="card wide"><h3 class="panel-title">Distributions comparées</h3><p class="panel-sub">Corail : groupe A · cyan : groupe B (histogrammes normalisés).</p><div class="cmp-hs">${hists}</div></div>` : ""}${numT}${catT}</div>`;
}

/* ------------------------------------------------------------------ Temps (colonnes de dates) */
function pTemps(r) {
  const ty = state.types; if (!ty.dates) ty.dates = dateColumns(state.table);
  if (!ty.dates.length) return `<div class="card"><h3 class="panel-title">Temps</h3><p class="panel-sub">Aucune colonne de dates détectée. Formats reconnus : 2024-03-15 (ISO), 15/03/2024, 2024/03/15, 2024-03, avec ou sans heure.</p></div>`;
  const S = state.time || (state.time = { col: ty.dates[0], gran: null, measure: state.target ? "target" : "n" }); if (!ty.dates.includes(S.col)) S.col = ty.dates[0];
  const tc = state.timeCache && state.timeCache.work === state.work && state.timeCache.col === S.col ? state.timeCache : (state.timeCache = { work: state.work, col: S.col, ts: state.work.rows.map(x => parseDate(x[S.col])) });
  const gran = S.gran || autoPeriod(tc.ts), numCols = ty.quanti.filter(c => state.table.columns.includes(c));
  let series = [], mLabel = "", isRate = false;
  if (S.measure === "target" && state.target) { const sp = targetSpec(state.work.rows, state.target.col, state.target.positive); if (sp) { series = [Array.from(sp.y)]; isRate = sp.kind === "bin"; mLabel = isRate ? `Taux · ${state.target.col} = ${sp.posLabel}` : `Moyenne · ${state.target.col}`; } }
  else if (S.measure !== "n" && numCols.includes(S.measure)) { series = [Array.from(colInfo(state.work.rows, S.measure).num)]; mLabel = `Moyenne · ${S.measure}`; }
  const ag = timeAggregate(tc.ts, gran, series), K = ag.keys.length, nMiss = tc.ts.filter(t => !Number.isFinite(t)).length;
  const head = `<div class="card wide tg-head"><div><h3 class="panel-title">Évolution dans le temps</h3><p class="panel-sub" style="margin:0">Effectif par période et, au choix, une moyenne ou un taux. En dessous : le déplacement du profil moyen dans le plan factoriel, période après période.</p></div>
    <div class="tg-ctl"><label>Date <select id="tmCol">${ty.dates.map(c => `<option ${c === S.col ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label>Période <select id="tmGran">${Object.entries(PERIODS).map(([k, p]) => `<option value="${k}" ${k === gran ? "selected" : ""}>${p.l}</option>`).join("")}</select></label>
      <label>Mesure <select id="tmMeas"><option value="n">Effectif seulement</option>${state.target ? `<option value="target" ${S.measure === "target" ? "selected" : ""}>Cible · ${esc(state.target.col)}</option>` : ""}${numCols.map(c => `<option value="${esc(c)}" ${S.measure === c ? "selected" : ""}>Moyenne · ${esc(c)}</option>`).join("")}</select></label>
      <button class="btn sm" type="button" data-derive="${esc(S.col)}">Créer les variables de date</button></div></div>`;
  if (!K) return `<div class="grid2">${head}<div class="card wide"><p class="panel-sub">Aucune date lisible dans ${esc(S.col)}.</p></div></div>`;
  // effectif (barres) et mesure (courbe)
  const W = 920, H = 300, L = 56, Rm = series.length ? 64 : 18, T = 18, B = 46, bw = (W - L - Rm) / K, nMax = maxOf(ag.n), mv = series.length ? ag.means[0].filter(Number.isFinite) : [], m0 = mv.length ? minOf(mv) : 0, m1 = mv.length ? maxOf(mv) : 1, pad = (m1 - m0) * 0.1 || Math.abs(m1) * 0.1 || 1;
  const Y1 = v => H - B - (H - B - T) * v / nMax, Y2 = v => H - B - (H - B - T) * (v - (m0 - pad)) / ((m1 + pad) - (m0 - pad)), every = Math.ceil(K / 14);
  let g = svgBox(W, H) + [0, .5, 1].map(f => `<line x1="${L}" x2="${W - Rm}" y1="${Y1(nMax * f)}" y2="${Y1(nMax * f)}" style="stroke:var(--line)"/><text x="${L - 6}" y="${Y1(nMax * f) + 4}" text-anchor="end" font-size="10" style="fill:var(--faint);font-family:var(--f-mono)">${Math.round(nMax * f).toLocaleString("fr-FR")}</text>`).join("");
  g += ag.n.map((v, k) => `<rect x="${(L + k * bw + bw * .12).toFixed(1)}" y="${Y1(v).toFixed(1)}" width="${Math.max(bw * .76, 1).toFixed(1)}" height="${(H - B - Y1(v)).toFixed(1)}" rx="2" style="fill:var(--a2);fill-opacity:.35"><title>${ag.labels[k]} : ${v.toLocaleString("fr-FR")} lignes</title></rect>`).join("");
  g += ag.labels.map((l, k) => (k % every === 0 ? `<text x="${(L + k * bw + bw / 2).toFixed(1)}" y="${H - B + 16}" text-anchor="middle" font-size="10" style="fill:var(--muted)">${esc(l)}</text>` : "")).join("");
  if (series.length) { const pts = ag.means[0].map((v, k) => (Number.isFinite(v) ? [L + k * bw + bw / 2, Y2(v), v, k] : null)).filter(Boolean);
    g += `<polyline points="${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" fill="none" style="stroke:var(--amber)" stroke-width="2.4" stroke-linejoin="round"/>` + pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" style="fill:var(--amber)"><title>${ag.labels[p[3]]} : ${isRate ? pctTxt(p[2], 2) : fmtNum(p[2])}</title></circle>`).join("");
    g += [0, 1].map(f => { const v = m0 - pad + f * ((m1 + pad) - (m0 - pad)); return `<text x="${W - Rm + 6}" y="${Y2(v) + 4}" font-size="10" style="fill:var(--amber);font-family:var(--f-mono)">${isRate ? pctTxt(v, 1) : fmtNum(v)}</text>`; }).join(""); }
  g += `</svg>`;
  // trajectoire du profil moyen dans le plan 1-2 (lignes de l'analyse)
  let traj = "";
  if (r.method !== "AFC" && r.q >= 2) { const P = PERIODS[gran], acc = new Map(); r.F.forEach((f, i) => { const t = tc.ts[r.rowsKept ? r.rowsKept[i] : i]; if (!Number.isFinite(t)) return; const k = P.key(new Date(t)); let e = acc.get(k); if (!e) acc.set(k, (e = [0, 0, 0])); e[0] += f[0]; e[1] += f[1]; e[2]++; });
    const ks = [...acc.keys()].sort((a, b) => a - b).filter(k => acc.get(k)[2] >= 5), pts = ks.map(k => { const e = acc.get(k); return { k, x: e[0] / e[2], y: e[1] / e[2], n: e[2], l: P.lab(k) }; });
    if (pts.length >= 2) { const Wt = 620, Ht = 440, xs = pts.map(p => p.x), ys = pts.map(p => p.y), cx = (minOf(xs) + maxOf(xs)) / 2, cy = (minOf(ys) + maxOf(ys)) / 2, half = Math.max(maxOf(xs) - minOf(xs), maxOf(ys) - minOf(ys), 1e-6) / 2 * 1.25;
      const X = v => Wt / 2 + (v - cx) / half * (Wt / 2 - 40), Y = v => Ht / 2 - (v - cy) / half * (Ht / 2 - 40), nmx = maxOf(pts.map(p => p.n));
      let s = svgBox(Wt, Ht);
      if (0 > cx - half && 0 < cx + half) s += `<line x1="${X(0)}" x2="${X(0)}" y1="10" y2="${Ht - 10}" style="stroke:var(--line-2)"/>`; if (0 > cy - half && 0 < cy + half) s += `<line y1="${Y(0)}" y2="${Y(0)}" x1="10" x2="${Wt - 10}" style="stroke:var(--line-2)"/>`;
      s += pts.slice(1).map((p, k) => { const a = pts[k], f = k / Math.max(pts.length - 2, 1); return `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.y).toFixed(1)}" x2="${X(p.x).toFixed(1)}" y2="${Y(p.y).toFixed(1)}" style="stroke:${ramp(f)}" stroke-width="2.4" stroke-linecap="round"/>`; }).join("");
      const lbEvery = Math.ceil(pts.length / 10);
      s += pts.map((p, k) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${(3 + 5 * Math.sqrt(p.n / nmx)).toFixed(1)}" style="fill:${ramp(k / Math.max(pts.length - 1, 1))}" fill-opacity=".85"><title>${p.l} : ${p.n.toLocaleString("fr-FR")} individus</title></circle>${k % lbEvery === 0 || k === pts.length - 1 ? `<text x="${(X(p.x) + 9).toFixed(1)}" y="${(Y(p.y) - 7).toFixed(1)}" font-size="10.5" style="fill:var(--text)">${esc(p.l)}</text>` : ""}`).join("");
      s += `<text x="${Wt - 10}" y="${Ht - 10}" text-anchor="end" font-size="11" style="fill:var(--a1)">Axe 1 · ${pc(r.pct[0])}</text><text x="12" y="20" font-size="11" style="fill:var(--a2)">Axe 2 · ${pc(r.pct[1])}</text></svg>`;
      traj = `<div class="card"><h3 class="panel-title">Trajectoire dans le plan 1·2</h3><p class="panel-sub">Profil moyen de chaque période (${P.l}), du bleu (ancien) au corail (récent) ; zoom automatique sur la trajectoire.</p><div class="svgbox">${s}</div></div>`; } }
  // composition des classes par periode
  let comp = "";
  if (state.hc && state.hc.res === r) { const P = PERIODS[gran], k = state.hc.k, map = new Map(); state.hc.labels.forEach((l, i) => { const t = tc.ts[r.rowsKept ? r.rowsKept[i] : i]; if (!Number.isFinite(t)) return; const key = P.key(new Date(t)); let e = map.get(key); if (!e) map.set(key, (e = new Float64Array(k))); e[l]++; });
    const ks = [...map.keys()].sort((a, b) => a - b), Wc = 620, Hc = 260, bwc = (Wc - 20) / Math.max(ks.length, 1);
    comp = `<div class="card"><h3 class="panel-title">Composition des classes</h3><p class="panel-sub">Part de chaque classe HCPC par période.</p><div class="svgbox">${svgBox(Wc, Hc)}${ks.map((key, j) => { const e = map.get(key), tot = sum(Array.from(e)); let y = Hc - 30; return range(k).map(c => { const h = (Hc - 50) * e[c] / tot; y -= h; return `<rect x="${(10 + j * bwc + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(bwc - 2, 1).toFixed(1)}" height="${h.toFixed(1)}" style="fill:var(--g${c % 10 + 1})"><title>${P.lab(key)} · classe ${c + 1} : ${pc(e[c] / tot * 100, 1)}</title></rect>`; }).join(""); }).join("")}${ks.map((key, j) => (j % Math.ceil(ks.length / 8) === 0 ? `<text x="${(10 + j * bwc + bwc / 2).toFixed(1)}" y="${Hc - 12}" text-anchor="middle" font-size="10" style="fill:var(--muted)">${esc(P.lab(key))}</text>` : "")).join("")}</svg></div></div>`; }
  return `<div class="grid2">${head}<div class="card wide"><h3 class="panel-title">${esc(S.col)} · par ${PERIODS[gran].l}</h3><p class="panel-sub">${K} périodes · barres : nombre de lignes${series.length ? ` · courbe : ${esc(mLabel)}` : ""}${nMiss ? ` · ${nMiss.toLocaleString("fr-FR")} lignes sans date lisible` : ""}.</p><div class="svgbox">${g}</div></div>${traj}${comp}</div>`;
}

/* ------------------------------------------------------------------ evenements */
function bindAnalyses() {
  const p = $("#panel");
  p.addEventListener("click", e => {
    const qa = e.target.closest("[data-qa]"); if (qa) return qualityAction(qa);
    const dv = e.target.closest("[data-derive]"); if (dv) { try { const d = deriveDate(state.table, dv.dataset.derive); tableChanged(d.table, `${pl(d.added.length, "variable créée", "variables créées")} : ${d.added.join(", ")}.`); } catch (err) { toast(err.message); } return; }
    const tp = e.target.closest("[data-tgpick]"); if (tp) return setTarget(tp.dataset.tgpick);
    const ts = e.target.closest("[data-tgsel]"); if (ts) { state.tgtSel = ts.dataset.tgsel; renderPanel(); return; }
    const ta = e.target.closest("[data-tgact]"); if (ta) { if (ta.dataset.tgact === "color") { setEnc("color", "target"); $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); } if (ta.dataset.tgact === "compare") { state.cmp = { a: "target", b: "rest" }; state.tab = "comparer"; renderPanel(); } }
  });
  p.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "tgCol") return setTarget(t.value || null);
    if (t.id === "tgPos") { state.target.positive = t.value || null; state.tgt = null; renderPanel(); return; }
    if (t.id === "tgDepth") { if (state.target) { state.target.depth = +t.value; state.tgt = null; renderPanel(); } return; }
    if (t.id === "cmpA") { state.cmp.a = t.value; renderPanel(); return; } if (t.id === "cmpB") { state.cmp.b = t.value; renderPanel(); return; }
    if (t.id === "tmCol") { state.time.col = t.value; state.time.gran = null; renderPanel(); return; } if (t.id === "tmGran") { state.time.gran = t.value; renderPanel(); return; } if (t.id === "tmMeas") { state.time.measure = t.value; renderPanel(); return; }
    if (t.dataset.type) { const r = retype(state.table, t.dataset.type, t.value); tableChanged(r.table, `${t.dataset.type} : ${t.value === "quanti" ? "quantitative" : "qualitative"}${r.lost ? ` (${r.lost.toLocaleString("fr-FR")} valeurs non numériques deviennent manquantes)` : ""}.`); }
  });
}
