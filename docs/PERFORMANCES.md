# Performances et limites

## Mesures

Jeu synthétique : 20 variables quantitatives, 3 qualitatives, un identifiant et 2 % de valeurs manquantes. Mesures faites sur le poste de développement.

### Dans le navigateur (Chrome)

| Lignes | CSV | Ouverture → ACP affichée en 3D | Calculs d'arrière-plan¹ | Gel maximal de l'interface | Mémoire JS |
| --- | --- | --- | --- | --- | --- |
| 100 000 | 13 Mo | 1,4 s | 0,5 à 2 s | aucun | ≈ 320 Mo |
| 250 000 | 34 Mo | 5 à 6 s | quelques secondes | < 1 s | ≈ 800 Mo |
| 500 000 | 69 Mo | 9,7 s | ≈ 38 s | ≈ 1 s² | ≈ 1,1 Go |

¹ HCPC, scagnostics et insights, calculés dans un Web Worker : l'interface reste utilisable pendant ce temps.
² Le seul gel est la copie des données vers le worker.

### Détail par étape (moteur seul, `node tests/bench.mjs`)

| Étape | 100 000 lignes | 250 000 lignes |
| --- | --- | --- |
| Lecture et typage des colonnes | 0,5 s | 1,5 s |
| Imputation par ACP itérative (2 % de trous) | 0,9 s | 2,7 s |
| ACP complète | 0,17 s | 0,47 s |
| HCPC (pré-classification + affectation de tous) | 0,8 s | 2,1 s |
| Scagnostics des 190 paires | 1,0 s | 1,7 s |
| Insights automatiques | 1,2 s | 2,3 s |
| T² de Hotelling et Q | 0,04 s | 0,1 s |
| Valeurs-tests d'une sélection de 5 000 individus | 0,17 s | 0,45 s |
| ACM creuse (4 variables qualitatives) | 0,09 s | 0,23 s |
| Mémoire en fin de banc | 685 Mo | 804 Mo |

L'ACM du banc contrôle aussi une identité exacte : la somme des valeurs propres vaut M/K − 1 (2,500000 obtenu, 2,5 attendu).

`node tests/bench.mjs <lignes> <variables>` rejoue ces mesures.

## Limites recommandées

- **Lignes** : jusqu'à **250 000 lignes** sur un poste de 8 Go, jusqu'à **500 000** sur un poste de 16 Go. Le plafond du navigateur est d'environ 4 Go de mémoire JavaScript par onglet.
- **Variables quantitatives (ACP)** : jusqu'à 100 sans ralentissement. La décomposition de Jacobi coûte p³ et l'accumulation des corrélations n·p².
- **Modalités (ACM)** : jusqu'à 300 au total. Le tableau disjonctif n'est jamais construit : l'ACM passe par le tableau de Burt (M × M), donc le nombre de lignes n'est pas limitant.
- **Au-delà de 500 000 lignes** : exporter en CSV, qui s'ouvre en mode grands volumes (section suivante). Au-delà de quelques dizaines de millions de lignes, agréger en amont (SQL, Spark, pandas).

## Ce qui est exact, ce qui est échantillonné

Tout ce qui décrit les données est calculé sur **toutes** les lignes :
- ACP, ACM, AFC ;
- coordonnées, contributions, cos² ;
- T² et Q ;
- valeurs-tests des sélections et des classes ;
- imputation ;
- export JSON et CSV.

Les méthodes dont le coût croît comme n² travaillent sur un échantillon aléatoire reproductible, signalé à l'écran :

| Méthode | Au-delà de | Stratégie |
| --- | --- | --- |
| Affichage 3D | 60 000 points | échantillon affiché, calculs complets, sélection sur tous les points |
| HCPC | 1 200 individus | pré-classification k-means++ (sur 20 000 au plus), puis affectation de tous (paramètre `kk` de FactoMineR) |
| t-SNE / UMAP | 2 000 / 10 000 | projection d'un échantillon |
| Bootstrap, uncertainty clouds | 3 000 | bootstrap « m parmi n », écarts remis à l'échelle √(m/n) |
| Analyse parallèle de Horn | 3 000 | seuils calculés pour n = 3 000 (plus prudents) |
| Silhouette | 1 500 | échantillon, comme `sample_size` de scikit-learn |
| Scagnostics | 8 000 points par paire | 45 paires analysées en profondeur après un pré-tri de toutes les paires |
| Fiabilité / continuité | 1 200 | échantillon |
| Diagramme de Shepard | 1 500 individus | stress calculé sur toutes les paires de l'échantillon, 2 500 paires dessinées |
| Graphiques SVG, coordonnées parallèles | 2 500 / 800 | échantillon dessiné ; filtres appliqués à toutes les lignes |
| Tableau des individus | 300 lignes | pagination ; tri et recherche sur toutes |

## Mode grands volumes (plusieurs millions de lignes)

Au-delà de 40 Mo (25 Mo pour Excel, 400 000 lignes pour Parquet), un fichier s'ouvre en **mode grands volumes**, qui fonctionne autrement que le Studio :
- le fichier est lu en flux, par morceaux de 8 Mo, dans un Web Worker ;
- les données sont rangées en colonnes compactes : 4 octets par nombre (`Float32`), 2 octets par modalité ;
- aucune ligne n'est créée en objet JavaScript ;
- la page ne reçoit que des agrégats (images de densité, histogrammes, résumés).

On peut aussi forcer ce mode : case « Grands volumes » sous la zone de dépôt, ou `?mode=big` dans l'URL.

| Fichier | Lecture et typage | ACP exacte | Carte de densité | Filtre + description | Classes | Mémoire |
| --- | --- | --- | --- | --- | --- | --- |
| 1 M lignes × 24 colonnes (144 Mo), moteur | 1,7 s | 0,4 s | 20 ms | 0,2 s | 0,4 s | 128 Mo |
| 2 M lignes × 16 colonnes (184 Mo, format français), **Chrome** | 2,7 s | 0,9 s | 33 ms | 0,3 à 0,5 s | 1,0 s | 103 Mo |
| Parquet 250 000 lignes × 9 colonnes (11 Mo), **Chrome** | 1,3 s | 0,14 s | 5 ms (relief 200 × 200) | 40 ms (lasso) | — | 5 Mo |
| 10 M lignes × 24 colonnes (1,45 Go), moteur | 11,1 s (130 Mo/s) | 3,4 s | 75 à 90 ms | 1,6 s | 0,9 s | 1,2 Go |

- **Toutes les lignes, calcul exact** :
  - statistiques par variable (moyenne, écart-type, asymétrie, aplatissement, coefficient de bimodalité) ;
  - ACP (corrélations, axes, coordonnées), T² et Q de chaque ligne ;
  - cartes de densité ;
  - filtres croisés et description des sélections ;
  - affectation aux classes.
- **Sur un échantillon aléatoire** :
  - quantiles : 200 000 lignes ;
  - construction des classes (HCPC) : 20 000 lignes, puis affectation exacte de toutes les lignes ;
  - passage au Studio complet : 20 000 à 200 000 lignes, au choix.
- **Limite** : la mémoire vaut environ 4 octets par valeur numérique, plus 22 octets par ligne pour l'ACP.
  - 10 millions de lignes × 20 variables tiennent en 1,2 Go (testé).
  - Sur un poste de 16 Go, l'ordre de grandeur est de 20 à 25 millions de lignes (non testé).
- **Précision** : le stockage `Float32` garde 7 chiffres significatifs. Les écarts avec le moteur standard restent de l'ordre de 10⁻⁹ sur les valeurs propres et les corrélations (`tests/bench_big.mjs`).
