// Tests du moteur de calcul de Prisme Studio : node tests/run_tests.mjs
// Les fichiers du noyau sont charges dans un contexte isole avec des bouchons minimaux pour le navigateur.
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = ["engine.js", "datasets.js", "explore.js", "stats.js", "prep.js", "cluster.js", "embed.js", "scag.js", "insights.js"];
const ctx = { console, performance, Math, setTimeout, Promise, URL, Blob: class {}, Worker: undefined,
  matchMedia: () => ({ matches: true }), document: { querySelector: () => null, documentElement: { dataset: {} } }, getComputedStyle: () => ({ getPropertyValue: () => "" }),
  Papa: { parse: t => ({ data: t.trim().split(/\r?\n/).map(l => l.split(",")) }) }, window: {} };
vm.createContext(ctx);
const code = CORE.map(f => fs.readFileSync(path.join(root, "src/core", f), "utf8")).join("\n") + "\n;globalThis.__api = { EXEMPLES, parseCSV, detect, runACP, runACM, runAFC, runAFDM, suggest, interpret, eigSym, chi2sf, betai, betaInv, chi2Inv, normCdf, normInv, normSf, hyperTail, vtestQuanti, vtestModal, describeSubset, describe, histogram, pearson, spearman, dcor, anova, cramerV, imputePCA, applyTransforms, supplementary, ward, cutTree, leafOrder, hcpc, kmeansW, TSNE, neighborhoodQuality, scagnostics, mstEdges, shepard, diagTQ, reconstruct, inertiaFlows, projInertia, pcaFrame, mulberry, gauss, range, sum, mean, partialCorr, mainCloud, buildInsights, scagAll, applyMissing };";
vm.runInContext(code.replace(/^"use strict";/, ""), ctx);
const A = ctx.__api; let pass = 0, fail = 0;
const ok = (name, cond, info = "") => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name + (info ? "  → " + info : "")); } };
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

console.log("\nDonnées et ACP");
const luxe = A.parseCSV(A.EXEMPLES.luxe.csv, "luxe.csv"), ty = A.detect(luxe);
const acp = A.runACP(luxe, { vars: ty.quanti, ident: ty.ident, color: "Famille" });
ok("7 variables quantitatives détectées", ty.quanti.length === 7, ty.quanti.join(","));
ok("Σλ = p (ACP normée)", close(A.sum(acp.vals), 7, 1e-10));
ok("λ1 = 3,0706 (valeur du rapport)", close(acp.vals[0], 3.0706, 1e-4), acp.vals[0]);
ok("inertie des 3 axes = 85,74 %", close(acp.cum[2], 85.7416, 1e-5), acp.cum[2]);
ok("Σ cos² d'une variable sur tous les axes = 1", acp.vcos2.every(r => close(A.sum(r), 1, 1e-9)));
ok("Σ contributions par axe = 100 %", A.range(acp.q).every(k => close(A.sum(acp.ctr.map(r => r[k])), 100, 1e-9)));
ok("reconstruction complète = tableau centré-réduit", Math.max(...A.reconstruct(acp, acp.q).flatMap((r, i) => r.map((x, j) => Math.abs(x - acp.Z[i][j])))) < 1e-10);
ok("flux d'inertie : Σ = Σλ", close(A.sum(A.inertiaFlows(acp).src.map(s => A.sum(s.f))), 7, 1e-10));
const dg = A.diagTQ(acp); ok("moyenne de T² = A(n−1)/n", close(A.mean(dg.T2), 3 * 49 / 50, 1e-9), A.mean(dg.T2));
ok("moyenne de Q = Σ des λ restantes", close(A.mean(dg.Q), dg.t1, 1e-9));
ok("Shepard : dispersion conservée = inertie des k axes", close(A.shepard(acp, 3).kept * 100, acp.cum[2], 1e-9));
ok("vue ACP = inertie maximale", close(A.projInertia(acp, A.pcaFrame(acp.q)) * 100, acp.cum[2], 1e-9));

