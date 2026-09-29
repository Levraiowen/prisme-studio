// Mode grands volumes : exactitude puis banc de charge du moteur en colonnes (src/core/big.js).
//   node tests/bench_big.mjs                 controles d'exactitude (decoupage CSV, ACP comparee au moteur standard, filtres)
//   node --max-old-space-size=8192 tests/bench_big.mjs 5000000 20     banc de charge : fichier genere de 5 M lignes x 20 variables
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = JSON.parse(fs.readFileSync(path.join(root, "src/core/order.json"), "utf8"));
const N = +(process.argv[2] || 0), P = +(process.argv[3] || 20);
const stubs = `const matchMedia = () => ({ matches: true }), document = { querySelector: () => null, documentElement: { dataset: {} } }, getComputedStyle = () => ({ getPropertyValue: () => "" }), window = {};
const Papa = { parse: t => ({ data: t.trim().split(/\\r?\\n/).map(l => l.split(",")) }) };\n`;
const body = String.raw`
import fs from "node:fs";
const MB = x => (x / 1048576).toFixed(0) + " Mo";
const T = (l, f) => { const t0 = performance.now(), r = f(); console.log("  " + l.padEnd(46), String(Math.round(performance.now() - t0)).padStart(7), "ms"); return r; };
let fails = 0, checks = 0; const ok = (c, l) => { checks++; if (!c) fails++; console.log((c ? "  ✓ " : "  ✗ ") + l); };
const feed = (bt, u8, chunk) => { bt.init(u8.subarray(0, Math.min(u8.length, 2 << 20)), u8.length); for (let p = 0; p < u8.length; p += chunk) bt.ingest(u8.subarray(p, Math.min(u8.length, p + chunk)), p + chunk >= u8.length); return bt.finish(); };
const enc = s => new TextEncoder().encode(s);
if (!${N}) {
  console.log("Découpage CSV (guillemets, séparateurs dans les champs, CRLF, BOM, frontières de morceaux)");
  const csv = "﻿nom;\"prix (€)\";avis;cat\r\n\"Dupont; Jean\";12,5;\"il a dit \"\"oui\"\"\";A\r\nMartin;7;;B\r\n\"Élodie\";-3,25e1;\"multi\nligne\";A\r\nNA;1 234,5;x;\r\n";
  for (const ch of [1, 2, 3, 5, 7, 11, 64, 1 << 20]) {
    const bt = new BigTable("t.csv"); const s = feed(bt, enc(csv), ch), num = bt.num.find(c => c.name === "prix (€)"), cat = bt.cat.find(c => c.name === "cat");
    const good = s.n === 4 && bt.delim === ";" && bt.dc === 44 && num && [12.5, 7, -32.5, 1234.5].every((v, i) => Math.abs(num.data[i] - v) < 1e-4) && cat && cat.labels.join("|") === "A|B" && cat.data[3] === B_NA;
    ok(good, "morceaux de " + ch + " octet(s) : 4 lignes, « ; » et virgule décimale, nombres et modalités exacts" + (good ? "" : " → n=" + s.n + " delim=" + bt.delim + " " + (num ? Array.from(num.data).join("/") : "?") + " " + (cat ? cat.labels.join("|") : "?")));
  }
  { const bt = new BigTable("q.csv"), s = feed(bt, enc('a,b,c\n1,"x, y",2\n3,"z ""q""",4\n5,,6\n'), 4), c = bt.cols.find(c => c.name === "b"); ok(s.n === 3 && c.role === "cat" && c.labels[0] === "x, y" && c.labels[1] === 'z "q"', "champ entre guillemets contenant le séparateur et des guillemets doublés"); }
  // modalites : plus de 1 000 valeurs distinctes -> "(autres modalites)", jamais de doublon
  { let t = "g,x,y\n"; for (let i = 0; i < 30000; i++) t += (i < 25000 ? "m" + (i % 900) : "z" + i) + "," + (i % 97) + "," + ((i * 7) % 31) + "\n"; const bt = new BigTable("m.csv"); feed(bt, enc(t), 997); const c = bt.cols[0];
    ok(c.role === "cat" && c.labels.length === 1000 && c.overflow === 4900 && new Set(c.labels).size === c.labels.length && sum(Array.from(c.counts)) === 30000, "1 000 modalités au plus, sans doublon, effectifs complets (" + (c.labels ? c.labels.length : c.role) + " modalités + " + c.overflow + " lignes « autres »)"); }
  console.log("\nACP du moteur en colonnes comparée au moteur standard (20 000 lignes, 8 variables, 2 % de manquants)");
  const rnd = mulberry(3), head = ["id", "seg", ...range(8).map(j => "v" + j)], L = [head.join(",")];
  for (let i = 0; i < 20000; i++) { const s = Math.floor(rnd() * 3), f = gauss(rnd) + s; L.push(["r" + i, "S" + s, ...range(8).map(j => rnd() < 0.02 ? "" : (j % 2 ? f * (j + 1) / 4 : -f / 2) + gauss(rnd) * (0.5 + j / 8)).map(v => typeof v === "number" ? v.toFixed(5) : v)].join(",")); }
  const text = L.join("\n"), bt = new BigTable("c.csv"); feed(bt, enc(text), 65536); const a = bt.pca();
  const t = parseCSV(text, "c.csv"), ty = detect(t), r = runACP(t, { vars: ty.quanti, ident: ty.ident });
  const dv = Math.max(...r.vals.map((v, k) => Math.abs(v - a.vals[k]) / v)), dR = Math.max(...r.R.flatMap((row, i) => row.map((x, j) => Math.abs(x - a.R[i][j]))));
  ok(a.N === r.n, "mêmes lignes complètes : " + a.N + " / " + r.n);
  ok(dv < 1e-5, "valeurs propres identiques (écart relatif " + dv.toExponential(1) + ", stockage Float32)");
  ok(dR < 1e-5, "matrice des corrélations identique (écart " + dR.toExponential(1) + ")");
  const F1 = bt.acp.F[0], r0 = r.rowsKept; let dF = 0; r0.forEach((i, k) => { dF = Math.max(dF, Math.abs(F1[i] - r.F[k][0])); });
  ok(dF < 1e-3, "coordonnées sur l'axe 1 identiques (écart " + dF.toExponential(1) + ")");
  const dg = diagTQ(r), dT = Math.max(...r0.map((i, k) => Math.abs(bt.acp.T2[i] - dg.T2[k]) / (1 + dg.T2[k])));
  ok(dT < 1e-4 && Math.abs(a.ucT - dg.ucT) / dg.ucT < 1e-9, "T² de Hotelling et sa limite identiques");
  const sel = bt.setFilters([{ type: "cats", col: "seg", codes: [bt.cat[0].labels.indexOf("S2")] }]), vt = describeSubset(t, r0.map(i => t.rows[i]), new Set(r0.map((i, k) => k).filter(k => t.rows[r0[k]].seg === "S2")), {});
  const v0 = sel.num.find(o => o.name === "v1"), w0 = vt.find(o => o.col === "v1");
  ok(sel.count === r0.filter(i => t.rows[i].seg === "S2").length && Math.abs(v0.v - w0.v) < 1e-3 * Math.abs(w0.v), "sélection par modalité : effectif et valeur-test identiques (" + v0.v.toFixed(3) + " / " + w0.v.toFixed(3) + ")");
  const cl = bt.classes(); ok(cl.k >= 2 && cl.R2 > 0 && cl.R2 < 1 && Math.abs(sum(cl.sizes) - a.N) < 1, "classes : " + cl.k + " classes, R² = " + cl.R2.toFixed(3) + ", toutes les lignes affectées");
  const d = bt.density({ a: 0, b: 1, box: a.ext[0].slice(0, 2).concat(a.ext[1].slice(0, 2)), G: 256, ramp: [[0, 0, 0], [255, 255, 255]], pal: [[255, 0, 0]], dark: true });
  ok(d.inside + d.outside === a.N && sum(Array.from(d.cnt)) === d.inside, "carte de densité : chaque ligne comptée une fois (" + d.inside + " dans le cadre)");
  const smp = bt.sample(5000); ok(smp.rows.length === 5000 && smp.columns.length === 9, "échantillon de 5 000 lignes pour le Studio");
  console.log("\nLasso (polygone) : test par bandes comparé au test point par point");
  { const naive = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const R3 = mulberry(8); let bad = 0, tot = 0, ins = 0;
    for (const nv of [3, 7, 60, 400]) {
      // polygone etoile irregulier (non convexe), avec aretes horizontales et sommets repetes
      const P = range(nv).map(k => { const t = 2 * Math.PI * k / nv, r = 0.3 + R3() * 0.7; return [Math.round(r * Math.cos(t) * 50) / 50, Math.round(r * Math.sin(t) * 50) / 50]; });
      const inside = polyTester(P);
      for (let i = 0; i < 50000; i++) { const x = Math.round((R3() * 2.4 - 1.2) * 100) / 100, y = Math.round((R3() * 2.4 - 1.2) * 100) / 100, a = inside(x, y), b = naive(P, x, y); tot++; ins += a; if (a !== b) bad++; }
    }
    ok(bad === 0 && ins > 1000, "lasso : " + tot + " points sur une grille (sommets et arêtes compris), " + ins + " à l'intérieur, " + bad + " désaccord");
    const A0 = bt.acp, e0 = A0.ext[0], e1 = A0.ext[1], cx = (e0[0] + e0[1]) / 2, cy = (e1[0] + e1[1]) / 2, P2 = range(120).map(k => { const t = 2 * Math.PI * k / 120, r = (k % 2 ? 0.35 : 0.2) * (e0[1] - e0[0]); return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
    const sl = bt.setFilters([{ type: "poly", a: 0, b: 1, pts: P2 }]); let ref = 0; for (let i = 0; i < bt.n; i++) if (A0.ok[i] && naive(P2, A0.F[0][i], A0.F[1][i])) ref++;
    ok(sl.count === ref && ref > 100, "filtre lasso sur la carte : " + sl.count + " lignes, comme le test point par point (" + ref + ")");
    const s2 = bt.setFilters([{ type: "poly", a: 0, b: 1, pts: P2 }, { type: "cats", col: "seg", codes: [0] }]); let ref2 = 0; for (let i = 0; i < bt.n; i++) if (A0.ok[i] && naive(P2, A0.F[0][i], A0.F[1][i]) && bt.cat[0].data[i] === 0) ref2++;
    ok(s2.count === ref2, "lasso combiné à une modalité : " + s2.count + " lignes");
    bt.setFilters([]); }

  console.log("\nLecture en colonnes (Parquet) comparée à la lecture CSV");
  { const R4 = mulberry(12), n = 5000, day = Date.UTC(2021, 0, 1);
    const cols = { id: range(n).map(i => BigInt(i)), x: Float64Array.from(range(n), () => gauss(R4)), k: range(n).map(i => (i % 11 === 0 ? null : BigInt(i % 40))), flag: range(n).map(i => i % 3 === 0),
      seg: range(n).map(i => (i % 17 === 0 ? null : ["nord", "sud", "est"][i % 3])), d: range(n).map(i => new Date(day + (i % 30) * 864e5)), txt: range(n).map(i => "libre " + i), miss: range(n).map(i => (i % 5 ? "NA" : "3.5")) };
    const names = Object.keys(cols), groups = [[0, 1200], [1200, 3000], [3000, 5000]], bq = new BigTable("t.parquet");
    const sample = names.map(c => range(1200).map(i => pqStr(cols[c][i])));
    bq.initCols(names, sample, n, ["imbrique"]);
    for (const [a0, a1] of groups) { names.forEach((c, j) => { const src = cols[c], chunk = ArrayBuffer.isView(src) ? src.subarray(a0, a1) : src.slice(a0, a1); bq.putCol(j, chunk, 0, a0, a1 - a0); }); bq.n = a1; }
    const sq = bq.finish();
    const csv = [names.join(","), ...range(n).map(i => names.map(c => pqStr(cols[c][i])).join(","))].join("\n"), bc = new BigTable("t.csv"), sc = feed(bc, enc(csv), 4096);
    const role = (b, c) => b.cols.find(o => o.name === c)?.role, same = names.every(c => role(bq, c) === role(bc, c));
    ok(same && role(bq, "id") === "skip" && role(bq, "x") === "num" && role(bq, "k") === "num" && role(bq, "seg") === "cat" && role(bq, "flag") === "cat" && role(bq, "txt") === "skip" && role(bq, "imbrique") === "skip",
      "mêmes types que le CSV : " + names.map(c => c + "=" + role(bq, c) + (role(bq, c) === role(bc, c) ? "" : "/" + role(bc, c))).join(" "));
    const nx = c => bq.num.find(o => o.name === c).data, cx2 = c => bc.num.find(o => o.name === c).data;
    ok(sq.n === n && ["x", "k"].every(c => nx(c).every((v, i) => (Number.isNaN(v) && Number.isNaN(cx2(c)[i])) || v === cx2(c)[i])), "valeurs numériques identiques, entiers 64 bits et manquants compris");
    const lab = (b, c, i) => { const o = b.cat.find(q => q.name === c), v = o.data[i]; return v === B_NA ? null : o.labels[v]; };
    ok(["seg", "flag", "d"].every(c => range(n).every(i => lab(bq, c, i) === lab(bc, c, i))) && lab(bq, "d", 1) === "2021-01-02" && lab(bq, "seg", 17) === null, "modalités identiques (textes, booléens, dates ISO, manquants)");
    ok(bq.num.find(o => o.name === "miss").st.n === 1000, "marqueur « NA » lu comme manquant");
    const bt2 = new BigTable("t.parquet"); bt2.types = { id: "num", seg: "skip", k: "cat" }; bt2.initCols(names, sample, n);
    ok(role(bt2, "id") === "num" && role(bt2, "seg") === "skip" && role(bt2, "k") === "cat" && bt2.cols.find(o => o.name === "k").auto === "num", "types imposés à la main (identifiant en nombre, modalités ignorées, nombre en modalités)"); }
  { const bt3 = new BigTable("c.csv"); bt3.types = { seg: "skip", v0: "cat" }; feed(bt3, enc(text), 65536);
    ok(bt3.cols.find(o => o.name === "seg").role === "skip" && bt3.cat.some(o => o.name === "v0") && bt3.cat.find(o => o.name === "v0").labels.length === 1000, "CSV relu avec des types imposés : v0 en modalités (1 000 au plus), seg ignorée"); }

  console.log("\n" + (checks - fails) + " contrôles réussis sur " + checks); if (fails) process.exitCode = 1;
} else {
  const file = process.env.TEMP_CSV;
  console.log("Banc de charge : " + ${N} + " lignes × " + ${P} + " variables quantitatives + 3 qualitatives + identifiant (" + MB(fs.statSync(file).size) + ")");
  const bt = new BigTable("bench.csv"), fd = fs.openSync(file, "r"), size = fs.statSync(file).size, CH = 16 << 20, buf = Buffer.allocUnsafe(CH);
  let t0 = performance.now(); const h = Buffer.alloc(Math.min(size, 2 << 20)); fs.readSync(fd, h, 0, h.length, 0); bt.init(new Uint8Array(h), size);
  for (let p = 0; p < size; p += CH) { const k = fs.readSync(fd, buf, 0, CH, p); bt.ingest(new Uint8Array(buf.buffer, buf.byteOffset, k).slice(), p + k >= size); }
  const s = bt.finish(), ms = performance.now() - t0; console.log("  lecture + typage + statistiques".padEnd(48), String(Math.round(ms)).padStart(7), "ms  (" + (size / 1048576 / ms * 1000).toFixed(0) + " Mo/s, " + s.n + " lignes, colonnes " + MB(s.mem) + ")");
  const a = T("ACP exacte (corrélations, axes, T², Q)", () => bt.pca()); console.log("     λ1 = " + a.vals[0].toFixed(4) + " · " + a.N + " lignes complètes · " + a.alg);
  T("carte de densité 512 × 512 (densité)", () => bt.density({ a: 0, b: 1, box: [a.ext[0][0], a.ext[0][1], a.ext[1][0], a.ext[1][1]], G: 512, ramp: [[0, 0, 0], [255, 255, 255]], pal: [[1, 2, 3]], dark: true }));
  T("carte de densité colorée par modalité", () => bt.density({ a: 0, b: 1, box: [a.ext[0][0], a.ext[0][1], a.ext[1][0], a.ext[1][1]], G: 512, ramp: [[0, 0, 0], [255, 255, 255]], pal: range(8).map(k => [k * 30, 100, 200]), dark: true, color: { mode: "cat", col: "Segment" } }));
  const sel = T("filtre rectangle + modalité + intervalle, résumé", () => bt.setFilters([{ type: "rect", a: 0, b: 1, x0: 0, x1: 99, y0: -99, y1: 0 }, { type: "cats", col: "Canal", codes: [0, 1] }, { type: "range", col: "V2", lo: -1, hi: 99 }])); console.log("     " + sel.count + " lignes sélectionnées");
  const cl = T("classes (HCPC sur 20 000, affectation de toutes)", () => bt.classes()); console.log("     k = " + cl.k + " · R² = " + cl.R2.toFixed(3));
  T("atypiques (25 plus extrêmes)", () => bt.outliers());
  T("échantillon de 50 000 lignes pour le Studio", () => bt.sample(50000));
  const mu = process.memoryUsage(); console.log("  mémoire : tas JS " + MB(mu.heapUsed) + " · tableaux typés " + MB(mu.arrayBuffers) + " · processus " + MB(mu.rss));
}
`;
const file = path.join(os.tmpdir(), "prisme_bench_big.mjs");
fs.writeFileSync(file, stubs + CORE.map(f => fs.readFileSync(path.join(root, "src/core", f), "utf8")).join("\n").replace(/"use strict";/g, "") + body);
if (N) {   // generation du fichier de test (en flux, reproductible)
  const csv = path.join(os.tmpdir(), `prisme_big_${N}_${P}.csv`);
  if (!fs.existsSync(csv)) {
    console.log("génération de", csv); const out = fs.openSync(csv, "w"); let s = 1, rows = [];
    const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5) | 0) >>> 0) / 4294967296, g = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(6.283185307 * rnd()), seg = ["A", "B", "C", "D"], can = ["Web", "Magasin", "Appli", "Téléphone"];
    fs.writeSync(out, ["Id", "Segment", "Canal", "Region", ...Array.from({ length: P }, (_, j) => "V" + (j + 1))].join(",") + "\n");
    for (let i = 0; i < N; i++) { const k = Math.floor(rnd() * 4), f1 = g() + k, f2 = g() - k / 2; const v = []; for (let j = 0; j < P; j++) v.push(rnd() < 0.02 ? "" : ((j % 3 === 0 ? f1 : j % 3 === 1 ? f2 : f1 * f2 * 0.3) + g() * 0.8).toFixed(3));
      rows.push("R" + i + "," + seg[k] + "," + can[Math.floor(rnd() * 4)] + ",Reg" + Math.floor(rnd() * 12) + "," + v.join(",")); if (rows.length === 20000) { fs.writeSync(out, rows.join("\n") + "\n"); rows = []; } }
    if (rows.length) fs.writeSync(out, rows.join("\n") + "\n"); fs.closeSync(out);
  }
  process.env.TEMP_CSV = csv;
}
await import(pathToFileURL(file).href);
