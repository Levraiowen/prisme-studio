
/* ============================================================================
   Selection partagee entre toutes les vues (brushing & linking : Becker &
   Cleveland 1987 ; vues multiples coordonnees : Roberts 2007), barre de
   selection, tiroir d'explication (valeurs-tests) et groupes utilisateur.
   ============================================================================ */
const mainN = res => (res.method === "AFC" ? res.I : res.n);
const mainKindOf = res => (res.method === "AFC" ? "row" : "ind");
const mainNames = res => (res.method === "AFC" ? res.rowL : res.names);
const Sel = {
  set(idx, src = "", mode = "replace") {
    const cur = state.sel; let s;
    if (mode === "add") s = new Set([...cur, ...idx]); else if (mode === "toggle") { s = new Set(cur); idx.forEach(i => (s.has(i) ? s.delete(i) : s.add(i))); } else s = new Set(idx);
    state.sel = s; state.selSrc = src; if (!s.size) state.isolate = false; this.changed();
  },
  clear(silent = false) { if (!state.sel.size && !state.isolate) return; state.sel = new Set(); state.isolate = false; state.selSrc = ""; if (!silent) this.changed(); else Stage.setSelection(state.sel, false); },
  changed() { Stage.setSelection(state.sel, state.isolate); renderSelBar(); document.dispatchEvent(new CustomEvent("prisme:sel", { detail: { src: state.selSrc } })); if (!$("#drawer").hidden && Drawer.kind === "explain") state.sel.size ? explainSelection() : Drawer.close(); },
};
function renderSelBar() {
  const bar = $("#selbar"), r = state.res, n = state.sel.size; if (!r || !n) { bar.hidden = true; return; }
  const names = mainNames(r), list = [...state.sel].slice(0, 3).map(i => names[i]);
  bar.innerHTML = `<span class="sb-dot"></span><b>${n}</b><span class="sb-l">${n > 1 ? "sélectionnés" : "sélectionné"}</span><span class="sb-n">${esc(list.join(", "))}${n > 3 ? "…" : ""}</span>
    <button type="button" data-sel="explain" class="sb-main"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>Expliquer <span class="kbd">E</span></button>
    <button type="button" data-sel="isolate" aria-pressed="${state.isolate}">${state.isolate ? "Tout afficher" : "Isoler"}</button>
    <button type="button" data-sel="group">Créer un groupe</button><button type="button" data-sel="csv">Exporter</button><button type="button" data-sel="clear" aria-label="Effacer la sélection">×</button>`;
  bar.hidden = false;
}
const Drawer = {
  kind: null,
  open(kind, eyebrow, title, html) { this.kind = kind; $("#drEy").textContent = eyebrow; $("#drTitle").textContent = title; $("#drBody").innerHTML = html; $("#drawer").hidden = false; document.body.classList.add("dr-open"); requestAnimationFrame(() => $("#drawer").classList.add("on")); },
  close() { $("#drawer").classList.remove("on"); document.body.classList.remove("dr-open"); setTimeout(() => { if (!this.kind) $("#drawer").hidden = true; }, 250); this.kind = null; },
};
// lignes du tableau de travail correspondant aux individus de l'analyse
const workRows = res => (res.rowsKept ? res.rowsKept.map(i => state.work.rows[i]) : state.work.rows);
function explainSelection() {
  const r = state.res, sel = state.sel, n = sel.size; if (!r || !n) return;
  const names = mainNames(r), N = mainN(r), pctSel = n / N * 100; let body = "", sentence = "";
  if (r.method === "AFC") {
    const colTot = r.colL.map((_, j) => sum(r.N.map(row => row[j]))), T = sum(colTot), ns = sum([...sel].map(i => sum(r.N[i])));
    const res = r.colL.map((c, j) => { const x = sum([...sel].map(i => r.N[i][j])); return { c, x, e: ns * colTot[j] / T, ...vtestModal(Math.round(T), Math.round(colTot[j]), Math.round(ns), Math.round(x)) }; }).sort((a, b) => b.v - a.v);
    const sg = r.rowName.toLowerCase(), plu = /s$|x$/.test(sg) ? sg : sg + "s", over = res.filter(o => o.v > 2).map(o => o.c);
    sentence = `${n > 1 ? `Ces ${n} ${plu}` : `Cette ${sg}`} sur-représente${n > 1 ? "nt" : ""} ${over.length ? liste(over) : "aucune colonne de façon significative"}.`;
    body = `<div class="ex-block"><h4>Colonnes sur- et sous-représentées</h4>${res.map(o => exRow(o.c, (o.x - o.e) / Math.max(o.e, 1e-9), o.v, `${Math.round(o.x)} observés pour ${fr(o.e, 0)} attendus`)).join("")}</div>`;
  } else {
    const d = describeSubset(state.work, workRows(r), sel, { skip: [state.params.ident].filter(Boolean) }), q = d.filter(o => o.type === "quanti" && Math.abs(o.v) >= 2), m = d.filter(o => o.type === "modal" && o.v >= 2), mNeg = d.filter(o => o.type === "modal" && o.v <= -2);
    const top = m[0];
    const hasQ = d.some(o => o.type === "quanti");
    sentence = `${pl(n, "individu", "individus")} (${pc(pctSel, 0)}). ${q.length ? `Ils se distinguent surtout par ${liste(q.slice(0, 3).map(o => `${o.col} ${o.v > 0 ? "élevé" : "faible"} (${fmtNum(o.mk)} contre ${fmtNum(o.m)} en moyenne)`), 3)}.` : hasQ ? "Aucune variable quantitative ne les distingue nettement." : ""}${top ? ` ${pc(top.modcla * 100, 0)} d'entre eux sont « ${top.col} = ${top.cat} » (${pc(top.glob * 100, 0)} dans l'ensemble).` : ""}`;
    body = (q.length ? `<div class="ex-block"><h4>Variables quantitatives <small>écart à la moyenne, en écarts-types</small></h4>${q.slice(0, 12).map(o => exRow(o.col, (o.mk - o.m) / (o.sd || 1), o.v, `${fmtNum(o.mk)} contre ${fmtNum(o.m)}`)).join("")}</div>` : "") +
      (m.length ? `<div class="ex-block"><h4>Modalités sur-représentées</h4>${m.slice(0, 8).map(o => exMod(o)).join("")}</div>` : "") +
      (mNeg.length ? `<div class="ex-block"><h4>Modalités sous-représentées</h4>${mNeg.slice(0, 4).map(o => exMod(o)).join("")}</div>` : "") +
      (!q.length && !m.length ? `<p class="muted">Aucune caractéristique ne ressort à 5 % : cette sélection ressemble à l'ensemble.</p>` : "");
  }
  // individus typiques : les plus proches du centre de la selection dans l'espace retenu
  const S = r.nAxes, P = r.F, idx = [...sel], g = range(S).map(k => mean(idx.map(i => P[i][k]))), typ = idx.map(i => [i, dist(P[i], g, S)]).sort((a, b) => a[1] - b[1]).slice(0, 5);
  body += `<div class="ex-block"><h4>Les plus typiques de la sélection</h4><div class="ex-typ">${typ.map(([i]) => `<button type="button" data-typ="${i}">${esc(names[i])}</button>`).join("")}</div></div>`;
  body += `<div class="ex-actions"><button class="btn sm prime" type="button" data-sel="group">Créer un groupe</button><button class="btn sm" type="button" data-sel="csv">Exporter la sélection</button></div>
    <p class="ex-note">Valeur-test : écart normal équivalent au hasard d'un tirage sans remise. |v| > 2 correspond à peu près à un seuil de 5 % (Lebart, Morineau & Piron). Les tests sont nombreux : lisez d'abord les plus fortes.</p>`;
  Drawer.open("explain", "Expliquer la sélection", `Pourquoi ces ${pl(n, "points", "points")} ?`, `<p class="ex-sentence">${esc(sentence)}</p>${body}`);
}
function exRow(label, eff, v, sub) { const w = clamp(Math.abs(eff) / 2.5, 0, 1) * 50;
  return `<div class="ex-row"><div class="ex-l"><b>${esc(label)}</b><small>${esc(sub)}</small></div><div class="ex-bar"><i style="left:${eff < 0 ? 50 - w : 50}%;width:${w}%;background:${eff < 0 ? "var(--neg)" : "var(--pos)"}"></i></div><span class="ex-v ${Math.abs(v) >= 3 ? "strong" : ""}">v = ${frs(v, 1)}</span></div>`; }
