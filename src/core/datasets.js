
/* ============================================================================
   Jeu de demonstration entreprise : 600 clients e-commerce simules (graine fixe).
   Structure volontairement riche pour tester l'outil : 4 segments caches,
   panier moyen log-normal (asymetrique), delai de livraison bimodal (express /
   standard), satisfaction liee au delai par un effet de seuil (non lineaire),
   duree de session en U selon l'age (lien non monotone), 6 revendeurs
   atypiques et 4 % de valeurs manquantes sur la satisfaction.
   ============================================================================ */
function genEcommerce(n = 600, seed = 42) {
  const rnd = mulberry(seed), N = (m, s) => m + s * gauss(rnd), pick = (arr, p) => { let u = rnd(), a = 0; for (let i = 0; i < arr.length; i++) { a += p[i]; if (u <= a) return arr[i]; } return arr.at(-1); };
  const SEG = [
    { l: "Premium fidèles", p: 0.2, age: [46, 9], anc: [62, 20], cmd: [14, 4], pan: [5.2, 0.35], rem: [3, 2], vis: [12, 3], ses: [9, 3], ret: [8, 4], exp: 0.8, canal: [0.35, 0.35, 0.25, 0.05] },
    { l: "Chasseurs de promos", p: 0.3, age: [34, 8], anc: [30, 12], cmd: [9, 3], pan: [3.8, 0.3], rem: [28, 6], vis: [18, 5], ses: [6, 2], ret: [18, 6], exp: 0.25, canal: [0.3, 0.45, 0.05, 0.2] },
    { l: "Occasionnels", p: 0.35, age: [41, 12], anc: [24, 12], cmd: [2.5, 1.2], pan: [4.3, 0.45], rem: [10, 5], vis: [3, 1.5], ses: [11, 4], ret: [6, 4], exp: 0.25, canal: [0.45, 0.15, 0.3, 0.1] },
    { l: "Nouveaux", p: 0.15, age: [28, 6], anc: [3.5, 1.5], cmd: [1.5, 1], pan: [4.0, 0.4], rem: [15, 6], vis: [6, 2], ses: [14, 4], ret: [12, 5], exp: 0.25, canal: [0.3, 0.5, 0.05, 0.15] }];
  const CAN = ["Site web", "Appli", "Magasin", "Marketplace"], REG = ["Île-de-France", "Nord", "Ouest", "Sud", "Est"];
  const head = ["Client", "Segment", "Canal", "Region", "Age", "Anciennete_mois", "Commandes_an", "Panier_moyen_EUR", "Taux_remise_pct", "Visites_mois", "Duree_session_min", "Taux_retour_pct", "Delai_livraison_j", "Satisfaction"];
  const lines = [head.join(",")], r1 = x => Math.round(x * 10) / 10;
  for (let i = 0; i < n; i++) {
    const s = pick(SEG, SEG.map(x => x.p)), reseller = i % 100 === 37;
    const age = Math.round(clamp(N(...s.age), 18, 80)), anc = r1(clamp(N(...s.anc), 1, 120));
    const cmd = reseller ? Math.round(80 + 40 * rnd()) : Math.max(0, Math.round(N(...s.cmd)));
    const pan = Math.round(Math.exp(N(...s.pan)) * (reseller ? 6 : 1)), rem = r1(clamp(N(...s.rem), 0, 60));
    const vis = r1(clamp(N(...s.vis) + (reseller ? 30 : 0), 0.5, 90)), ses = r1(clamp(0.5 * N(...s.ses) + 0.018 * (age - 42) ** 2, 1, 60)), ret = r1(clamp(N(...s.ret), 0, 60));
    const express = rnd() < s.exp, del = r1(clamp(express ? N(1.5, 0.4) : N(5.2, 0.9), 0.5, 10));
    const sat = r1(clamp(9 - 0.55 * Math.pow(Math.max(0, del - 2), 1.2) - 0.06 * ret + N(0, 0.7), 1, 10));
    const canal = pick(CAN, s.canal), reg = pick(REG, [0.28, 0.16, 0.2, 0.22, 0.14]);
    lines.push([`CL${String(i + 1).padStart(4, "0")}`, reseller ? "Revendeurs" : s.l, canal, reg, age, anc, cmd, pan, rem, vis, ses, ret, del, rnd() < 0.04 ? "" : sat].join(","));
  }
  return lines.join("\n");
}
EXEMPLES.ecommerce = { label: "Clients e-commerce", sub: "600 clients × 10 mesures", m: "ACP", file: "clients_ecommerce.csv", get csv() { return (this._csv ??= genEcommerce()); } };
