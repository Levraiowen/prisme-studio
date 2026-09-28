// Banc d'essai du moteur sur de grands tableaux : node tests/bench.mjs [n] [p]
// Le noyau est execute comme un script ordinaire (vitesse comparable a celle d'un navigateur).
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), n = +(process.argv[2] || 3000), p = +(process.argv[3] || 10);
const CORE = ["engine.js", "datasets.js", "explore.js", "stats.js", "prep.js", "cluster.js", "embed.js", "scag.js", "insights.js"];
const stubs = `const matchMedia = () => ({ matches: true }), document = { querySelector: () => null, documentElement: { dataset: {} } }, getComputedStyle = () => ({ getPropertyValue: () => "" }), window = {};
const Papa = { parse: t => ({ data: t.trim().split(/\\r?\\n/).map(l => l.split(",")) }) };\n`;
const body = `
const T = (l, f) => { const t0 = performance.now(), r = f(); console.log(l.padEnd(40), String(Math.round(performance.now() - t0)).padStart(7), "ms"); return r; };
const mem = () => Math.round(process.memoryUsage().heapUsed / 1048576) + " Mo de tas";
console.log("n =", ${n}, "lignes ; p =", ${p}, "variables quantitatives (+ 3 qualitatives)");
// jeu synthetique : 4 segments, p variables quantitatives correlees par blocs, 2 % de valeurs manquantes
const rnd = mulberry(1), head = ["Id", "Segment", "Canal", "Region", ...range(${p}).map(j => "V" + (j + 1))], seg = ["A", "B", "C", "D"];
const csv = T("génération du CSV", () => { const L = [head.join(",")]; for (let i = 0; i < ${n}; i++) { const s = Math.floor(rnd() * 4), f1 = gauss(rnd) + s, f2 = gauss(rnd) - s / 2;
  L.push(["R" + i, seg[s], seg[Math.floor(rnd() * 4)], seg[Math.floor(rnd() * 4)], ...range(${p}).map(j => rnd() < 0.02 ? "" : (j % 3 === 0 ? f1 : j % 3 === 1 ? f2 : f1 * f2 * 0.3) + gauss(rnd) * 0.8).map(v => (typeof v === "number" ? v.toFixed(3) : v))].join(",")); } return L.join("\\n"); });
console.log("   taille du CSV :", Math.round(csv.length / 1048576), "Mo");
const tab = T("lecture + typage des colonnes", () => tableFromMatrix(csv.trim().split(/\\r?\\n/).map(l => l.split(",")), "bench")), ty = detect(tab), par = { vars: ty.quanti, ident: "Id", color: "Segment" };
console.log("   ", mem());
const im = T("imputation par ACP itérative", () => applyMissing(tab, "pca", par, "ACP"));
const r = T("ACP complète", () => runACP(im.table, par)); console.log("    λ1 =", r.vals[0].toFixed(3), "·", mem());
const hc = T("HCPC (échantillon + affectation)", () => hcpc(r)); console.log("    k =", hc.k, "· R² =", hc.R2.toFixed(3));
const sc = T("scagnostics de toutes les paires", () => scagAll(r)); console.log("   ", sc.length, "paires");
T("T² de Hotelling et Q", () => diagTQ(r)); T("Shepard (échantillon)", () => shepard(r, 3));
const ins = T("insights automatiques", () => buildInsights(r, im.table, hc, sc)); console.log("   ", ins.length, "insights");
T("fiabilité / continuité (1 200 points)", () => neighborhoodQuality(r.Z, r.F.map(f => f.slice(0, 2)), 10));
const sel = new Set(range(Math.min(${n}, 5000)));
T("valeurs-tests d'une sélection de 5 000", () => describeSubset(im.table, r.rowsKept.map(i => im.table.rows[i]), sel, { skip: ["Id"] }));
const qt = parseCSV.toString().length > 0 ? tab.rows.map(x => [x.Segment, x.Canal, x.Region, x.V1 > 0 ? "haut" : "bas"]) : null;
const acm = T("ACM creuse (4 variables qualitatives)", () => runACM({ columns: ["Segment", "Canal", "Region", "Q"], rows: qt.map(a => ({ Segment: a[0], Canal: a[1], Region: a[2], Q: a[3] })) }, { vars: ["Segment", "Canal", "Region", "Q"], ident: null }));
console.log("    Σλ ACM =", acm.vals.reduce((a, b) => a + b, 0).toFixed(6), "(attendu M/K − 1 =", (acm.M / acm.K - 1).toFixed(6) + ")", "·", mem());
`;
const file = path.join(os.tmpdir(), "prisme_bench.mjs");
fs.writeFileSync(file, stubs + CORE.map(f => fs.readFileSync(path.join(root, "src/core", f), "utf8")).join("\n").replace(/"use strict";/g, "") + body);
await import(pathToFileURL(file).href);
