"""Contre-verification du moteur JavaScript de Prisme Studio par des implementations de reference independantes.

    python tests/crosscheck.py

numpy (decompositions en valeurs singulieres, inverses), scipy (lois, test du chi2, Ward), scikit-learn (silhouette,
fiabilite des projections). Chaque controle affiche l'ecart maximal observe et la tolerance exigee.
"""
import json, pathlib, subprocess, sys
import numpy as np
from scipy import stats
from scipy.cluster.hierarchy import linkage, fcluster
from sklearn.metrics import silhouette_score, adjusted_rand_score
from sklearn.manifold import trustworthiness

here = pathlib.Path(__file__).parent
sys.stdout.reconfigure(encoding="utf-8")
R = json.loads(subprocess.run(["node", str(here / "export_reference.mjs")], capture_output=True, text=True, check=True).stdout)
results = []
def check(name, err, tol):
    ok = bool(err <= tol); results.append(ok)
    print(f"  {'OK ' if ok else 'ÉCHEC'} {name:<62} écart {err:.2e}  (tolérance {tol:.0e})")
def same_up_to_sign(A, B):   # colonnes definies au signe pres
    A, B = np.asarray(A, float), np.asarray(B, float); return max(min(np.abs(A[:, k] - B[:, k]).max(), np.abs(A[:, k] + B[:, k]).max()) for k in range(A.shape[1]))

print("\nACP normée")
X = np.array(R["acp"]["X"]); n, p = X.shape; Z = (X - X.mean(0)) / X.std(0)
Rm = Z.T @ Z / n; w, V = np.linalg.eigh(Rm); o = np.argsort(w)[::-1]; w, V = w[o], V[:, o]; F = Z @ V
check("valeurs propres (numpy eigh)", np.abs(np.array(R["acp"]["vals"]) - w[:len(R["acp"]["vals"])]).max(), 1e-10)
check("matrice des corrélations", np.abs(np.array(R["acp"]["R"]) - np.corrcoef(X.T)).max(), 1e-12)
q = len(R["acp"]["vals"]); check("coordonnées des individus", same_up_to_sign(R["acp"]["F"], F[:, :q]), 1e-9)
check("cos² des individus", np.abs(np.array(R["acp"]["cos2"]) - F[:, :q] ** 2 / (Z ** 2).sum(1, keepdims=True)).max(), 1e-10)
check("contributions des individus (%)", np.abs(np.array(R["acp"]["ctr"]) - 100 * F[:, :q] ** 2 / (n * w[:q])).max(), 1e-9)
check("corrélations variables-axes", same_up_to_sign(R["acp"]["coord"], np.array([[np.corrcoef(X[:, j], F[:, k])[0, 1] for k in range(q)] for j in range(p)])), 1e-9)
P = np.linalg.inv(Rm); pc = -P / np.sqrt(np.outer(np.diag(P), np.diag(P))); np.fill_diagonal(pc, 1)
check("corrélations partielles (inverse de R)", np.abs(np.array(R["acp"]["partial"]) - pc).max(), 1e-9)

print("\nDiagnostic T² / Q")
t = R["tq"]; A, nn = t["A"], t["n"]; lam = w
T2 = (nn - 1) / nn * (F[:, :A] ** 2 / lam[:A]).sum(1); Q = (F[:, A:] ** 2).sum(1)
check("T² de Hotelling", np.abs(np.array(t["T2"]) - T2).max(), 1e-9)
check("Q (écart au modèle)", np.abs(np.array(t["Q"]) - Q).max(), 1e-9)
check("limite T² : (n−1)²/n · Bêta⁻¹(0,95 ; A/2 ; (n−A−1)/2)", abs(t["ucT"] - (nn - 1) ** 2 / nn * stats.beta.ppf(0.95, A / 2, (nn - A - 1) / 2)), 1e-8)
th1, th2 = lam[A:].sum(), (lam[A:] ** 2).sum(); check("limite Q (approximation de Box)", abs(t["ucQ"] - th2 / th1 * stats.chi2.ppf(0.95, th1 ** 2 / th2)), 1e-8)

