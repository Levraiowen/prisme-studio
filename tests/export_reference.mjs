// Exporte les resultats du moteur JavaScript pour la contre-verification Python (tests/crosscheck.py).
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = ["engine.js", "datasets.js", "explore.js", "stats.js", "prep.js", "cluster.js", "embed.js", "scag.js", "insights.js"];
const stubs = `const matchMedia = () => ({ matches: true }), document = { querySelector: () => null, documentElement: { dataset: {} } }, getComputedStyle = () => ({ getPropertyValue: () => "" }), window = {};
const Papa = { parse: t => ({ data: t.trim().split(/\\r?\\n/).map(l => l.split(",")) }) };\n`;
const body = `
const OUT = {};
// ACP (vetements de luxe)
const luxe = parseCSV(EXEMPLES.luxe.csv, "l"), ty = detect(luxe), acp = runACP(luxe, { vars: ty.quanti, ident: ty.ident, color: "Famille" });
OUT.acp = { X: acp.X, vals: acp.vals, F: acp.F, cos2: acp.cos2, ctr: acp.ctr, coord: acp.coord, R: acp.R, partial: partialCorr(acp.R) };
const dg = diagTQ(acp); OUT.tq = { T2: dg.T2, Q: dg.Q, ucT: dg.ucT, ucQ: dg.ucQ, A: dg.A, n: acp.n };
// ACM (clients du luxe) : methode creuse via le tableau de Burt
const cl = parseCSV(EXEMPLES.clients.csv, "c"), tc = detect(cl), acm = runACM(cl, { vars: tc.quali, ident: tc.ident });
OUT.acm = { answers: acm.answers, vars: acm.vars, vals: acm.vals, F: acm.F.map(f => f.slice(0, 4)), G: acm.G.map(g => g.slice(0, 4)), mods: acm.mods, eta2: acm.eta2.map(e => e.slice(0, 4)) };
// AFC (ventes par region)
const ve = parseCSV(EXEMPLES.ventes.csv, "v"), tv = detect(ve), afc = runAFC(ve, { mode: "tableau", ident: tv.ident, vars: tv.quanti });
OUT.afc = { N: afc.N, vals: afc.vals, F: afc.F, G: afc.G, chi2: afc.chi2, ddl: afc.ddl, pval: afc.pval };
// classification
const P3 = acp.F.map(f => f.slice(0, 3)), W = ward(P3, P3.map(() => 1 / P3.length));
OUT.ward = { P: P3, labels4: cutTree(W, 4), heights: W.tree.map(t => t.h) };
const km = kmeans(P3, 4, mulberry(3)); OUT.sil = { P: P3, labels: km.labels, value: silhouette(P3, km.labels, 4) };
// dependances
const rnd = mulberry(8), x = range(300).map(() => gauss(rnd)), y = x.map(v => v * v + 0.3 * gauss(rnd)), z = x.map(v => Math.exp(v) + gauss(rnd));
OUT.dep = { x, y, z, dcorXY: dcor(x, y), dcorXZ: dcor(x, z), spearXZ: spearman(x, z), pearXZ: pearson(x, z) };
// lois
OUT.dist = { betaInv: [[0.95, 1.5, 23], [0.95, 3, 45.5], [0.99, 2, 10]].map(([p, a, b]) => [p, a, b, betaInv(p, a, b)]), chi2Inv: [[0.95, 1], [0.95, 4.7], [0.99, 12.3]].map(([p, k]) => [p, k, chi2Inv(p, k)]),
  normInv: [0.001, 0.025, 0.5, 0.9, 0.999].map(p => [p, normInv(p)]), chi2sf: [[3.84, 1], [20, 12], [150, 100]].map(([x2, k]) => [x2, k, chi2sf(x2, k)]),
  hyper: [[7, 50, 12, 20], [2, 50, 12, 20], [40, 600, 120, 150]].map(([x3, N, K, n]) => [x3, N, K, n, hyperTail(x3, N, K, n, true), hyperTail(x3, N, K, n, false)]) };
// fiabilite et continuite d'une projection t-SNE
const t = new TSNE(acp.Z, { dim: 2, perplexity: 12, seed: 3 }); for (let i = 0; i < 500; i++) t.step(); const Y = range(acp.n).map(i => [t.Y[2 * i], t.Y[2 * i + 1]]), q = neighborhoodQuality(acp.Z, Y, 7);
OUT.nq = { X: acp.Z, Y, k: 7, T: q.T, C: q.C };
// valeurs-tests des modalites illustratives (Famille) sur l'ACP
const sup = supplementary(acp, luxe, [], ["Famille"]); OUT.supp = { F: acp.F.map(f => f.slice(0, 3)), vals: acp.vals.slice(0, 3), groups: acp.groups, vtest: sup.quali[0].mods.map(m => ({ cat: m.cat, v: m.vtest.slice(0, 3) })) };
// imputation : point fixe de l'ACP iterative regularisee
const holes = acp.X.map((r, i) => r.map((v, j) => ((i * 7 + j * 3) % 11 === 0 ? NaN : v))), imp = imputePCA(holes, 2);
OUT.imp = { X: holes.map(r => r.map(v => (Number.isFinite(v) ? v : null))), Y: imp.X, S: 2 };
process.stdout.write(JSON.stringify(OUT));
`;
const file = path.join(os.tmpdir(), "prisme_export_ref.mjs");
fs.writeFileSync(file, stubs + CORE.map(f => fs.readFileSync(path.join(root, "src/core", f), "utf8")).join("\n").replace(/"use strict";/g, "") +
  fs.readFileSync(path.join(root, "src/ui/charts.js"), "utf8").match(/function kmeans[\s\S]*?\r?\n}\r?\n/)[0] + fs.readFileSync(path.join(root, "src/ui/charts.js"), "utf8").match(/function silhouette[\s\S]*?\r?\n}\r?\n/)[0] + body);
await import(pathToFileURL(file).href);