function exMod(o) { return `<div class="ex-row"><div class="ex-l"><b>${esc(o.col)} = ${esc(o.cat)}</b><small>${pc(o.modcla * 100, 0)} de la sélection · ${pc(o.glob * 100, 0)} au global · ${pc(o.clamod * 100, 0)} des « ${esc(o.cat)} » sont sélectionnés</small></div><div class="ex-bar prop"><i style="width:${o.glob * 100}%;background:var(--faint)"></i><i style="width:${o.modcla * 100}%;background:${o.v > 0 ? "var(--pos)" : "var(--neg)"};height:4px;top:auto;bottom:0"></i></div><span class="ex-v ${Math.abs(o.v) >= 3 ? "strong" : ""}">v = ${frs(o.v, 1)}</span></div>`; }
function createGroupFromSelection() {
  if (!state.sel.size) return; const letters = "ABCDEFGHIJ", name = `Groupe ${letters[state.groups.length % 10]}`;
  state.groups.push({ name, idx: new Set(state.sel) }); state.enc.color = "user"; state.colorMode = "user"; renderEnc(); Stage.build(state.res, "morph"); renderHeader(); Stage.setSelection(state.sel, state.isolate);
  toast(`${name} créé (${state.sel.size}). La 3D est colorée par groupe.`); if (["individus", "hyper", "projections", "matrices"].includes(state.tab)) renderPanel();
}
function exportSelection() {
  const r = state.res, idx = [...state.sel].sort((a, b) => a - b); if (!idx.length) return;
  if (r.method === "AFC") { const L = [["Ligne", ...r.colL].join(";"), ...idx.map(i => [r.rowL[i], ...r.N[i]].join(";"))]; saveFile("selection.csv", "﻿" + L.join("\n")); return; }
  const rows = workRows(r), cols = state.work.columns, q = v => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  saveFile("selection.csv", "﻿" + [cols.join(";"), ...idx.map(i => cols.map(c => q(rows[i][c])).join(";"))].join("\n"));
}
function bindSelection() {
  const act = a => { if (a === "explain") explainSelection(); if (a === "isolate") { state.isolate = !state.isolate; Stage.setSelection(state.sel, state.isolate); renderSelBar(); } if (a === "group") createGroupFromSelection(); if (a === "csv") exportSelection(); if (a === "clear") Sel.clear(); };
  $("#selbar").addEventListener("click", e => { const b = e.target.closest("[data-sel]"); if (b) act(b.dataset.sel); });
  $("#drawer").addEventListener("click", e => { if (e.target.closest(".dr-x")) return Drawer.close(); const b = e.target.closest("[data-sel]"); if (b) return act(b.dataset.sel); const t = e.target.closest("[data-typ]"); if (t) Stage.selectRef(mainKindOf(state.res), +t.dataset.typ); });
}