print("\nACM (méthode creuse par le tableau de Burt, comparée à l'AFC du tableau disjonctif)")
ans = R["acm"]["answers"]; K = len(ans[0]); cats = [sorted(set(a[j] for a in ans)) for j in range(K)]
D = np.array([[1.0 if a[j] == c else 0.0 for j in range(K) for c in cats[j]] for a in ans]); Nt = D.sum(); Pm = D / Nt; r = Pm.sum(1); c = Pm.sum(0)
S = (Pm - np.outer(r, c)) / np.sqrt(np.outer(r, c)); U, s, Vt = np.linalg.svd(S, full_matrices=False); ev = s ** 2
m = len(R["acm"]["vals"]); check("valeurs propres de l'ACM", np.abs(np.array(R["acm"]["vals"]) - ev[:m]).max(), 1e-10)
check("somme des valeurs propres = M/K − 1", abs(sum(R["acm"]["vals"]) - (D.shape[1] / K - 1)), 1e-10)
Fi = (U * s) / np.sqrt(r)[:, None]; check("coordonnées des individus (4 axes)", same_up_to_sign(R["acm"]["F"], Fi[:, :4]), 1e-8)
Gm = (Vt.T * s) / np.sqrt(c)[:, None]; check("coordonnées des modalités (4 axes)", same_up_to_sign(R["acm"]["G"], Gm[:, :4]), 1e-8)

print("\nAFC")
N = np.array(R["afc"]["N"], float); chi2, pval, ddl, _ = stats.chi2_contingency(N, correction=False)
check("χ² d'indépendance (scipy)", abs(R["afc"]["chi2"] - chi2) / chi2, 1e-12); check("p-valeur du χ²", abs(R["afc"]["pval"] - pval), 1e-12)
Pn = N / N.sum(); r2 = Pn.sum(1); c2 = Pn.sum(0); S2 = (Pn - np.outer(r2, c2)) / np.sqrt(np.outer(r2, c2)); U2, s2, V2 = np.linalg.svd(S2, full_matrices=False)
qa = len(R["afc"]["vals"]); check("valeurs propres de l'AFC", np.abs(np.array(R["afc"]["vals"]) - s2[:qa] ** 2).max(), 1e-12)
check("inertie totale = χ² / n", abs(sum(R["afc"]["vals"]) - chi2 / N.sum()), 1e-12)
check("coordonnées des lignes", same_up_to_sign(R["afc"]["F"], ((U2 * s2) / np.sqrt(r2)[:, None])[:, :qa]), 1e-10)
check("coordonnées des colonnes", same_up_to_sign(R["afc"]["G"], ((V2.T * s2) / np.sqrt(c2)[:, None])[:, :qa]), 1e-10)

print("\nClassification")
Pw = np.array(R["ward"]["P"]); L = linkage(Pw, method="ward"); nw = len(Pw)
check("hauteurs de Ward (scipy, gain = h² / 2n)", np.abs(np.sort(L[:, 2] ** 2 / (2 * nw)) - np.sort(R["ward"]["heights"])).max(), 1e-12)
check("partition en 4 classes (indice de Rand ajusté = 1)", 1 - adjusted_rand_score(fcluster(L, 4, "maxclust"), R["ward"]["labels4"]), 1e-12)
check("silhouette moyenne (scikit-learn)", abs(R["sil"]["value"] - silhouette_score(np.array(R["sil"]["P"]), R["sil"]["labels"])), 1e-12)

print("\nDépendances")
def dcor_np(a, b):
    a, b = np.asarray(a), np.asarray(b); A = np.abs(a[:, None] - a[None]); B = np.abs(b[:, None] - b[None])
    A = A - A.mean(0) - A.mean(1)[:, None] + A.mean(); B = B - B.mean(0) - B.mean(1)[:, None] + B.mean()
    return np.sqrt((A * B).mean() / np.sqrt((A * A).mean() * (B * B).mean()))
