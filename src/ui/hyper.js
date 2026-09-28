
/* ------------------------------------------------------------------ encodage visuel : couleur et taille des points */
function encOptions(r) {
  const col = [], size = [["uniform", "Uniforme"]];
  if (r.method !== "AFC") { if (r.groups) col.push(["groups", `Groupe · ${r.color}`]); else col.push(["groups", "Couleur par défaut"]); col.push(["hcpc", "Classes HCPC (automatique)"]); if (state.groups.length) col.push(["user", "Groupes créés"]); if (state.clusters && state.clusters.n === r.n) col.push(["clusters", `Classes k-means du Labo (k = ${state.clusters.k})`]); }
  else col.push(["groups", "Couleur par défaut"]);
  const E = state.emb?.res === r && state.trustFrom && state.emb[state.trustFrom]?.q; if (E && E.idx.length === mainN(r)) col.push(["trust", `Fiabilité locale · ${PROJ[state.trustFrom].l}`]);
  col.push(["cos2", "Qualité de représentation (cos²)"], ["ctr", "Contribution aux axes retenus"]);
  size.push(["ctr", "Contribution aux axes retenus"], ["cos2", "Qualité de représentation (cos²)"]);
  if (r.method === "ACP") { col.push(["t2", "Atypicité (T² de Hotelling)"], ["q", "Écart au modèle (Q)"]); r.vars.forEach(v => { col.push([`var:${v}`, `Variable · ${v}`]); size.push([`var:${v}`, `Variable · ${v}`]); }); }
  if (r.method === "AFC") { col.push(["mass", "Masse (poids de la ligne)"]); size.push(["mass", "Masse (poids de la ligne)"]); }
  return { col, size };
}
function encValues(r, key) {
  if (key.startsWith("var:")) { const j = r.vars?.indexOf(key.slice(4)); return j >= 0 ? r.X.map(x => x[j]) : null; }
  const S = r.nAxes;
  if (key === "cos2") return (r.method === "AFC" ? r.rcos2 : r.cos2).map(c => sum(c.slice(0, S)));
  if (key === "ctr") return (r.method === "AFC" ? r.rctr : r.ctr).map(c => sum(c.slice(0, S)) / S);
  if (key === "t2" && r.method === "ACP") return diagCache(r).T2;
  if (key === "q" && r.method === "ACP") return diagCache(r).Q;
  if (key === "mass" && r.method === "AFC") return r.r.slice();
  if (key === "trust") { const q = state.emb?.[state.trustFrom]?.q; if (!q) return null; const out = new Array(mainN(r)).fill(NaN); q.idx.forEach((i, k) => (out[i] = q.trust[k])); return out; }
  return null;
}
function encodeFor(r) {
  const e = state.enc, out = { kind: r.method === "AFC" ? "row" : "ind" };
  if (!["groups", "clusters", "hcpc", "user"].includes(e.color)) { const v = encValues(r, e.color); if (v) { const f = v.filter(Number.isFinite), lo = e.color === "cos2" ? 0 : minOf(f), hi = e.color === "cos2" ? 1 : maxOf(f), grey = cssVar("--faint") || "#777"; out.hex = v.map(x => (Number.isFinite(x) ? ramp(hi > lo ? (x - lo) / (hi - lo) : 0.5) : grey)); out.cLeg = { lo, hi }; } }
  if (e.size !== "uniform") { const v = encValues(r, e.size); if (v) { const lo = minOf(v), hi = maxOf(v); out.size = v.map(x => 0.45 + 1.25 * Math.sqrt(hi > lo ? (x - lo) / (hi - lo) : 0.5)); out.sLeg = { lo, hi }; } }
  return out.hex || out.size ? out : null;
}
function encLabel(key, r) { const o = encOptions(r); return (o.col.find(x => x[0] === key) || o.size.find(x => x[0] === key) || [0, key])[1].replace(/^Variable · /, ""); }
const fmtv = x => fr(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
function encLegendHTML(r) {
  const enc = encodeFor(r); if (!enc) return ""; let h = "";
  if (enc.cLeg) h += `<span><b>Couleur</b>${esc(encLabel(state.enc.color, r))}<i class="grad" style="background:${rampCSS}"></i><em>${fmtv(enc.cLeg.lo)} → ${fmtv(enc.cLeg.hi)}</em></span>`;
  if (enc.sLeg) h += `<span><b>Taille</b>${esc(encLabel(state.enc.size, r))}<i class="dots3"><u></u><u></u><u></u></i><em>${fmtv(enc.sLeg.lo)} → ${fmtv(enc.sLeg.hi)}</em></span>`;
  return h;
}
function renderEnc() {
  const r = state.res, box = $("#encBox"); if (!r || !box) return; const o = encOptions(r);
  if (!o.col.some(x => x[0] === state.enc.color)) state.enc.color = "groups"; if (!o.size.some(x => x[0] === state.enc.size)) state.enc.size = "uniform";
  const sel = (id, list, cur) => `<select id="${id}">${list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  box.innerHTML = `<div class="field" style="margin-top:0"><label for="encColor">Couleur des points</label>${sel("encColor", o.col, state.enc.color)}</div><div class="field"><label for="encSize">Taille des points</label>${sel("encSize", o.size, state.enc.size)}</div>
    ${r.method === "ACP" ? `<div class="field"><label for="calSel">Axe gradué (lecture directe)</label><select id="calSel"><option value="">Aucun</option>${r.vars.map(v => `<option value="${esc(v)}" ${state.calVar === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>` : ""}
    <p class="hint">Trois axes en position, deux dimensions de plus en couleur et en taille${r.method === "ACP" ? ", et une variable lisible en unités réelles sur son axe gradué" : ""}.</p>`;
}
function itemColors(r) {
  const enc = encodeFor(r), gi = groupIndex(r), n = r.method === "AFC" ? r.I : r.n;
  return range(n).map(i => (enc?.hex ? enc.hex[i] : r.method !== "AFC" && gi ? `var(--g${gi.idx[i] % 10 + 1})` : "var(--a2)"));
}

/* ------------------------------------------------------------------ graphiques de l'hyperespace */
function pcModel(r) {
  const acp = r.method === "ACP", cl = mainCloud(r), cols = acp ? varOrder(r) : range(Math.min(r.q, 7));
  const vals = cl.P.map((f, i) => cols.map(j => (acp ? r.X[i][j] : f[j])));
  const m = { acp, cols, names: acp ? cols.map(j => r.vars[j]) : cols.map(k => `Axe ${k + 1}`), vals, n: vals.length, labels: cl.names, kind: cl.kind,
    lo: cols.map((_, c) => minOf(vals.map(v => v[c]))), hi: cols.map((_, c) => maxOf(vals.map(v => v[c]))), w: 1000, h: 360, L: 72, R: 72, T: 48, B: 34 };
  m.dx = (m.w - m.L - m.R) / Math.max(cols.length - 1, 1); m.X = c => m.L + c * m.dx; m.Y = (c, v) => m.T + (m.h - m.T - m.B) * (1 - (v - m.lo[c]) / ((m.hi[c] - m.lo[c]) || 1));
  m.V = (c, y) => m.lo[c] + (1 - (y - m.T) / (m.h - m.T - m.B)) * (m.hi[c] - m.lo[c]); return m;
}
function svgParallel(m, colors, brush) {
  let s = SVGH(m.w, m.h).replace("<svg ", '<svg class="pc" id="pcSvg" ');
  // au-dela de 800 lignes, un echantillon est trace ; le filtre (pinceau) porte sur toutes les lignes
  m.drawn = m.n > 800 ? sampleRows(m.n, 800, 59) : range(m.n);
  s += `<g class="pc-lines">${m.drawn.map(i => { const v = m.vals[i]; return `<path data-i="${i}" d="${v.map((x, c) => `${c ? "L" : "M"}${m.X(c).toFixed(1)},${m.Y(c, x).toFixed(1)}`).join("")}" style="stroke:${colors[i]}"><title>${esc(m.labels[i])}</title></path>`; }).join("")}</g>`;
  m.cols.forEach((_, c) => { const x = m.X(c), nm = m.names[c].length > 20 ? m.names[c].slice(0, 19) + "…" : m.names[c];
    s += `<line x1="${x}" x2="${x}" y1="${m.T}" y2="${m.h - m.B}" class="pc-axis"/><text x="${x}" y="${m.T - 24}" text-anchor="middle" class="pc-name">${esc(nm)}</text>`;
    s += `<text x="${x}" y="${m.T - 9}" text-anchor="middle" class="pc-tick">${fmtv(m.hi[c])}</text><text x="${x}" y="${m.h - m.B + 17}" text-anchor="middle" class="pc-tick">${fmtv(m.lo[c])}</text>`;
    const b = brush[c]; if (b) { const y0 = m.Y(c, b[1]), y1 = m.Y(c, b[0]); s += `<rect class="pc-brush" x="${x - 9}" y="${y0}" width="18" height="${Math.max(y1 - y0, 2)}" rx="4"/>`; }
    s += `<rect class="pc-hit" data-c="${c}" x="${x - 18}" y="${m.T - 4}" width="36" height="${m.h - m.T - m.B + 8}"/>`; });
  return s + "</svg>";
}
function svgSankey(r) {
  const fl = inertiaFlows(r), q = r.q, nA = Math.min(q, 6), rest = q > nA;
  const axes = range(nA).map(k => ({ l: `Axe ${k + 1}`, v: r.vals[k], k })); if (rest) axes.push({ l: q === nA + 1 ? `Axe ${q}` : `Axes ${nA + 1} à ${q}`, v: sum(r.vals.slice(nA)), k: q === nA + 1 ? nA : -1 });
  const src = fl.src.map(s => { const f = [...s.f.slice(0, nA), ...(rest ? [sum(s.f.slice(nA))] : [])]; return { l: s.l, f, t: sum(s.f), dom: f.indexOf(maxOf(f)) }; }).sort((a, b) => a.dom - b.dom || b.f[b.dom] / b.t - a.f[a.dom] / a.t);
  const tot = sum(src.map(s => s.t)), ns = src.length, na = axes.length, w = 1000, H = clamp(ns * 30 + 60, 340, 620), gS = 7, gA = 14, x0 = 230, x1 = 740, nw = 12, xm = (x0 + nw + x1) / 2;
  const k = Math.min((H - 40 - gS * (ns - 1)) / tot, (H - 40 - gA * (na - 1)) / tot);
  let y = (H - (tot * k + gS * (ns - 1))) / 2; src.forEach(s => { s.y = y; s.h = s.t * k; s.o = y; y += s.h + gS; });
  y = (H - (tot * k + gA * (na - 1))) / 2; axes.forEach(a => { a.y = y; a.h = a.v * k; a.o = y; y += a.h + gA; });
  const acol = kk => (kk >= 0 && kk < 3 ? `var(--a${kk + 1})` : kk >= 0 ? "var(--muted)" : "var(--faint)");
  let rib = "", flow = "";
  src.forEach(s => axes.forEach((a, c) => { const th = s.f[c] * k; if (th <= 0) return; const ys0 = s.o, ys1 = s.o + th, yt0 = a.o, yt1 = a.o + th; s.o += th; a.o += th; if (th < 0.25) return;
    const share = s.f[c] / s.t * 100, cc = acol(a.k);
    rib += `<path class="rib" d="M${x0 + nw},${ys0.toFixed(1)} C${xm},${ys0.toFixed(1)} ${xm},${yt0.toFixed(1)} ${x1},${yt0.toFixed(1)} L${x1},${yt1.toFixed(1)} C${xm},${yt1.toFixed(1)} ${xm},${ys1.toFixed(1)} ${x0 + nw},${ys1.toFixed(1)} Z" style="fill:${cc};fill-opacity:${a.k >= 0 && a.k < r.nAxes ? 0.36 : 0.16}"><title>${esc(s.l)} → ${a.l} : ${fr(s.f[c], 3)} (${fr(share, 1)} % de ${r.method === "AFC" ? "son inertie" : "sa part"})</title></path>`;
    if (th > 2.5) { const ym0 = (ys0 + ys1) / 2, ym1 = (yt0 + yt1) / 2; flow += `<path class="flow" d="M${x0 + nw},${ym0.toFixed(1)} C${xm},${ym0.toFixed(1)} ${xm},${ym1.toFixed(1)} ${x1},${ym1.toFixed(1)}" style="stroke:${cc};animation-duration:${(3.2 - Math.min(th, 40) / 20).toFixed(2)}s"/>`; } }));
  let s = SVGH(w, H).replace("<svg ", '<svg class="sankey" ') + rib + flow;
  src.forEach(n => { s += `<rect x="${x0}" y="${n.y.toFixed(1)}" width="${nw}" height="${Math.max(n.h, 1).toFixed(1)}" rx="3" style="fill:${acol(n.dom < nA ? n.dom : -1)}"/><text x="${x0 - 10}" y="${(n.y + n.h / 2 + 4).toFixed(1)}" text-anchor="end" font-size="12.5" style="fill:var(--text)">${esc(n.l.length > 26 ? n.l.slice(0, 25) + "…" : n.l)}<tspan dx="8" font-size="10.5" style="fill:var(--faint);font-family:var(--f-mono)">${fr(n.t, 2)}</tspan></text>`; });
  axes.forEach(a => { s += `<rect x="${x1}" y="${a.y.toFixed(1)}" width="${nw}" height="${Math.max(a.h, 1).toFixed(1)}" rx="3" style="fill:${acol(a.k)}"/><text x="${x1 + nw + 10}" y="${(a.y + a.h / 2 + 4).toFixed(1)}" font-size="12.5" style="fill:var(--text)"><tspan font-weight="600">${a.l}</tspan><tspan dx="8" font-size="10.5" style="fill:var(--muted);font-family:var(--f-mono)">λ = ${fr(a.v, a.v >= 0.1 ? 3 : 4)} · ${fr(a.v / tot * 100, 1)} %</tspan></text>`; });
  return { svg: s + "</svg>", tot };
}
function svgNet(r, mode, thr) {
  const R = mode === "partiel" ? partialCorr(r.R) : r.R; if (!R) return { svg: `<p class="panel-sub">Matrice des corrélations non inversible : corrélations partielles indisponibles.</p>`, n: 0 };
  const ord = varOrder(r), p = r.p, W = 660, H = 470, cx = 330, cy = 234, rad = 150, pos = {};
  ord.forEach((j, m) => { const a = -Math.PI / 2 + 2 * Math.PI * m / p; pos[j] = [cx + rad * Math.cos(a), cy + rad * Math.sin(a), a]; });
  let s = SVGH(W, H).replace("<svg ", '<svg class="cnet" '), glow = "", ed = "", lab = "", n = 0;
  s += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" style="stroke:var(--line)" stroke-dasharray="2 5"/>`;
  const E = []; for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) if (Math.abs(R[i][j]) >= thr) E.push([i, j, R[i][j]]);
  E.sort((a, b) => Math.abs(a[2]) - Math.abs(b[2])).forEach(([i, j, v]) => { n++; const [x1, y1] = pos[i], [x2, y2] = pos[j], qx = cx + (x1 + x2 - 2 * cx) * 0.2, qy = cy + (y1 + y2 - 2 * cy) * 0.2, c = v >= 0 ? "var(--pos)" : "var(--neg)", a = Math.abs(v), d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    if (a >= 0.5) glow += `<path d="${d}" fill="none" style="stroke:${c}" stroke-width="${(8 + 12 * a).toFixed(1)}" stroke-opacity=".1" stroke-linecap="round"/>`;
    ed += `<path d="${d}" fill="none" style="stroke:${c}" stroke-width="${(1 + 9 * a).toFixed(1)}" stroke-opacity="${(0.28 + 0.62 * a).toFixed(2)}" stroke-linecap="round"><title>${esc(r.vars[i])} – ${esc(r.vars[j])} : r = ${frs(v)}</title></path>`;
    if (a >= 0.45) { const mx = 0.25 * x1 + 0.5 * qx + 0.25 * x2, my = 0.25 * y1 + 0.5 * qy + 0.25 * y2; lab += `<text x="${mx.toFixed(1)}" y="${(my + 3.5).toFixed(1)}" text-anchor="middle" font-size="10.5" class="elab" style="fill:${c}">${frs(v)}</text>`; } });
  let nodes = ""; ord.forEach(j => { const [x, y, a] = pos[j], c = `var(--a${dominantAxis(r.vcos2[j], r.nAxes) + 1})`, ca = Math.cos(a), lx = cx + (rad + 18) * ca, ly = cy + (rad + 18) * Math.sin(a) + 4, anc = ca > 0.25 ? "start" : ca < -0.25 ? "end" : "middle";
    nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" style="fill:${c}" fill-opacity=".14"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" style="fill:${c}"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anc}" font-size="12" font-weight="600" style="fill:var(--text)">${esc(r.vars[j].length > 20 ? r.vars[j].slice(0, 19) + "…" : r.vars[j])}</text>`; });
  return { svg: s + glow + ed + lab + nodes + "</svg>", n, R };
}
function svgScatter(w, h, xm, ym, xl, yl, body) {
  const L = 54, B = 42, T = 14, R = 14, X = x => L + (w - L - R) * x / xm, Y = y => h - B - (h - T - B) * y / ym, sx = niceStep(xm / 4), sy = niceStep(ym / 4);
  let s = SVGH(w, h);
  for (let v = 0; v <= xm * 1.0001; v += sx) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${h - B}" style="stroke:var(--line)"/><text x="${X(v)}" y="${h - B + 15}" text-anchor="middle" font-size="10.5" style="fill:var(--faint);font-family:var(--f-mono)">${fmtv(v)}</text>`;
  for (let v = 0; v <= ym * 1.0001; v += sy) s += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${L - 7}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10.5" style="fill:var(--faint);font-family:var(--f-mono)">${fmtv(v)}</text>`;
  s += `<text x="${(L + w - R) / 2}" y="${h - 8}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${xl}</text><text transform="translate(14,${(T + h - B) / 2}) rotate(-90)" text-anchor="middle" font-size="12" style="fill:var(--muted)">${yl}</text>`;
  return s + body(X, Y) + "</svg>";
}
function svgShepard(r, sh, k) {
  const mx = Math.max(sh.maxD, 1e-9) * 1.04, big = sh.D.length > 1500;
  return svgScatter(600, 390, mx, mx, "Distance réelle (toutes les dimensions)", `Distance sur ${pl(k, "axe")}`, (X, Y) =>
    `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(mx)}" y2="${Y(mx)}" style="stroke:var(--amber)" stroke-dasharray="5 5" stroke-width="1.5"/><text x="${X(mx) - 6}" y="${Y(mx) + 16}" text-anchor="end" font-size="11" style="fill:var(--amber)">distance conservée</text>` +
    sh.D.map((D, i) => { const d = sh.d[i], t = D > 1e-9 ? d / D : 1; return `<circle cx="${X(D).toFixed(1)}" cy="${Y(d).toFixed(1)}" r="${big ? 1.6 : 2.3}" style="fill:${ramp(1 - t)}" fill-opacity="${big ? 0.4 : 0.6}"/>`; }).join(""));
}
function svgRecon(r, k) {
  const ord = varOrder(r), all = range(r.n).sort((a, b) => r.F[a][0] - r.F[b][0]), rows = all.length > 150 ? range(150).map(q => all[Math.round(q * (all.length - 1) / 149)]) : all, Zh = reconstruct(r, k), p = r.p, cw = 22, ch = clamp(420 / rows.length, 3, 9), gap = 36, top = 92, left = 6, bw = p * cw;
  const blocks = [["Données centrées-réduites", (i, j) => r.Z[i][j]], [`Reconstruit avec ${pl(k, "axe")}`, (i, j) => Zh[i][j]], ["Écart (ce qui manque)", (i, j) => r.Z[i][j] - Zh[i][j]]];
  const w = left + 3 * bw + 2 * gap + 70, h = top + rows.length * ch + 8; let s = SVGH(w, h).replace("<svg ", '<svg class="recon" ');
  blocks.forEach(([title, f], b) => { const x0 = left + b * (bw + gap);
    s += `<text x="${x0}" y="14" font-size="12" font-weight="600" style="fill:var(--text)">${title}</text>`;
    ord.forEach((j, c) => { const nm = r.vars[j].length > 12 ? r.vars[j].slice(0, 11) + "…" : r.vars[j]; s += `<text transform="translate(${x0 + c * cw + cw / 2 + 3},${top - 6}) rotate(-55)" font-size="10" style="fill:var(--muted)">${esc(nm)}</text>`; });
    rows.forEach((i, rr) => ord.forEach((j, c) => { const v = f(i, j), a = clamp(Math.abs(v) / 2.5, 0, 1); s += `<rect x="${x0 + c * cw}" y="${(top + rr * ch).toFixed(1)}" width="${cw - 1.5}" height="${(ch - 0.8).toFixed(1)}" rx="1.5" style="fill:${v >= 0 ? "var(--pos)" : "var(--neg)"}" fill-opacity="${(0.06 + 0.9 * a).toFixed(2)}"><title>${esc(r.names[i])} · ${esc(r.vars[j])} : ${frs(v)}</title></rect>`; })); });
  return s + "</svg>";
}
function svgTQ(r, dg) {
  const xm = maxOf(dg.T2, dg.ucT) * 1.12, ym = maxOf(dg.Q, dg.ucQ || 0) * 1.12;
  return svgScatter(600, 390, xm, ym, `T² de Hotelling (${pl(dg.A, "axe")} retenu${dg.A > 1 ? "s" : ""})`, "Q : écart au modèle", (X, Y) => {
    let s = `<rect x="${X(dg.ucT)}" y="${Y(ym)}" width="${X(xm) - X(dg.ucT)}" height="${Y(0) - Y(ym)}" style="fill:var(--a2)" fill-opacity=".06"/><rect x="${X(0)}" y="${Y(ym)}" width="${X(xm) - X(0)}" height="${Y(dg.ucQ) - Y(ym)}" style="fill:var(--a1)" fill-opacity=".06"/>`;
    s += `<line x1="${X(dg.ucT)}" x2="${X(dg.ucT)}" y1="${Y(0)}" y2="${Y(ym)}" style="stroke:var(--a2)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${X(dg.ucT) + 5}" y="${Y(ym) + 13}" font-size="10.5" style="fill:var(--a2)">limite T² 95 %</text>`;
    s += `<line x1="${X(0)}" x2="${X(xm)}" y1="${Y(dg.ucQ)}" y2="${Y(dg.ucQ)}" style="stroke:var(--a1)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${X(xm) - 5}" y="${Y(dg.ucQ) - 6}" text-anchor="end" font-size="10.5" style="fill:var(--a1)">limite Q 95 %</text>`;
    const all = dg.T2.map((t, i) => ({ i, t, q: dg.Q[i], st: (t > dg.ucT ? 1 : 0) + (dg.Q[i] > dg.ucQ ? 2 : 0) })), pts = all.length > 2000 ? [...sampleRows(all.length, 1500, 61).map(i => all[i]).filter(o => !o.st), ...all.filter(o => o.st).slice(0, 500)] : all;   // grands tableaux : tous les atypiques (500 au plus) et un echantillon des autres
    const cc = ["var(--muted)", "var(--a2)", "var(--a1)", "var(--amber)"];
    pts.forEach(o => { s += `<circle class="tqp" data-ind="${o.i}" cx="${X(o.t).toFixed(1)}" cy="${Y(o.q).toFixed(1)}" r="${o.st ? 5.5 : 4}" style="fill:${cc[o.st]}" fill-opacity="${o.st ? 0.95 : 0.45}"><title>${esc(r.names[o.i])} · T² = ${fr(o.t)} · Q = ${fr(o.q)}</title></circle>`; });
    s += placeLabels(pts.filter(o => o.st).slice(0, 25).map(o => ({ x: X(o.t), y: Y(o.q), text: r.names[o.i], col: cc[o.st] })), 10.5).map(l => { const lx = l.lx + tw(l.text, 10.5) > 590 ? l.x - 7 - tw(l.text, 10.5) : l.lx; return `<text x="${lx.toFixed(1)}" y="${l.ly.toFixed(1)}" font-size="10.5" style="fill:${l.col}">${esc(l.text)}</text>`; }).join("");
    return s; });
}
function svgGlyphs(r, colors) {
  const ord = varOrder(r), p = r.p, allR = range(r.n).sort((a, b) => r.F[a][0] - r.F[b][0]), rows = allR.length > 120 ? range(120).map(q => allR[Math.round(q * (allR.length - 1) / 119)]) : allR, per = 10, cw = 72, ch = 84, R0 = 25, rr = z => R0 * (0.14 + 0.86 * (clamp(z, -2.5, 2.5) + 2.5) / 5);
  const ang = m => -Math.PI / 2 + 2 * Math.PI * m / p, w = per * cw, h = Math.ceil(rows.length / per) * ch + 4;
  let s = SVGH(w, h).replace("<svg ", '<svg class="glyphs" ');
  rows.forEach((i, g) => { const cx = (g % per) * cw + cw / 2, cy = Math.floor(g / per) * ch + 36, col = colors[i];
    const poly = ord.map((j, m) => { const rad = rr(r.Z[i][j]); return `${(cx + rad * Math.cos(ang(m))).toFixed(1)},${(cy + rad * Math.sin(ang(m))).toFixed(1)}`; }).join(" ");
    s += `<g class="gl" data-ind="${i}"><rect x="${cx - cw / 2 + 2}" y="${cy - 34}" width="${cw - 4}" height="${ch - 4}" rx="10" class="glbg"/>` + ord.map((_, m) => `<line x1="${cx}" y1="${cy}" x2="${(cx + R0 * Math.cos(ang(m))).toFixed(1)}" y2="${(cy + R0 * Math.sin(ang(m))).toFixed(1)}" style="stroke:var(--line)"/>`).join("") +
      `<circle cx="${cx}" cy="${cy}" r="${rr(0).toFixed(1)}" fill="none" style="stroke:var(--line-2)" stroke-dasharray="2 3"/><polygon points="${poly}" style="fill:${col};stroke:${col}" fill-opacity=".24" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<text x="${cx}" y="${cy + 42}" text-anchor="middle" font-size="9.5" style="fill:var(--muted)">${esc(r.names[i].length > 13 ? r.names[i].slice(0, 12) + "…" : r.names[i])}</text><title>${esc(r.names[i])}</title></g>`; });
  const kw = 360, kh = 250, kc = [180, 122], KR = 62; let key = SVGH(kw, kh);
  key += ord.map((j, m) => { const a = ang(m), x = kc[0] + KR * Math.cos(a), y = kc[1] + KR * Math.sin(a), lx = kc[0] + (KR + 12) * Math.cos(a), ly = kc[1] + (KR + 12) * Math.sin(a) + 4, ca = Math.cos(a);
    return `<line x1="${kc[0]}" y1="${kc[1]}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke:var(--line-2)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" style="fill:var(--a${dominantAxis(r.vcos2[j], r.nAxes) + 1})"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${ca > 0.25 ? "start" : ca < -0.25 ? "end" : "middle"}" font-size="10.5" style="fill:var(--text)">${esc(r.vars[j].length > 16 ? r.vars[j].slice(0, 15) + "…" : r.vars[j])}</text>`; }).join("");
  key += `<circle cx="${kc[0]}" cy="${kc[1]}" r="${(KR * rr(0) / R0).toFixed(1)}" fill="none" style="stroke:var(--amber)" stroke-dasharray="3 3"/><text x="${kc[0]}" y="${kh - 6}" text-anchor="middle" font-size="10.5" style="fill:var(--amber)">cercle pointillé = moyenne</text>`;
  return { svg: s + "</svg>", key: key + "</svg>" };
}

/* ------------------------------------------------------------------ panneau Hyperespace */
function pHyper(r) {
  const H = state.hyperUI; if (H.key !== r) Object.assign(H, { key: r, brush: {}, shepK: Math.min(r.nAxes, r.q), recK: Math.min(r.nAxes, r.q) });
  const acp = r.method === "ACP", colors = itemColors(r), pm = pcModel(r); Hyper.pcm = pm; Hyper.colors = colors;
  const S = Math.min(r.q, 3), out = 100 - r.cum[S - 1];
  const intro = `<div class="card wide hy-intro"><div><h3 class="panel-title">Hyperespace <span class="beyond">au-delà du cours</span></h3>
      <p class="panel-sub" style="margin:0">Le nuage vit en <b>${r.q} dimensions</b> ; la 3D n'en montre que ${S}, soit ${pc(r.cum[S - 1])} de l'inertie. Il reste <b>${pc(out)}</b> hors de l'écran : ces outils le rendent visible.</p></div>
      <div class="hy-launch"><button class="launch" type="button" data-hyact="tour" ${r.q < 4 ? "disabled" : ""}><span class="ic">◈</span><span><b>Tour de l'hyperespace</b><small>R<sup>${r.q}</sup> → R³ · touche H</small></span></button>
      ${acp ? `<button class="launch" type="button" data-hyact="anat"><span class="ic">◇</span><span><b>Anatomie de l'ACP</b><small>brut → centré → réduit → tourné · touche A</small></span></button>` : ""}</div></div>`;
  const pc_ = `<div class="card wide"><div class="rowhead"><div><h3 class="panel-title">Coordonnées parallèles <span class="beyond">au-delà du cours</span></h3><p class="panel-sub" style="margin:0">${acp ? "Une ligne par individu, un axe vertical par variable (dans l'ordre du cercle des corrélations : variables voisines = corrélées)." : "Une ligne par " + (r.method === "AFC" ? "ligne du tableau" : "individu") + ", un axe vertical par axe factoriel."} <b>Glissez verticalement sur un axe</b> pour filtrer : la sélection s'allume aussi dans la 3D.${pm.n > 800 ? ` <span class="lod-note">800 lignes tracées sur ${pm.n.toLocaleString("fr-FR")} ; le filtre s'applique à toutes.</span>` : ""}</p></div>
      <div class="pc-ctl"><span class="mono" id="pcCount"></span><button class="btn sm" type="button" data-hyact="pcReset">Effacer les filtres</button><button class="btn sm" type="button" data-hyact="pcView">Voir dans la 3D</button></div></div><div class="svgbox" id="pcBox">${svgParallel(pm, colors, H.brush)}</div></div>`;
  const sk = svgSankey(r), sankey = `<div class="card wide"><h3 class="panel-title">Flux d'inertie <span class="exact">identité exacte</span></h3>
      <p class="panel-sub">${r.method === "ACP" ? "Chaque variable apporte 1 unité d'inertie (sa variance réduite) et la répartit entre les axes selon ses cos² ; chaque axe reçoit exactement sa valeur propre λ." : r.method === "ACM" ? "Chaque variable apporte (m − 1)/K d'inertie (m modalités) et la répartit entre les axes selon η²/K ; chaque axe reçoit exactement λ." : "Chaque ligne apporte son inertie (masse × distance² au centre) et la répartit entre les axes ; chaque axe reçoit exactement λ."} Les flux animés montrent où part l'information.</p>
      <div class="svgbox">${sk.svg}</div><p class="panel-sub mono" style="margin:8px 0 0">Σ des flux = ${fr(sk.tot, 4)} = Σλ = ${fr(sum(r.vals), 4)} <span style="color:var(--ok)">✓</span></p></div>`;
  const shK = H.shepK, sh = shepard(r, shK), kOpts = range(Math.min(r.q, 5)).map(k => k + 1).filter(k => k >= 1);
  const shep = `<div class="card ${acp && diagCache(r).ucQ ? "" : "wide"}"><h3 class="panel-title">Fidélité de la projection <span class="beyond">au-delà du cours</span></h3><p class="panel-sub">Chaque point est une paire ${r.method === "AFC" ? "de lignes" : "d'individus"} : distance réelle contre distance vue sur les premiers axes. Une projection ne peut que rapprocher les points : tout est sous la diagonale.</p>
      <div class="planpick" style="margin-bottom:10px">${kOpts.map(k => `<button type="button" data-shk="${k}" aria-pressed="${k === shK}">${pl(k, "axe")}</button>`).join("")}</div>
      <div class="svgbox">${svgShepard(r, sh, shK)}</div>
      ${sh.sampled ? `<p class="panel-sub" style="margin:6px 0 0">${sh.D.length} paires dessinées sur ${sh.total} ; les statistiques portent sur toutes les paires${sh.approx ? ` d'un échantillon de ${sh.nUsed} individus` : ""}.</p>` : ""}
      <div class="stat" style="margin-top:12px"><div><span>Dispersion conservée</span><b class="mono">${pc(sh.kept * 100)}</b><small>${sh.approx ? "≈" : "="} inertie des ${pl(shK, "premier axe", "premiers axes")} (${pc(r.cum[shK - 1])}) <span style="color:var(--ok)">${sh.approx ? "" : "✓"}</span></small></div>
      <div><span>Corrélation des distances</span><b class="mono">${fr(sh.r, 3)}</b><small>1 = distances parfaitement ordonnées</small></div>
      <div><span>Voisinages préservés</span><b class="mono">${pc(sh.knn * 100)}</b><small>des ${sh.k0} plus proches voisins restent voisins (hasard : ${pc(sh.base * 100)})</small></div></div></div>`;
  let net = "", recon = "", tq = "", gly = "";
  if (acp) {
    const nt = svgNet(r, H.net, H.thr), raw = r.R, par = partialCorr(r.R); let diff = "", cmp = "";
    if (par) { const bar = v => `<i><u style="left:${v >= 0 ? 50 : 50 - Math.abs(v) * 50}%;width:${Math.abs(v) * 50}%;background:${v >= 0 ? "var(--pos)" : "var(--neg)"}"></u></i><b>${frs(v)}</b>`, P = [];
      for (let i = 0; i < r.p; i++) for (let j = i + 1; j < r.p; j++) P.push({ a: r.vars[i], b: r.vars[j], r: raw[i][j], q: par[i][j] });
      cmp = `<div class="pp h"><span>Paire de variables</span><span style="grid-column:span 2">Brute</span><span style="grid-column:span 2">Partielle</span></div>` + P.sort((x, y) => Math.max(Math.abs(y.r), Math.abs(y.q)) - Math.max(Math.abs(x.r), Math.abs(x.q))).slice(0, 10)
        .map(o => `<div class="pp ${Math.abs(o.r) >= H.thr && Math.abs(o.q) < H.thr ? "gone" : ""}"><span title="${esc(o.a)} – ${esc(o.b)}">${esc(o.a)} – ${esc(o.b)}</span>${bar(o.r)}${bar(o.q)}</div>`).join(""); }
    if (par) { const gone = [], born = []; for (let i = 0; i < r.p; i++) for (let j = i + 1; j < r.p; j++) { const a = Math.abs(raw[i][j]) >= H.thr, b = Math.abs(par[i][j]) >= H.thr; if (a && !b) gone.push(`${r.vars[i]} – ${r.vars[j]}`); if (!a && b) born.push(`${r.vars[i]} – ${r.vars[j]}`); }
      diff = `<p class="panel-sub" style="margin:10px 0 0">${gone.length ? `<b>Liens indirects</b> (forts en brut, faibles une fois les autres variables fixées) : ${esc(liste(gone, 4))}.` : "Aucun lien brut ne disparaît en partiel."}${born.length ? ` <b>Liens masqués</b> (révélés en partiel) : ${esc(liste(born, 3))}.` : ""}</p>`; }
    net = `<div class="card wide"><h3 class="panel-title">Réseau des corrélations <span class="beyond">au-delà du cours</span></h3><p class="panel-sub">${H.net === "partiel" ? "Corrélation <b>partielle</b> : le lien entre deux variables une fois l'effet de toutes les autres retiré (calculée depuis R⁻¹). Un lien qui disparaît était indirect." : "Corrélation <b>brute</b> de Pearson. Bleu : les variables montent ensemble ; orange : elles s'opposent. Épaisseur = force du lien."}</p>
      <div class="rowhead"><div class="planpick"><button type="button" data-netm="brut" aria-pressed="${H.net === "brut"}">Brutes</button><button type="button" data-netm="partiel" aria-pressed="${H.net === "partiel"}">Partielles</button></div>
      <label class="thr">|r| ≥ <output id="thrOut">${fr(H.thr, 2)}</output><input type="range" id="thrIn" min="0.1" max="0.8" step="0.05" value="${H.thr}"></label></div>
      <div class="net-grid"><div><div class="svgbox">${nt.svg}</div><p class="panel-sub mono" style="margin:6px 0 0">${pl(nt.n, "lien affiché", "liens affichés")}</p></div><div><h4 class="mini" style="margin-top:4px">Les 10 liens les plus forts : brut contre partiel</h4>${cmp}${diff}</div></div></div>`;
    const k = H.recK, rest = sum(r.vals.slice(k)), ord = varOrder(r);
    recon = `<div class="card wide"><div class="rowhead"><div><h3 class="panel-title">Reconstruction du tableau <span class="beyond">au-delà du cours</span></h3><p class="panel-sub" style="margin:0">Le tableau de données recalculé à partir des seuls ${pl(k, "premier axe", "premiers axes")} (théorème d'Eckart–Young : aucune approximation de même rang ne fait mieux). Une ligne par individu, triés selon l'axe 1${r.n > 150 ? ` (150 lignes régulièrement espacées sur ${r.n})` : ""}.</p></div>
      <div class="rec-ctl"><button class="btn sm" type="button" data-hyact="recPlay" aria-label="Animer le nombre d'axes">▶</button><label>k = <output id="recOut">${k}</output><input type="range" id="recIn" min="1" max="${r.q}" step="1" value="${k}"></label></div></div>
      <div class="rec-grid"><div class="svgbox">${svgRecon(r, k)}</div><div><div class="stat" style="grid-template-columns:1fr"><div><span>Inertie reconstruite</span><b class="mono">${pc(r.cum[k - 1])}</b><small>somme des ${pl(k, "valeur propre", "valeurs propres")} retenue${k > 1 ? "s" : ""} ÷ ${r.p}</small></div>
      <div><span>Erreur moyenne par case</span><b class="mono">${fr(Math.sqrt(rest / r.p), 3)}</b><small>en écarts-types : √(Σλ restantes ÷ p)</small></div></div>
      <h4 class="mini">Variance de chaque variable retrouvée (cos² cumulé)</h4>${ord.map(j => { const q2 = sum(r.coord[j].slice(0, k).map(c => c * c)); return `<div class="r2"><span title="${esc(r.vars[j])}">${esc(r.vars[j])}</span><i><u style="width:${(q2 * 100).toFixed(1)}%;background:var(--a${dominantAxis(r.vcos2[j], r.nAxes) + 1})"></u></i><b class="mono">${pc(q2 * 100)}</b></div>`; }).join("")}</div></div></div>`;
    const dg = diagCache(r);
    if (dg.ucQ) { const fT = r.names.filter((_, i) => dg.T2[i] > dg.ucT), fQ = r.names.filter((_, i) => dg.Q[i] > dg.ucQ);
      tq = `<div class="card"><h3 class="panel-title">Détecteur d'atypiques <span class="beyond">au-delà du cours</span></h3><p class="panel-sub"><b>T²</b> mesure à quel point un individu est extrême <i>dans</i> le plan des ${pl(dg.A, "axe")} retenus ; <b>Q</b> mesure ce qui lui reste <i>hors</i> de ces axes (un Q fort = individu mal représenté, cos² faible). Limites à 95 % (loi bêta pour T², approximation de Box pour Q).</p>
        <div class="svgbox">${svgTQ(r, dg)}</div><p class="panel-sub" style="margin:10px 0 0">${fT.length ? `<b style="color:var(--a2)">Extrêmes dans le modèle</b> : ${esc(liste(fT, 5))}. ` : ""}${fQ.length ? `<b style="color:var(--a1)">Hors modèle</b> : ${esc(liste(fQ, 5))}. ` : ""}${!fT.length && !fQ.length ? "Aucun individu ne dépasse les limites. " : ""}À 95 %, environ ${fr(r.n * 0.05, 1)} fausse${r.n * 0.05 >= 2 ? "s" : ""} alerte${r.n * 0.05 >= 2 ? "s" : ""} sont attendues par hasard. Cliquez un point pour le voir en 3D.</p></div>`; }
    const gg = svgGlyphs(r, colors);
    gly = `<div class="card wide"><h3 class="panel-title">Signatures <span class="beyond">au-delà du cours</span></h3><p class="panel-sub">Chaque individu devient une étoile : un rayon par variable (en écarts-types), dans l'ordre du cercle des corrélations. Triés selon l'axe 1 : les formes évoluent de gauche à droite comme sur la carte.${r.n > 120 ? ` ${r.n} individus : 120 sont montrés, régulièrement espacés le long de l'axe 1.` : ""}</p>
      <div class="gly-wrap"><div class="svgbox gly-key">${gg.key}</div><div class="svgbox gly-grid">${gg.svg}</div></div></div>`;
  }
  return `<div class="grid2">${intro}${pc_}${sankey}${net}${shep}${tq}${recon}${gly}</div>`;
}

/* ------------------------------------------------------------------ interactions du panneau */
const Hyper = {
  pcm: null, colors: null, recTimer: null,
  mount() {
    const svg = $("#pcSvg"); if (svg) this.bindPC(svg); if (Object.keys(state.hyperUI.brush).length) this.applySel(false); else this.syncSel();
    const p = $("#panel");
    p.querySelectorAll("[data-hyact]").forEach(b => (b.onclick = () => this.act(b.dataset.hyact)));
    p.querySelectorAll("[data-shk]").forEach(b => (b.onclick = () => { state.hyperUI.shepK = +b.dataset.shk; this.rerender(); }));
    p.querySelectorAll("[data-netm]").forEach(b => (b.onclick = () => { state.hyperUI.net = b.dataset.netm; this.rerender(); }));
    const thr = $("#thrIn"); if (thr) thr.oninput = () => { state.hyperUI.thr = +thr.value; $("#thrOut").textContent = fr(+thr.value, 2); clearTimeout(this.tt); this.tt = setTimeout(() => this.rerender(), 120); };
    const rec = $("#recIn"); if (rec) rec.oninput = () => { state.hyperUI.recK = +rec.value; this.rerender(); };
  },
  rerender() { const y = scrollY, focus = document.activeElement?.id; renderPanel(); scrollTo(0, y); if (focus) $("#" + focus)?.focus(); },
  act(a) {
    if (a === "tour" || a === "anat") { $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); Stage.startHyper(a); }
    if (a === "pcReset") { state.hyperUI.brush = {}; $("#pcBox").innerHTML = svgParallel(this.pcm, this.colors, {}); this.bindPC($("#pcSvg")); if (state.selSrc === "pc") Sel.clear(); else this.syncSel(); }
    if (a === "pcView") $("#stage").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (a === "recPlay") { clearInterval(this.recTimer); let k = 0; const q = state.res.q; this.recTimer = setInterval(() => { k++; if (k > q || state.tab !== "hyper") return clearInterval(this.recTimer); state.hyperUI.recK = k; this.rerender(); }, 900); }
  },
  selection(brush) {
    const m = this.pcm, keys = Object.keys(brush); if (!keys.length) return null;
    return new Set(range(m.n).filter(i => keys.every(c => { const [lo, hi] = brush[c], v = m.vals[i][c]; return v >= lo - 1e-12 && v <= hi + 1e-12; })));
  },
  applySel(push = true, brush = state.hyperUI.brush) {
    const m = this.pcm; if (!m) return; const sel = this.selection(brush); this.paint(sel);
    if (!push) return; if (sel) Sel.set([...sel], "pc"); else if (state.selSrc === "pc") Sel.clear();
  },
  paint(sel) {
    const m = this.pcm; if (!m) return;
    document.querySelectorAll("#pcSvg .pc-lines path").forEach(el => { const i = +el.dataset.i; el.classList.toggle("off", !!sel && !sel.has(i)); el.classList.toggle("on", !!sel && sel.has(i)); });
    const c = $("#pcCount"); if (c) c.textContent = sel ? `${sel.size} / ${m.n} sélectionné${sel.size > 1 ? "s" : ""}` : `${m.n} ${m.kind === "row" ? "lignes" : "individus"}`;
  },
  syncSel() { if (state.selSrc === "pc") return; this.paint(state.sel.size ? state.sel : null); },
  bindPC(svg) {
    const m = this.pcm; let drag = null;
    const toY = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()).y; };
    const range_ = d => { const a = clamp(Math.min(d.y0, d.y1), m.T, m.h - m.B), b = clamp(Math.max(d.y0, d.y1), m.T, m.h - m.B); return [a, b]; };
    svg.addEventListener("pointerdown", e => { const hit = e.target.closest(".pc-hit"); if (!hit) return; e.preventDefault(); drag = { c: +hit.dataset.c, y0: toY(e), y1: null, el: null }; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener("pointermove", e => {
      if (!drag) return; drag.y1 = toY(e); if (Math.abs(drag.y1 - drag.y0) < 3) return;
      if (!drag.el) { drag.el = document.createElementNS("http://www.w3.org/2000/svg", "rect"); drag.el.setAttribute("class", "pc-brush live"); drag.el.setAttribute("rx", 4); svg.appendChild(drag.el); }
      const [a, b] = range_(drag), x = m.X(drag.c); drag.el.setAttribute("x", x - 9); drag.el.setAttribute("width", 18); drag.el.setAttribute("y", a); drag.el.setAttribute("height", Math.max(b - a, 2));
      const tmp = { ...state.hyperUI.brush, [drag.c]: [m.V(drag.c, b), m.V(drag.c, a)] }; this.paint(this.selection(tmp));
    });
    const end = () => {
      if (!drag) return; const d = drag; drag = null; const B = state.hyperUI.brush;
      if (d.y1 === null || Math.abs(d.y1 - d.y0) < 3) delete B[d.c]; else { const [a, b] = range_(d); B[d.c] = [m.V(d.c, b), m.V(d.c, a)]; }
      $("#pcBox").innerHTML = svgParallel(m, this.colors, B); this.bindPC($("#pcSvg")); this.applySel();
    };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    svg.addEventListener("click", e => { const path = e.target.closest(".pc-lines path"); if (path) { if (e.ctrlKey || e.metaKey) Sel.set([+path.dataset.i], "clic", "toggle"); else Stage.selectRef(m.kind, +path.dataset.i); } });
  },
  leave() { clearInterval(this.recTimer); },
};
