// Jeu de démonstration pour le mode grands volumes : clients fictifs, CSV au format français (« ; » et virgule décimale).
//   node tests/gen_demo.mjs 2000000 demo_clients_2M.csv        (2 M lignes, environ 180 Mo)
// Données entièrement synthétiques et reproductibles (graine fixe) : quatre segments, liens non linéaires, 1 % de valeurs manquantes.
import fs from "node:fs";
const N = +(process.argv[2] || 1000000), file = process.argv[3] || `demo_clients_${N}.csv`, out = fs.openSync(file, "w"); let s = 7;
const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5) | 0) >>> 0) / 4294967296, g = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(6.283185307 * rnd());
const seg = ["Premium", "Standard", "Découverte", "Pro"], can = ["Web", "Magasin", "Appli", "Téléphone"], reg = ["Île-de-France", "Auvergne-Rhône-Alpes", "Occitanie", "Nouvelle-Aquitaine", "Grand Est", "Hauts-de-France", "Bretagne", "PACA"];
fs.writeSync(out, "client_id;segment;canal;region;age;revenu_k€;panier_moyen;visites_mois;anciennete_mois;taux_retour_pct;satisfaction;delai_livraison_j;nb_articles;remise_pct;duree_session_min;score_fidelite\n");
let rows = [];
for (let i = 0; i < N; i++) {
  const k = Math.floor(rnd() * 4), age = Math.max(18, Math.round(38 + 12 * g() + (k === 0 ? 9 : k === 2 ? -8 : 0))), rev = Math.max(8, 32 + 14 * g() + (k === 0 ? 28 : k === 3 ? 15 : 0) + 0.3 * (age - 38));
  const panier = Math.max(5, Math.exp(3.9 + 0.35 * g() + (k === 0 ? 0.6 : k === 2 ? -0.4 : 0))), vis = Math.max(0, Math.round(6 + 3 * g() + (k === 3 ? 5 : 0))), anc = Math.max(1, Math.round(30 + 20 * g() + (k === 0 ? 20 : 0)));
  const ret = Math.max(0, 8 + 4 * g() - 0.05 * anc), sat = Math.min(10, Math.max(0, 7 + 1.2 * g() - 0.3 * Math.max(0, 5 + 2 * g() - 3))), del = Math.max(1, 3 + 2 * g() + (k === 2 ? 2 : 0)), art = Math.max(1, Math.round(panier / 25 + g()));
  const rem = Math.max(0, 5 + 4 * g() + (k === 2 ? 6 : 0)), sess = Math.max(1, 12 + 0.02 * (age - 45) ** 2 + 3 * g()), fid = Math.min(100, Math.max(0, 50 + 0.5 * anc + 2 * vis - 2 * ret + 8 * g()));
  const f = x => (rnd() < 0.01 ? "" : x.toFixed(2).replace(".", ","));
  rows.push(`C${1000000 + i};${seg[k]};${can[Math.floor(rnd() * 4)]};${reg[Math.floor(rnd() * 8)]};${age};${f(rev)};${f(panier)};${vis};${anc};${f(ret)};${f(sat)};${f(del)};${art};${f(rem)};${f(sess)};${f(fid)}`);
  if (rows.length === 20000) { fs.writeSync(out, rows.join("\n") + "\n"); rows = []; }
}
if (rows.length) fs.writeSync(out, rows.join("\n") + "\n"); fs.closeSync(out);
console.log(`${file} : ${N} lignes`);