d = R["dep"]; check("corrélation de distance, y = x² + bruit", abs(d["dcorXY"] - dcor_np(d["x"], d["y"])), 1e-12)
check("corrélation de distance, z = exp(x) + bruit", abs(d["dcorXZ"] - dcor_np(d["x"], d["z"])), 1e-12)
check("Spearman (scipy)", abs(d["spearXZ"] - stats.spearmanr(d["x"], d["z"]).statistic), 1e-12)
check("Pearson (scipy)", abs(d["pearXZ"] - stats.pearsonr(d["x"], d["z"]).statistic), 1e-12)

print("\nLois de probabilité")
check("quantiles de la loi bêta", max(abs(v - stats.beta.ppf(pp, a, b)) for pp, a, b, v in R["dist"]["betaInv"]), 1e-9)
check("quantiles du χ² (ddl non entiers)", max(abs(v - stats.chi2.ppf(pp, k)) / stats.chi2.ppf(pp, k) for pp, k, v in R["dist"]["chi2Inv"]), 1e-9)
check("quantiles de la loi normale", max(abs(v - stats.norm.ppf(pp)) for pp, v in R["dist"]["normInv"]), 1e-9)
check("fonction de survie du χ²", max(abs(v - stats.chi2.sf(x2, k)) for x2, k, v in R["dist"]["chi2sf"]), 1e-12)
check("queues hypergéométriques (P(X ≥ x), P(X ≤ x))", max(max(abs(up - stats.hypergeom.sf(x3 - 1, N0, K0, n0)), abs(lo - stats.hypergeom.cdf(x3, N0, K0, n0))) for x3, N0, K0, n0, up, lo in R["dist"]["hyper"]), 1e-12)

print("\nProjections non linéaires")
nq = R["nq"]; Xh, Yl, k = np.array(nq["X"]), np.array(nq["Y"]), nq["k"]
check("fiabilité (trustworthiness, scikit-learn)", abs(nq["T"] - trustworthiness(Xh, Yl, n_neighbors=k)), 1e-12)
check("continuité (fiabilité avec les rôles échangés)", abs(nq["C"] - trustworthiness(Yl, Xh, n_neighbors=k)), 1e-12)

print("\nVariables illustratives (valeurs-tests des modalités, formule de FactoMineR)")
sp = R["supp"]; Fs, ls, g = np.array(sp["F"]), np.array(sp["vals"]), np.array(sp["groups"]); err = 0
for m in sp["vtest"]:
    mask = g == m["cat"]; nc = mask.sum(); ref = Fs[mask].mean(0) / np.sqrt(ls / nc * (len(g) - nc) / (len(g) - 1)); err = max(err, np.abs(np.array(m["v"]) - ref).max())
check("valeur-test = moyenne / √(λ/n_c · (n−n_c)/(n−1))", err, 1e-10)

print("\nImputation par ACP itérative régularisée (Josse & Husson)")
Xi = np.array([[np.nan if v is None else v for v in r] for r in R["imp"]["X"]]); Y = np.array(R["imp"]["Y"]); miss = np.isnan(Xi)
check("valeurs observées inchangées", np.abs(Y[~miss] - Xi[~miss]).max(), 0)
mu, sd = Y.mean(0), Y.std(0); Zy = (Y - mu) / sd; wv, Vv = np.linalg.eigh(Zy.T @ Zy / len(Y)); o = np.argsort(wv)[::-1]; wv, Vv = wv[o], Vv[:, o]; S = R["imp"]["S"]
sig2 = wv[S:].mean(); rec = mu + sd * (((Zy @ Vv[:, :S]) * ((wv[:S] - sig2) / wv[:S])) @ Vv[:, :S].T)
check("point fixe : trous = reconstruction régularisée", np.abs(Y[miss] - rec[miss]).max() / np.abs(Y[miss]).max(), 1e-4)

print(f"\n{sum(results)} contrôles réussis sur {len(results)}")
sys.exit(0 if all(results) else 1)