console.log("\nLois et tests");
ok("Φ(1,96) = 0,975", close(A.normCdf(1.959964), 0.975, 1e-6), A.normCdf(1.959964));
ok("Φ⁻¹(Φ(z)) = z", [-3.2, -1, 0.3, 2.5].every(z => close(A.normInv(A.normCdf(z)), z, 1e-8)));
ok("Φ⁻¹(0,025) = −1,95996", close(A.normInv(0.025), -1.959964, 1e-6));
ok("hypergéométrique : P(X ≥ x) + P(X ≤ x−1) = 1", close(A.hyperTail(7, 50, 12, 20, true) + A.hyperTail(6, 50, 12, 20, false), 1, 1e-10));
const vq = A.vtestQuanti([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [8, 9, 10]); const s2 = 8.25, v0 = (9 - 5.5) / Math.sqrt(s2 / 3 * 7 / 9);
ok("valeur-test quantitative (formule de Lebart)", close(vq.v, v0, 1e-12), vq.v + " vs " + v0);
const fam = new Set(luxe.rows.map((r, i) => (r.Famille === "Robe haute couture" ? i : -1)).filter(i => i >= 0));
const ds = A.describeSubset(luxe, luxe.rows, fam, { skip: ["Piece"] });
const dsRobe = ds.find(d => d.type === "modal" && d.cat === "Robe haute couture");
ok("sélection des robes : la modalité Robe haute couture est dans le trio de tête (v > 5)", ds.slice(0, 3).includes(dsRobe) && dsRobe.v > 5, JSON.stringify(dsRobe));
ok("valeur-test exacte : P = 1/C(50,6) pour 6 robes sur 6", Math.abs(A.normSf(dsRobe.v) - 1 / 15890700) / (1 / 15890700) < 1e-6, A.normSf(dsRobe.v));
ok("sélection des robes : Heures_fabrication très au-dessus (v > 3)", ds.find(d => d.col === "Heures_fabrication").v > 3);

console.log("\nDépendances");
const rnd = A.mulberry(1), xs = A.range(300).map(() => A.gauss(rnd)), noise = A.range(300).map(() => A.gauss(rnd));
ok("dCor ≈ 0 pour des variables indépendantes (< 0,2)", A.dcor(xs, noise) < 0.2, A.dcor(xs, noise));
const sq = xs.map((x, i) => x * x + 0.05 * noise[i]);
ok("y = x² : Pearson ≈ 0 mais dCor élevée", Math.abs(A.pearson(xs, sq)) < 0.2 && A.dcor(xs, sq) > 0.45, `r=${A.pearson(xs, sq)} dcor=${A.dcor(xs, sq)}`);
ok("dCor = 1 pour une relation linéaire exacte", close(A.dcor(xs, xs.map(x => 3 * x + 1)), 1, 1e-9));
ok("Spearman invariant par transformation monotone", close(A.spearman(xs, xs.map(Math.exp)), 1, 1e-12));
const an = A.anova(acp.X.map(r => r[2]), acp.groups); ok("ANOVA : η² dans [0,1] et p < 0,001 (heures selon la famille)", an.eta2 > 0 && an.eta2 < 1 && an.p < 1e-3, JSON.stringify(an));
const d = A.describe([1, 2, 2, 3, 3, 3, 4, 4, 5, 40]); ok("describe : 1 valeur atypique (Tukey)", d.out === 1, d.out);
ok("corrélations partielles : diagonale 1, symétrie", (() => { const P = A.partialCorr(acp.R); return P.every((r, i) => close(r[i], 1) && r.every((v, j) => close(v, P[j][i], 1e-10))); })());

console.log("\nValeurs manquantes");
const X = acp.X, rng = A.mulberry(9), holes = X.map(r => r.map(v => (rng() < 0.1 ? NaN : v)));
const imp = A.imputePCA(holes, 2); const colMean = A.range(7).map(j => A.mean(holes.map(r => r[j]).filter(Number.isFinite)));
let ePCA = 0, eMean = 0; holes.forEach((r, i) => r.forEach((v, j) => { if (!Number.isFinite(v)) { const s = acp.sd[j]; ePCA += ((imp.X[i][j] - X[i][j]) / s) ** 2; eMean += ((colMean[j] - X[i][j]) / s) ** 2; } }));
ok("imputation par ACP itérative plus précise que la moyenne", ePCA < eMean, `ACP=${ePCA.toFixed(2)} moyenne=${eMean.toFixed(2)} (${imp.miss} trous, ${imp.iter} itérations)`);
ok("imputation : convergence", imp.iter < 1000);

console.log("\nClassification (Ward, HCPC)");
const P = acp.F.map(f => f.slice(0, 3)), w = P.map(() => 1 / P.length), W = A.ward(P, w);
const g = [0, 1, 2].map(k => A.mean(P.map(p => p[k]))), tot = A.sum(P.map(p => A.sum(p.map((x, k) => (x - g[k]) ** 2)))) / P.length;
ok("Ward : Σ des gains d'inertie = inertie totale", close(A.sum(W.tree.map(t => t.h)), tot, 1e-9), `${A.sum(W.tree.map(t => t.h))} vs ${tot}`);
ok("Ward : hauteurs croissantes", W.tree.every((t, i) => i === 0 || t.h >= W.tree[i - 1].h - 1e-12));
ok("Ward : ordre des feuilles = permutation", A.leafOrder(W).slice().sort((a, b) => a - b).every((v, i) => v === i));
ok("coupe en 4 classes : 4 étiquettes", new Set(A.cutTree(W, 4)).size === 4);
const H = A.hcpc(acp); ok("HCPC : k automatique entre 3 et 10", H.k >= 3 && H.k <= 10, H.k); ok("HCPC : R² dans ]0,1[", H.R2 > 0 && H.R2 < 1, H.R2);
fs.writeFileSync(path.join(root, "tests", "_ward_input.json"), JSON.stringify({ P, heights: W.tree.map(t => t.h) }));

console.log("\nProjections non linéaires");
const t = new A.TSNE(acp.Z, { dim: 2, perplexity: 12, seed: 3 }); for (let i = 0; i < 60; i++) t.step(); const kl1 = t.kl; for (let i = 0; i < 540; i++) t.step(); const kl2 = t.kl;
ok("t-SNE : la divergence KL diminue", kl2 < kl1, `${kl1.toFixed(3)} → ${kl2.toFixed(3)}`);
const Y = A.range(acp.n).map(i => [t.Y[2 * i], t.Y[2 * i + 1]]), q = A.neighborhoodQuality(acp.Z, Y, 7);
ok("t-SNE : fiabilité > 0,85", q.T > 0.85, q.T); ok("identité : fiabilité = continuité = 1", (() => { const q0 = A.neighborhoodQuality(acp.Z, acp.Z, 7); return close(q0.T, 1) && close(q0.C, 1); })());
const qp = A.neighborhoodQuality(acp.Z, acp.F.map(f => f.slice(0, 2)), 7);
fs.writeFileSync(path.join(root, "tests", "_trust_input.json"), JSON.stringify({ X: acp.Z, Y, Ypca: acp.F.map(f => f.slice(0, 2)), k: 7, T: q.T, Tpca: qp.T }));

console.log("\nScagnostics");
const r2 = A.mulberry(4), u = A.range(200).map(() => r2());
const lin = A.scagnostics(u, u.map(x => 2 * x + 0.01 * r2())); ok("droite : monotone ≈ 1", lin.monotonic > 0.98, lin.monotonic);
const str = A.scagnostics(u.map(x => Math.floor(x * 5)), u.map(() => r2())); ok("x à 5 valeurs : strié élevé (> 0,3)", str.striated > 0.3, str.striated);
const clu = A.scagnostics(u.map((x, i) => (i % 2 ? 0 : 10) + x * 0.5), u.map((x, i) => (i % 2 ? 0 : 10) + r2() * 0.5)); ok("deux paquets séparés : amas élevé (> 0,7)", clu.clumpy > 0.7, clu.clumpy);
const un = A.scagnostics(u, A.range(200).map(() => r2())); ok("nuage uniforme : amas faible (< 0,5)", un.clumpy < 0.5, un.clumpy);
const out = A.scagnostics([...u, 40], [...u.map(() => r2()), 40]); ok("un point très isolé : isolés > 0", out.outlying > 0, out.outlying);

console.log("\nJeu entreprise et insights");
const ec = A.parseCSV(A.EXEMPLES.ecommerce.csv, "ec.csv"), tyE = A.detect(ec);
ok("e-commerce : 600 lignes, 10 quantitatives, identifiant détecté", ec.rows.length === 600 && tyE.quanti.length === 10 && tyE.ident === "Client", `${ec.rows.length} ${tyE.quanti.length} ${tyE.ident}`);
const pE = { vars: tyE.quanti, ident: "Client", color: "Segment" };
const drop = A.runACP(ec, pE); ok("sans imputation : les lignes incomplètes sont exclues", drop.n < 600 && drop.n > 540, drop.n);
const im = A.applyMissing(ec, "pca", pE, "ACP"), acpE = A.runACP(im.table, pE);
ok("avec imputation par ACP : les 600 clients sont gardés", acpE.n === 600 && im.info.miss > 0, `${acpE.n} (${im.info.miss} valeurs imputées)`);
const hcE = A.hcpc(acpE); ok("HCPC sur 600 clients : entre 3 et 6 classes", hcE.k >= 3 && hcE.k <= 6, `k=${hcE.k} R²=${hcE.R2.toFixed(3)}`);
const scE = A.scagAll(acpE), sesAge = scE.find(s => [acpE.vars[s.i], acpE.vars[s.j]].sort().join() === "Age,Duree_session_min");
ok("âge × durée de session (en U) : Spearman faible mais dépendance forte sur les rangs", sesAge && Math.abs(sesAge.spearman) < 0.45 && sesAge.nonmono >= 0.1, sesAge && `dcorR=${sesAge.dcorR.toFixed(3)} rho=${sesAge.spearman.toFixed(3)}`);
const insE = A.buildInsights(acpE, im.table, hcE, scE);
ok("insights générés (≥ 8) et triés par score", insE.length >= 8 && insE.every((o, i) => i === 0 || o.score <= insE[i - 1].score), insE.length);
ok("insight d'asymétrie sur le panier moyen", insE.some(o => o.kind === "skew" && o.title.includes("Panier_moyen_EUR")), insE.filter(o => o.kind === "skew").map(o => o.title).join(" | "));
ok("insight de bimodalité sur le délai de livraison", insE.some(o => o.kind === "bimodal" && o.title.includes("Delai_livraison_j")), insE.filter(o => o.kind === "bimodal").map(o => o.title).join(" | "));
ok("insight d'atypiques (revendeurs)", insE.some(o => o.kind === "outlier"));
ok("insight non linéaire âge × durée de session", insE.some(o => o.kind === "nonlin" && o.title.includes("Age") && o.title.includes("Duree_session_min")));
console.log("   Top 10 :\n     " + insE.slice(0, 10).map(o => `[${o.kind} ${o.score.toFixed(2)}] ${o.title}`).join("\n     "));

console.log("\nAFDM (données mixtes)");
const pM = { vars: tyE.quanti.concat(["Segment", "Canal", "Region"]), ident: "Client" }, imM = A.applyMissing(ec, "pca", pM, "AFDM"), fd = A.runAFDM(imM.table, pM);
ok("AFDM : les 600 clients sont gardés après imputation (quantitatives) et modalité « Manquant » (qualitatives)", fd.n === 600, fd.n);
ok("AFDM : Σλ = p + M − K", Math.abs(A.sum(fd.vals) - (fd.p + fd.M - fd.K)) < 1e-9, `${A.sum(fd.vals).toFixed(9)} / ${fd.p + fd.M - fd.K}`);
ok("AFDM : λ = Σ r² + Σ η² sur chaque axe", A.range(Math.min(5, fd.q)).every(s => Math.abs(A.sum(fd.link.map(l => l.r2[s])) - fd.vals[s]) < 1e-9));
ok("AFDM : chaque liaison r² ou η² dans [0, 1]", fd.link.every(l => l.r2.every(v => v >= -1e-12 && v <= 1 + 1e-12)));
ok("AFDM : variance des coordonnées = λ", A.range(3).every(s => Math.abs(A.sum(fd.F.map(f => f[s] ** 2)) / fd.n - fd.vals[s]) < 1e-9));
const hcM = A.hcpc(fd), insM = A.buildInsights(fd, imM.table, hcM, A.scagAll(fd)); ok("AFDM : HCPC et insights", hcM.k >= 2 && insM.length >= 5, `k=${hcM.k}, ${insM.length} insights`);
ok("AFDM proposée pour des données mixtes équilibrées, ACP gardée si les quantitatives dominent", A.suggest(ec, tyE)[0] === "ACP" && A.suggest(ec, { ...tyE, quanti: tyE.quanti.slice(0, 5) })[0] === "AFDM", A.suggest(ec, tyE)[0]);

console.log(`\n${pass} réussis, ${fail} échoués\n`); process.exit(fail ? 1 : 0);
