
/* ------------------------------------------------------------------ graphiques SVG */
const PAL_UI = { id: "u", text: "var(--text)", muted: "var(--muted)", faint: "var(--faint)", line: "var(--line)", line2: "var(--line-2)", a: ["var(--a1)", "var(--a2)", "var(--a3)"], pos: "var(--pos)", neg: "var(--neg)", amber: "var(--amber)", bg: "var(--bg-2)", g: range(10).map(i => `var(--g${i + 1})`), mono: "var(--f-mono)" };
const PAL_PAPER = { id: "p", text: "#1B2030", muted: "#6B7185", faint: "#9AA0AF", line: "#E6E1D6", line2: "#CFC8B8", a: ["#E0512B", "#0E97AB", "#6A50DD"], pos: "#0E97AB", neg: "#E0512B", amber: "#C98A10", bg: "#F6F2EA", g: ["#0E97AB", "#E0512B", "#6A50DD", "#C98A10", "#D23F8B", "#1E9E6B", "#3D6FD8", "#454B5C", "#9A5B2E", "#7B8499"], mono: "JetBrains Mono, Consolas, monospace" };
const tw = (s, fs) => String(s).length * fs * 0.56;
const SVGH = (w, h) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans, Segoe UI, sans-serif">`;
function placeLabels(items, fs) {       // placement glouton : pas de chevauchement entre etiquettes
  const placed = [];
  items.slice().sort((a, b) => a.y - b.y).forEach(it => {
    const w = tw(it.text, fs) + 6, h = fs + 4; let x = it.x + 7, y = it.y - 4;
    const hit = yy => placed.some(p => x < p.x + p.w && x + w > p.x && yy - h < p.y && yy > p.y - p.h);
    if (hit(y)) { const cands = []; placed.forEach(p => { if (x < p.x + p.w && x + w > p.x) cands.push(p.y + h + 1, p.y - p.h - 1); }); cands.sort((a, b) => Math.abs(a - y) - Math.abs(b - y)); for (const cy of cands) if (!hit(cy)) { y = cy; break; } }
    it.lx = x; it.ly = y; placed.push({ x, y, w, h });
  });
  return items;
}
function svgScree(res, P, w = 640, h = 280, extra = null) {
  const v = res.vals.slice(0, 12), hi = extra?.hi ? extra.hi.slice(0, v.length) : null, horn = extra?.horn ? extra.horn.slice(0, v.length) : null;
  const m = maxOf(v, res.threshold, (hi || [0]), (horn || [0])) * 1.15, L = 44, R = 16, T = 18, B = 46, bw = (w - L - R) / v.length;
  const y = x => T + (h - T - B) * (1 - x / m); let s = SVGH(w, h);
  s += `<defs>${[0, 1, 2].map(i => `<linearGradient id="sg${i}${P.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.a[i]}"/><stop offset="1" stop-color="${P.a[i]}" stop-opacity=".22"/></linearGradient>`).join("")}</defs>`;
  [0, .25, .5, .75, 1].forEach(f => { const yy = y(m * f / 1.15); s += `<line x1="${L}" x2="${w - R}" y1="${yy}" y2="${yy}" style="stroke:${P.line}"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end" font-size="10.5" style="fill:${P.faint}">${fr(m * f / 1.15, m > 3 ? 1 : 2)}</text>`; });
  v.forEach((x, i) => {
    const X = L + i * bw + bw * .18, W = bw * .64, ret = i < res.nAxes, fill = ret && i < 3 ? `url(#sg${i}${P.id})` : P.line2;
    s += `<rect x="${X}" y="${y(x)}" width="${W}" height="${Math.max(0, y(0) - y(x))}" rx="4" style="fill:${fill};opacity:${ret ? 1 : .7}"><title>Axe ${i + 1} : λ = ${fr(x, 3)}</title></rect>`;
    if (hi) { const lo = extra.lo[i], up = hi[i], cx = X + W / 2; s += `<line x1="${cx}" x2="${cx}" y1="${y(up)}" y2="${y(lo)}" stroke-width="1.6" style="stroke:${P.text}"/><line x1="${cx - 6}" x2="${cx + 6}" y1="${y(up)}" y2="${y(up)}" stroke-width="1.6" style="stroke:${P.text}"/><line x1="${cx - 6}" x2="${cx + 6}" y1="${y(lo)}" y2="${y(lo)}" stroke-width="1.6" style="stroke:${P.text}"/>`; }
    s += `<text x="${X + W / 2}" y="${y(hi ? hi[i] : x) - 6}" text-anchor="middle" font-size="11" font-weight="600" style="fill:${P.text};font-family:${P.mono}">${fr(x, x >= .1 ? 2 : 3)}</text>`;
    s += `<text x="${X + W / 2}" y="${h - B + 17}" text-anchor="middle" font-size="11" style="fill:${P.muted}">Axe ${i + 1}</text><text x="${X + W / 2}" y="${h - B + 31}" text-anchor="middle" font-size="10" style="fill:${P.faint};font-family:${P.mono}">${fr(res.cum[i], 0)} %</text>`;
  });
  if (horn) { s += `<polyline fill="none" stroke-width="2" style="stroke:${P.amber}" points="${horn.map((hv, i) => `${L + i * bw + bw / 2},${y(hv)}`).join(" ")}"/>` + horn.map((hv, i) => `<circle cx="${L + i * bw + bw / 2}" cy="${y(hv)}" r="3.2" style="fill:${P.amber}"/>`).join("") + `<text x="${L + (horn.length - 1) * bw + bw / 2}" y="${y(horn.at(-1)) - 10}" text-anchor="end" font-size="11" style="fill:${P.amber}">hasard (Horn 95 %)</text>`; }
  const ty = y(res.threshold); s += `<line x1="${L}" x2="${w - R}" y1="${ty}" y2="${ty}" stroke-dasharray="5 4" stroke-width="1.5" style="stroke:${P.neg}"/><text x="${w - R}" y="${ty - 6}" text-anchor="end" font-size="11" style="fill:${P.neg}">${esc(res.thresholdLabel)}</text>`;
  return s + `<line x1="${L}" x2="${w - R}" y1="${y(0)}" y2="${y(0)}" style="stroke:${P.line2}"/></svg>`;
}
function dominantAxis(cos2row, S) { let b = 0; for (let k = 1; k < Math.min(S, 3); k++) if (cos2row[k] > cos2row[b]) b = k; return b; }
function svgCircle(res, a, b, P, size = 440) {
  const c = size / 2, R = size / 2 - 42, X = v => c + v * R, Y = v => c - v * R;
  let s = SVGH(size, size);
  s += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" style="stroke:${P.line2}"/><circle cx="${c}" cy="${c}" r="${R * Math.SQRT1_2}" fill="none" stroke-dasharray="3 4" style="stroke:${P.line2}"/>`;
  s += `<line x1="${c - R - 12}" x2="${c + R + 12}" y1="${c}" y2="${c}" style="stroke:${P.line}"/><line y1="${c - R - 12}" y2="${c + R + 12}" x1="${c}" x2="${c}" style="stroke:${P.line}"/>`;
  s += `<text x="${size - 6}" y="${c - 8}" text-anchor="end" font-size="11" style="fill:${P.muted}">Axe ${a + 1} · ${pc(res.pct[a])}</text><text x="${c + 8}" y="16" font-size="11" style="fill:${P.muted}">Axe ${b + 1} · ${pc(res.pct[b])}</text>`;
  const items = res.vars.map((v, j) => { const x = res.coord[j][a], y = res.coord[j][b], col = P.a[dominantAxis(res.vcos2[j], res.nAxes)]; return { x: X(x), y: Y(y), text: v, col, ang: Math.atan2(-y, x) }; });
  items.forEach(it => { const ux = Math.cos(it.ang), uy = Math.sin(it.ang); s += `<line x1="${c}" y1="${c}" x2="${it.x - ux * 7}" y2="${it.y - uy * 7}" stroke-width="2.2" stroke-linecap="round" style="stroke:${it.col}"/><path d="M${it.x} ${it.y} L${it.x - ux * 10 - uy * 5} ${it.y - uy * 10 + ux * 5} L${it.x - ux * 10 + uy * 5} ${it.y - uy * 10 - ux * 5}Z" style="fill:${it.col}"/>`; });
  placeLabels(items, 11.5).forEach(it => { const lx = it.lx + tw(it.text, 11.5) > size ? it.x - 7 - tw(it.text, 11.5) : it.lx; s += `<text x="${lx}" y="${it.ly}" font-size="11.5" font-weight="600" style="fill:${P.text}">${esc(it.text)}</text>`; });
  return s + `</svg>`;
}
function svgPlan(pts, a, b, res, P, opts = {}) {
  const w = opts.w || 660, h = opts.h || 440, L = 40, Rm = 16, T = 20, B = 34;
  const xs = pts.map(p => p.v[a]), ys = pts.map(p => p.v[b]); const mx = maxOf(xs.map(Math.abs), 1e-9) * 1.18, my = maxOf(ys.map(Math.abs), 1e-9) * 1.18;
  const X = v => L + (v + mx) / (2 * mx) * (w - L - Rm), Y = v => T + (my - v) / (2 * my) * (h - T - B);
  let s = SVGH(w, h);
  s += `<rect x="${L}" y="${T}" width="${w - L - Rm}" height="${h - T - B}" rx="10" fill="none" style="stroke:${P.line}"/>`;
  s += `<line x1="${L}" x2="${w - Rm}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:${P.line2}"/><line y1="${T}" y2="${h - B}" x1="${X(0)}" x2="${X(0)}" style="stroke:${P.line2}"/>`;
  s += `<text x="${w - Rm}" y="${h - 10}" text-anchor="end" font-size="11" style="fill:${P.muted}">Axe ${a + 1} · ${pc(res.pct[a])}${axisName(a) ? " · " + esc(axisName(a)) : ""}</text><text x="${L}" y="12" font-size="11" style="fill:${P.muted}">Axe ${b + 1} · ${pc(res.pct[b])}${axisName(b) ? " · " + esc(axisName(b)) : ""}</text>`;
  const sc = .85 * Math.min(mx, my);
  if (opts.arrows) opts.arrows.forEach(ar => { const x2 = X(ar.v[a] * sc), y2 = Y(ar.v[b] * sc); s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${x2}" y2="${y2}" stroke-width="1.8" style="stroke:${ar.col}"/><circle cx="${x2}" cy="${y2}" r="3" style="fill:${ar.col}"/>`; });
  pts.forEach(p => { const cx = X(p.v[a]), cy = Y(p.v[b]); s += p.shape === "tri" ? `<path d="M${cx} ${cy - p.r * 1.2} L${cx + p.r} ${cy + p.r * .8} L${cx - p.r} ${cy + p.r * .8}Z" style="fill:${p.col}"/>` : `<circle cx="${cx}" cy="${cy}" r="${p.r}" style="fill:${p.col};opacity:${p.op ?? .9}"><title>${esc(p.label)}</title></circle>`; });
  const labs = pts.filter(p => p.lab).map(p => ({ x: X(p.v[a]), y: Y(p.v[b]), text: p.label, bold: p.bold }));
  if (opts.arrows) opts.arrows.forEach(ar => labs.push({ x: X(ar.v[a] * sc), y: Y(ar.v[b] * sc), text: ar.label, bold: true }));
  placeLabels(labs, 10.5).forEach(it => { const lx = it.lx + tw(it.text, 10.5) > w - 4 ? it.x - 7 - tw(it.text, 10.5) : it.lx; s += `<text x="${lx}" y="${it.ly}" font-size="10.5" ${it.bold ? 'font-weight="600"' : ""} style="fill:${it.bold ? P.text : P.muted}">${esc(it.text)}</text>`; });
  return s + `</svg>`;
}
// carre des liaisons (AFDM) : chaque variable placee selon sa liaison avec deux axes, r^2 (quantitative) ou eta^2 (qualitative), entre 0 et 1
function svgLinkMap(res, a, b, P, size = 440) {
  const L = 44, T = 18, R = 18, B = 40, W = size, H = size, X = v => L + (W - L - R) * clamp(v, 0, 1), Y = v => H - B - (H - B - T) * clamp(v, 0, 1); let s = SVGH(W, H);
  [0, .25, .5, .75, 1].forEach(t => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H - B}" style="stroke:${P.line}"/><line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" style="stroke:${P.line}"/><text x="${X(t)}" y="${H - B + 15}" text-anchor="middle" font-size="10" style="fill:${P.faint}">${fr(t, 2)}</text><text x="${L - 7}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10" style="fill:${P.faint}">${fr(t, 2)}</text>`; });
  s += `<text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="11" style="fill:${P.muted}">Axe ${a + 1} · ${pc(res.pct[a])}</text><text transform="translate(12,${T + 4}) rotate(90)" font-size="11" style="fill:${P.muted}">Axe ${b + 1} · ${pc(res.pct[b])}</text>`;
  const items = res.link.map(l => ({ x: X(l.r2[a]), y: Y(l.r2[b]), text: l.v, q: l.type === "q" }));
  items.forEach(it => { s += it.q ? `<circle cx="${it.x}" cy="${it.y}" r="5" style="fill:${P.a[1]}"/>` : `<rect x="${it.x - 4.5}" y="${it.y - 4.5}" width="9" height="9" rx="1.5" style="fill:${P.a[0]}"/>`; });
  placeLabels(items, 11).forEach(it => { const lx = it.lx + tw(it.text, 11) > W - 4 ? it.x - 8 - tw(it.text, 11) : it.lx; s += `<text x="${lx}" y="${it.ly}" font-size="11" font-weight="600" style="fill:${P.text}">${esc(it.text)}</text>`; });
  s += `<circle cx="${L + 10}" cy="${T + 6}" r="4.5" style="fill:${P.a[1]}"/><text x="${L + 20}" y="${T + 10}" font-size="10.5" style="fill:${P.muted}">quantitative · r²</text><rect x="${L + 116}" y="${T + 2}" width="8" height="8" rx="1.5" style="fill:${P.a[0]}"/><text x="${L + 130}" y="${T + 10}" font-size="10.5" style="fill:${P.muted}">qualitative · η²</text>`;
  return s + `</svg>`;
}
// carre des liaisons (AFDM) : chaque variable placee selon sa liaison avec deux axes, r^2 (quantitative) ou eta^2 (qualitative), entre 0 et 1
function svgLinkMap(res, a, b, P, size = 440) {
  const L = 44, T = 18, R = 18, B = 40, W = size, H = size, X = v => L + (W - L - R) * clamp(v, 0, 1), Y = v => H - B - (H - B - T) * clamp(v, 0, 1); let s = SVGH(W, H);
  [0, .25, .5, .75, 1].forEach(t => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H - B}" style="stroke:${P.line}"/><line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" style="stroke:${P.line}"/><text x="${X(t)}" y="${H - B + 15}" text-anchor="middle" font-size="10" style="fill:${P.faint}">${fr(t, 2)}</text><text x="${L - 7}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10" style="fill:${P.faint}">${fr(t, 2)}</text>`; });
  s += `<text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="11" style="fill:${P.muted}">Axe ${a + 1} · ${pc(res.pct[a])}</text><text transform="translate(12,${T + 4}) rotate(90)" font-size="11" style="fill:${P.muted}">Axe ${b + 1} · ${pc(res.pct[b])}</text>`;
  const items = res.link.map(l => ({ x: X(l.r2[a]), y: Y(l.r2[b]), text: l.v, q: l.type === "q" }));
  items.forEach(it => { s += it.q ? `<circle cx="${it.x}" cy="${it.y}" r="5" style="fill:${P.a[1]}"/>` : `<rect x="${it.x - 4.5}" y="${it.y - 4.5}" width="9" height="9" rx="1.5" style="fill:${P.a[0]}"/>`; });
  placeLabels(items, 11).forEach(it => { const lx = it.lx + tw(it.text, 11) > W - 4 ? it.x - 8 - tw(it.text, 11) : it.lx; s += `<text x="${lx}" y="${it.ly}" font-size="11" font-weight="600" style="fill:${P.text}">${esc(it.text)}</text>`; });
  s += `<circle cx="${L + 10}" cy="${T + 6}" r="4.5" style="fill:${P.a[1]}"/><text x="${L + 20}" y="${T + 10}" font-size="10.5" style="fill:${P.muted}">quantitative · r²</text><rect x="${L + 116}" y="${T + 2}" width="8" height="8" rx="1.5" style="fill:${P.a[0]}"/><text x="${L + 130}" y="${T + 10}" font-size="10.5" style="fill:${P.muted}">qualitative · η²</text>`;
  return s + `</svg>`;
}
function svgHeat(M, rowL, colL, P, opts = {}) {
  const I = rowL.length, J = colL.length, fs = 11, lw = Math.min(150, maxOf(rowL.map(l => tw(l, fs))) + 14), cw = clamp(((opts.w || 560) - lw) / J, 40, 72), ch = 28, top = opts.rot ? 84 : 28;
  const lastL = colL[J - 1] || "", lastW = tw(lastL.length > 18 ? lastL.slice(0, 17) + "…" : lastL, fs), padR = opts.rot ? Math.max(10, 10 - cw / 2 + lastW * Math.cos(40 * Math.PI / 180)) : 10;
  const w = lw + J * cw + padR, h = top + I * ch + 8; let s = SVGH(w, h);
  colL.forEach((c, j) => { const x = lw + j * cw + cw / 2; s += opts.rot ? `<text transform="translate(${x + 4},${top - 8}) rotate(-40)" font-size="${fs}" style="fill:${P.muted}">${esc(c.length > 18 ? c.slice(0, 17) + "…" : c)}</text>` : `<text x="${x}" y="${top - 10}" text-anchor="middle" font-size="${fs}" style="fill:${P.muted}">${esc(c.length > 12 ? c.slice(0, 11) + "…" : c)}</text>`; });
  rowL.forEach((r, i) => { s += `<text x="${lw - 8}" y="${top + i * ch + ch / 2 + 4}" text-anchor="end" font-size="${fs}" style="fill:${P.text}">${esc(r.length > 20 ? r.slice(0, 19) + "…" : r)}</text>`;
    colL.forEach((_, j) => { if (opts.tri && j > i) return; const v = M[i][j], cell = opts.cell ? opts.cell(v, i, j) : { t: frs(v), f: v }; const f = clamp(cell.f, -1, 1), col = f >= 0 ? P.pos : P.neg;
      s += `<rect x="${lw + j * cw + 1}" y="${top + i * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="5" style="fill:${col};fill-opacity:${(Math.abs(f) * .85).toFixed(3)}"/><rect x="${lw + j * cw + 1}" y="${top + i * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="5" fill="none" style="stroke:${P.line}"/>`;
      s += `<text x="${lw + j * cw + cw / 2}" y="${top + i * ch + ch / 2 + 4}" text-anchor="middle" font-size="10.5" style="fill:${P.text};font-family:${P.mono}">${cell.t}</text>`; }); });
  return s + `</svg>`;
}
function svgDiverging(items, seuil, P, col, w = 820) {   // contributions signees : cote − a gauche, cote + a droite
  const rows = items.slice(0, 12), h = 22 * rows.length + 34, mid = w / 2, mxc = maxOf(rows.map(r => r.c), seuil) * 1.1, sc = (mid - 150) / mxc;
  let s = SVGH(w, h);
  s += `<text x="${mid - 8}" y="12" text-anchor="end" font-size="10.5" style="fill:${P.faint}">CÔTÉ −</text><text x="${mid + 8}" y="12" font-size="10.5" style="fill:${P.faint}">CÔTÉ +</text>`;
  [-1, 1].forEach(sg => (s += `<line x1="${mid + sg * seuil * sc}" x2="${mid + sg * seuil * sc}" y1="20" y2="${h - 6}" stroke-dasharray="3 3" style="stroke:${P.line2}"/>`));
  s += `<line x1="${mid}" x2="${mid}" y1="18" y2="${h - 4}" style="stroke:${P.line2}"/>`;
  rows.forEach((r, i) => { const y = 24 + i * 22, bw = r.c * sc, strong = r.c > seuil, x = r.s < 0 ? mid - bw : mid;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="14" rx="3" style="fill:${strong ? col : P.line2};opacity:${strong ? (r.s < 0 ? .55 : .95) : .6}"/>`;
    const lab = esc(r.l.length > 26 ? r.l.slice(0, 25) + "…" : r.l);
    s += r.s < 0 ? `<text x="${x - 6}" y="${y + 11}" text-anchor="end" font-size="11" style="fill:${strong ? P.text : P.muted}">${lab} <tspan style="fill:${P.faint};font-family:${P.mono}">${fr(r.c, 1)}</tspan></text>` : `<text x="${x + bw + 6}" y="${y + 11}" font-size="11" style="fill:${strong ? P.text : P.muted}"><tspan style="fill:${P.faint};font-family:${P.mono}">${fr(r.c, 1)}</tspan> ${lab}</text>`; });
  return s + `</svg>`;
}
function svgSil(scores, best, P, w = 560, h = 220) {    // silhouette moyenne selon le nombre de classes
  const ks = scores.map(s => s.k), m = maxOf(scores.map(s => s.s), 0.1) * 1.2, L = 40, R = 14, T = 16, B = 34, bw = (w - L - R) / ks.length;
  const y = v => T + (h - T - B) * (1 - v / m); let s = SVGH(w, h);
  [0, .5, 1].forEach(f => { const yy = y(m * f / 1.2); s += `<line x1="${L}" x2="${w - R}" y1="${yy}" y2="${yy}" style="stroke:${P.line}"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="10" style="fill:${P.faint}">${fr(m * f / 1.2, 2)}</text>`; });
  scores.forEach((sc, i) => { const X = L + i * bw + bw * .2, W = bw * .6, on = sc.k === best; s += `<rect x="${X}" y="${y(sc.s)}" width="${W}" height="${y(0) - y(sc.s)}" rx="4" style="fill:${on ? P.a[2] : P.line2}"/><text x="${X + W / 2}" y="${y(sc.s) - 6}" text-anchor="middle" font-size="10.5" style="fill:${P.text};font-family:${P.mono}">${fr(sc.s, 2)}</text><text x="${X + W / 2}" y="${h - 14}" text-anchor="middle" font-size="11" style="fill:${P.muted}">k = ${sc.k}</text>`; });
  return s + `</svg>`;
}
function svgSpark(vals, n = 8) {
  const v = vals.slice(0, n), m = maxOf(v), w = 70, h = 28, bw = w / v.length;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${v.map((x, i) => `<rect x="${i * bw + 1}" y="${h - x / m * h}" width="${bw - 2}" height="${x / m * h}" rx="1.5" style="fill:${i < 3 ? `var(--a${i + 1})` : "var(--line-2)"}"/>`).join("")}</svg>`;
}
// methodes : ACP et AFDM ont des variables quantitatives (cercle, fleches) ; ACM et AFDM ont des modalites
const hasQ = r => r.method === "ACP" || r.method === "AFDM", hasM = r => r.method === "ACM" || r.method === "AFDM";
function contribItems(res, k) {
  if (res.method === "AFDM") return res.vars.map((l, j) => ({ l, c: res.vctr[j][k], s: Math.sign(res.coord[j][k]) })).concat(res.mods.map((l, j) => ({ l, c: res.mctr[j][k], s: Math.sign(res.G[j][k]) }))).sort((a, b) => b.c - a.c);
  if (res.method === "ACP") return res.vars.map((l, j) => ({ l, c: res.vctr[j][k], s: Math.sign(res.coord[j][k]) })).sort((a, b) => b.c - a.c);
  if (res.method === "ACM") return res.mods.map((l, j) => ({ l, c: res.mctr[j][k], s: Math.sign(res.G[j][k]) })).sort((a, b) => b.c - a.c);
  return res.rowL.map((l, i) => ({ l, c: res.rctr[i][k], s: Math.sign(res.F[i][k]) })).concat(res.colL.map((l, j) => ({ l: l + " (col.)", c: res.cctr[j][k] * res.I / res.J, s: Math.sign(res.G[j][k]) }))).sort((a, b) => b.c - a.c);
}
function seuilOf(res) { return res.method === "AFDM" ? 100 / (res.p + res.M) : res.method === "ACP" ? 100 / res.p : res.method === "ACM" ? 100 / res.M : 100 / res.I; }
function groupIndex(res) {
  if (state.colorMode === "hcpc" && res.method !== "AFC") { const hc = Studio.ensureHC(res); if (hc) return { cats: range(hc.k).map(i => `Classe ${i + 1}`), idx: hc.labels }; }
  if (state.colorMode === "user" && state.groups.length && res.method !== "AFC") { const G = state.groups, idx = range(res.n).map(i => { const g = G.findIndex(x => x.idx.has(i)); return g < 0 ? G.length : g; }); return { cats: [...G.map(g => g.name), "Autres"], idx }; }
  if (state.clusters && state.colorMode === "clusters" && res.method !== "AFC" && state.clusters.n === res.n) return { cats: range(state.clusters.k).map(i => `Classe ${i + 1}`), idx: state.clusters.labels };
  if (!res.groups) return null; const cats = [...new Set(res.groups)]; return cats.length > 1 && cats.length <= 10 ? { cats, idx: res.groups.map(g => cats.indexOf(g)) } : null;
}
// graphiques SVG : au-dela de SVGCAP individus, un echantillon est dessine (les plus contributifs sont toujours gardes)
const SVGCAP = 2500;
const svgRows = (n, keep = []) => (n <= SVGCAP ? range(n) : [...new Set([...sampleRows(n, SVGCAP, 53), ...keep])].sort((x, y) => x - y));
function planPoints(res, a, b, P, mods = true) {
  if (res.method === "ACP" || res.method === "AFDM") {
    const gi = groupIndex(res), score = res.F.map(f => f[a] ** 2 / res.vals[a] + f[b] ** 2 / res.vals[b]); const thr = score.slice().sort((x, y) => y - x)[Math.min(13, res.n - 1)], top = range(res.n).filter(i => score[i] >= thr);
    const ind = svgRows(res.n, top).map(i => ({ v: res.F[i], label: res.names[i], col: gi ? P.g[gi.idx[i] % 10] : P.a[1], r: res.n > 800 ? 2.4 : 4, op: res.n > 800 ? 0.6 : 1, lab: res.n <= 14 || score[i] >= thr }));
    if (res.method === "AFDM" && mods) { const vi = res.qvars; return { pts: ind.map(p => ({ ...p, label: "", lab: false, col: P.faint, op: .45 })).concat(res.G.map((g, j) => ({ v: g, label: res.mods[j], col: P.g[vi.indexOf(res.modVar[j]) % 10], r: 5, lab: true, bold: true }))) }; }
    return { pts: ind };
  }
  if (res.method === "ACM") { const vi = [...new Set(res.modVar)];
    return { pts: svgRows(res.n).map(i => ({ v: res.F[i], label: "", col: P.faint, r: 2.4, op: .55 })).concat(res.G.map((g, j) => ({ v: g, label: res.mods[j], col: P.g[vi.indexOf(res.modVar[j]) % 10], r: 5, lab: true, bold: true }))) }; }
  return { pts: res.F.map((f, i) => ({ v: f, label: res.rowL[i], col: P.a[1], r: 5, lab: true, bold: true })).concat(res.G.map((g, j) => ({ v: g, label: res.colL[j], col: P.a[0], r: 6, lab: true, bold: true, shape: "tri" }))) };
}

/* ------------------------------------------------------------------ labo : calculs au-dela du cours */
function chunked(total, step, onProgress, budget = 14) {   // boucle decoupee pour garder l'interface fluide
  return new Promise(done => { let i = 0; const tick = () => { const t0 = performance.now(); while (i < total && performance.now() - t0 < budget) step(i++); onProgress?.(i / total); if (i < total) setTimeout(tick, 0); else done(); }; tick(); });
}
const quant = (arr, p) => { const a = arr.slice().sort((x, y) => x - y), k = (a.length - 1) * p, f = Math.floor(k); return a[f] + (a[Math.min(f + 1, a.length - 1)] - a[f]) * (k - f); };
// taille des sous-echantillons pour les methodes de reechantillonnage sur grands tableaux
const MBOOT = 3000;
async function runHorn(res, B, onP) {   // analyse parallele de Horn ; au-dela de MBOOT lignes, seuils calcules pour n = MBOOT (plus prudents)
  const n = Math.min(res.n, MBOOT), p = res.p, rnd = mulberry(42), out = range(p).map(() => []);
  await chunked(B, () => { const X = range(n).map(() => range(p).map(() => gauss(rnd))); eigSym(corrOf(X)).values.forEach((v, k) => out[k].push(v)); }, onP);
  return out.map(a => quant(a, .95));
}
// bootstrap des valeurs propres. Grands tableaux : bootstrap "m parmi n" (m = MBOOT), ecarts remis a l'echelle sqrt(m / n)
// (estimateurs reguliers en racine de n : Bickel, Gotze & van Zwet 1997). Distribution recentree sur la valeur observee (correction du biais).
async function runBoot(res, B, onP) {
  const rnd = mulberry(7), q = Math.min(res.q, 10), out = range(q).map(() => []), N = res.method === "AFC" ? Math.round(res.n) : res.n, m = Math.min(N, res.method === "AFC" ? 20000 : MBOOT), f = Math.sqrt(m / N);
  let step;
  if (res.method === "ACP") step = () => { const X = range(m).map(() => res.X[Math.floor(rnd() * res.n)]); eigSym(corrOf(X)).values.slice(0, q).forEach((v, k) => out[k].push(v)); };
  else if (res.method === "ACM") step = () => { const A = range(m).map(() => res.answers[Math.floor(rnd() * res.n)]); const c = acmCore(A, res.vars); c.all.slice(0, q).forEach((v, k) => out[k].push(v)); };
  else if (res.method === "AFDM") { const all = res.vars.concat(res.qvars), num = new Set(res.vars);   // AFDM recalculee sur chaque reechantillon (modalite disparue : tirage ignore)
    step = () => { const rows = range(m).map(() => { const i = Math.floor(rnd() * res.n), o = {}; res.vars.forEach((v, j) => (o[v] = res.X[i][j])); res.qvars.forEach((v, j) => (o[v] = res.answers[i][j])); return o; });
      try { const e = runAFDM({ rows, numeric: num }, { vars: all }); if (e.M === res.M) e.vals.slice(0, q).forEach((v, k) => out[k].push(v)); } catch (err) {} }; }
  else if (res.method === "AFDM") { const all = res.vars.concat(res.qvars), num = new Set(res.vars);   // AFDM recalculee sur chaque reechantillon (modalite disparue : tirage ignore)
    step = () => { const rows = range(m).map(() => { const i = Math.floor(rnd() * res.n), o = {}; res.vars.forEach((v, j) => (o[v] = res.X[i][j])); res.qvars.forEach((v, j) => (o[v] = res.answers[i][j])); return o; });
      try { const e = runAFDM({ rows, numeric: num }, { vars: all }); if (e.M === res.M) e.vals.slice(0, q).forEach((v, k) => out[k].push(v)); } catch (err) {} }; }
  else { const cells = [], cum = []; let acc = 0; res.N.forEach((row, i) => row.forEach((x, j) => { cells.push([i, j]); acc += x; cum.push(acc); }));
    step = () => { const T = res.N.map(r => r.map(() => 0)); for (let d = 0; d < m; d++) { const u = rnd() * acc; let lo = 0, hi = cum.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < u) lo = mid + 1; else hi = mid; } T[cells[lo][0]][cells[lo][1]]++; }
      if (T.some(r => sum(r) === 0) || range(T[0].length).some(j => T.every(r => r[j] === 0))) return; afcCore(T).all.slice(0, q).forEach((v, k) => out[k].push(v)); }; }
  await chunked(B, step, onP);
  const med = out.map(a => quant(a, .5)), adj = out.map((a, k) => a.map(v => res.vals[k] + f * (v - med[k])));
  return { lo: adj.map(a => Math.max(0, quant(a, .025))), hi: adj.map(a => quant(a, .975)), med, bias: med.map((x, k) => x - res.vals[k]), above: adj.map(a => a.filter(v => v > res.threshold).length / Math.max(a.length, 1)), B: out[0].length, m, N };
}
// k-means (initialisation k-means++, mise a jour des centres en O(n d)) ; etiquettes triees selon le premier axe
function kmeans(P, k, rnd, restarts = 8) {
  const n = P.length, d = P[0].length, d2 = (a, b) => { let s = 0; for (let i = 0; i < d; i++) { const t = a[i] - b[i]; s += t * t; } return s; };
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const C = [P[Math.floor(rnd() * n)].slice()], D = new Float64Array(n).fill(Infinity);
    while (C.length < k) { const last = C[C.length - 1]; let tot = 0; for (let i = 0; i < n; i++) { const v = d2(P[i], last); if (v < D[i]) D[i] = v; tot += D[i]; } let u = rnd() * tot, i = 0; while (u > D[i] && i < n - 1) u -= D[i++]; C.push(P[i].slice()); }
    const lab = new Int32Array(n).fill(-1);
    for (let it = 0; it < 100; it++) {
      let moved = false; for (let i = 0; i < n; i++) { let bj = 0, bd = Infinity; for (let j = 0; j < k; j++) { const v = d2(P[i], C[j]); if (v < bd) { bd = v; bj = j; } } if (lab[i] !== bj) { lab[i] = bj; moved = true; } }
      const acc = range(k).map(() => new Float64Array(d)), cnt = new Int32Array(k); for (let i = 0; i < n; i++) { const a = acc[lab[i]], p = P[i]; cnt[lab[i]]++; for (let t = 0; t < d; t++) a[t] += p[t]; }
      for (let j = 0; j < k; j++) if (cnt[j]) for (let t = 0; t < d; t++) C[j][t] = acc[j][t] / cnt[j];
      if (!moved) break;
    }
    let inertia = 0; for (let i = 0; i < n; i++) inertia += d2(P[i], C[lab[i]]);
    if (!best || inertia < best.inertia) best = { labels: Array.from(lab), centers: C, inertia };
  }
  const order = range(k).sort((a, b) => best.centers[a][0] - best.centers[b][0]), remap = []; order.forEach((o, i) => (remap[o] = i));
  return { labels: best.labels.map(l => remap[l]), centers: order.map(o => best.centers[o]), inertia: best.inertia };
}
const assignNearest = (P, C) => P.map(p => { let bj = 0, bd = Infinity; C.forEach((c, j) => { let s = 0; for (let t = 0; t < c.length; t++) s += (p[t] - c[t]) ** 2; if (s < bd) { bd = s; bj = j; } }); return bj; });
// silhouette moyenne (Rousseeuw 1987), sur un echantillon de 1 500 points au plus (comme sample_size de scikit-learn)
function silhouette(P0, lab0, k) {
  const idx = P0.length > 1500 ? sampleRows(P0.length, 1500, 13) : range(P0.length), P = idx.map(i => P0[i]), lab = idx.map(i => lab0[i]), n = P.length, D = (a, b) => { let s = 0; for (let t = 0; t < a.length; t++) s += (a[t] - b[t]) ** 2; return Math.sqrt(s); };
  let s = 0; for (let i = 0; i < n; i++) { const m = range(k).map(() => [0, 0]); for (let j = 0; j < n; j++) if (j !== i) { m[lab[j]][0] += D(P[i], P[j]); m[lab[j]][1]++; }
    const a = m[lab[i]][1] ? m[lab[i]][0] / m[lab[i]][1] : 0; let b = Infinity; m.forEach((x, c) => { if (c !== lab[i] && x[1]) b = Math.min(b, x[0] / x[1]); }); s += m[lab[i]][1] && isFinite(b) ? (b - a) / Math.max(a, b) : 0; }
  return s / n;
}
function validity(res) {   // Bartlett et KMO (ACP)
  const p = res.p, n = res.n, e = eigSym(res.R); if (e.values.some(v => v < 1e-10)) return null;
  const inv = range(p).map(i => range(p).map(j => sum(range(p).map(k => e.vectors[i][k] * e.vectors[j][k] / e.values[k]))));
  const logdet = sum(e.values.map(Math.log)), chi2 = -(n - 1 - (2 * p + 5) / 6) * logdet, ddl = p * (p - 1) / 2;
  let r2 = 0, q2 = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) if (i !== j) { r2 += res.R[i][j] ** 2; q2 += (inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j])) ** 2; }
  return { chi2, ddl, pval: chi2sf(chi2, ddl), kmo: r2 / (r2 + q2) };
}