/* ------------------------------------------------------------------ nuage de points sur canvas (vues liees) */
const colorCache = new Map();
// couleur CSS resolue une fois (le cache est vide a chaque changement de theme, voir Stage.applyTheme)
function cssColor(c) { if (!c.startsWith("var(")) return c; let v = colorCache.get(c); if (v === undefined) { v = cssVar(c.slice(4, -1)) || "#888"; colorCache.set(c, v); } return v; }
class Scatter2D {
  constructor(host, o) { this.host = host; this.o = o; this.c = document.createElement("canvas"); this.c.className = "sc2d"; host.innerHTML = ""; host.appendChild(this.c); this.tip = document.createElement("div"); this.tip.className = "sc-tip"; this.tip.hidden = true; host.appendChild(this.tip); this.bind(); this.resize(); }
  set(pts, colors) { this.o.pts = pts; this.o.colors = colors; this.fit(); this.draw(); }
  fit() { const P = this.o.pts.filter(p => p && Number.isFinite(p[0]) && Number.isFinite(p[1])); if (!P.length) return; let x0, x1, y0, y1;
    if (this.o.robust) { [x0, x1] = robustRange(P.map(p => p[0])); [y0, y1] = robustRange(P.map(p => p[1])); } else { x0 = minOf(P.map(p => p[0])); x1 = maxOf(P.map(p => p[0])); y0 = minOf(P.map(p => p[1])); y1 = maxOf(P.map(p => p[1])); }
    if (this.o.square) { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, h = Math.max(x1 - x0, y1 - y0) / 2 || 1; x0 = cx - h; x1 = cx + h; y0 = cy - h; y1 = cy + h; } const px = (x1 - x0) * 0.06 || 1, py = (y1 - y0) * 0.06 || 1; this.dom = [x0 - px, x1 + px, y0 - py, y1 + py]; }
  resize() { const w = this.host.clientWidth || 300, h = this.o.height || Math.round(w * (this.o.ratio || 0.8)), d = Math.min(devicePixelRatio || 1, 2); this.W = w; this.H = h; this.c.width = w * d; this.c.height = h * d; this.c.style.height = h + "px"; this.d = d; if (this.o.pts) { this.fit(); this.draw(); } }
  X(x) { const [a, b] = this.dom; return 8 + (this.W - 16) * clamp((x - a) / (b - a), -0.01, 1.01); } Y(y) { const [, , a, b] = this.dom; return this.H - 8 - (this.H - 16) * clamp((y - a) / (b - a), -0.01, 1.01); }
  draw() {
    const g = this.c.getContext("2d"), { pts, colors } = this.o, sel = state.sel, has = sel.size > 0; if (!pts || !this.dom) return; g.setTransform(this.d, 0, 0, this.d, 0, 0); g.clearRect(0, 0, this.W, this.H);
    g.strokeStyle = cssColor("var(--line)"); g.lineWidth = 1; if (this.dom[0] < 0 && this.dom[1] > 0 && this.o.axes !== false) { g.beginPath(); g.moveTo(this.X(0), 0); g.lineTo(this.X(0), this.H); g.stroke(); } if (this.dom[2] < 0 && this.dom[3] > 0 && this.o.axes !== false) { g.beginPath(); g.moveTo(0, this.Y(0)); g.lineTo(this.W, this.Y(0)); g.stroke(); }
    // au-dela de 15 000 points, un echantillon fixe est dessine (plus les points selectionnes) ; le pinceau et le survol portent sur tous les points
    if (this._base !== pts) { this._base = pts; this._draw = pts.length > 15000 ? sampleRows(pts.length, 15000, 47) : null; }
    const base = this._draw || range(pts.length), extra = has && this._draw && sel.size <= 20000 ? [...sel].filter(i => pts[i]) : [];
    const r = this.o.r || (pts.length > 800 ? 1.8 : pts.length > 200 ? 2.6 : 3.6), order = has ? [...base.filter(i => !sel.has(i)), ...base.filter(i => sel.has(i)), ...extra] : base;
    for (const i of order) { const p = pts[i]; if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue; const on = !has || sel.has(i); if (state.isolate && has && !on) continue;
      g.globalAlpha = on ? (pts.length > 800 ? 0.7 : 0.9) : 0.12; g.fillStyle = cssColor(colors?.[i] || "var(--a2)"); g.beginPath(); g.arc(this.X(p[0]), this.Y(p[1]), on && has ? r * 1.35 : r, 0, 7); g.fill(); }
    g.globalAlpha = 1; this.o.after?.(g, this);
    if (this.brush) { const [a, b, c, d] = this.brush; g.fillStyle = cssColor("var(--amber)"); g.globalAlpha = 0.14; g.fillRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); g.globalAlpha = 1; g.strokeStyle = cssColor("var(--amber)"); g.strokeRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); }
  }
  nearest(x, y) { let best = -1, bd = 144; this.o.pts.forEach((p, i) => { if (!p) return; const d = (this.X(p[0]) - x) ** 2 + (this.Y(p[1]) - y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; }
  bind() {
    const c = this.c, pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener("pointerdown", e => { c.setPointerCapture(e.pointerId); const [x, y] = pos(e); this.brush = [x, y, x, y]; this.mode = e.shiftKey || e.ctrlKey || e.metaKey ? "add" : "replace"; });
    c.addEventListener("pointermove", e => { const [x, y] = pos(e); if (this.brush) { this.brush[2] = x; this.brush[3] = y; this.draw(); return; }
      const i = this.nearest(x, y); if (i < 0) { this.tip.hidden = true; return; } this.tip.textContent = this.o.labels?.[i] ?? ""; this.tip.hidden = !this.tip.textContent; this.tip.style.left = Math.min(x + 12, this.W - 150) + "px"; this.tip.style.top = y + 12 + "px"; });
    c.addEventListener("pointerleave", () => (this.tip.hidden = true));
    c.addEventListener("pointerup", e => { const b = this.brush; this.brush = null; if (!b) return; const [a, bb, cc, d] = b;
      if (Math.abs(cc - a) < 4 && Math.abs(d - bb) < 4) { const i = this.nearest(a, bb); if (i >= 0) { this.o.onPick ? this.o.onPick(i) : Sel.set([i], this.o.src, this.mode === "add" ? "toggle" : "replace"); } else Sel.clear(); this.draw(); return; }
      const x0 = Math.min(a, cc), x1 = Math.max(a, cc), y0 = Math.min(bb, d), y1 = Math.max(bb, d), idx = []; this.o.pts.forEach((p, i) => { if (!p) return; const X = this.X(p[0]), Y = this.Y(p[1]); if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) idx.push(i); });
      Sel.set(idx, this.o.src, this.mode === "add" ? "add" : "replace"); });
  }
}
