# Méthodes, formules et validation

Tous les calculs sont écrits dans le projet, en JavaScript, sans bibliothèque de calcul externe. Ce document liste ce qui est calculé, comment, et comment c'est vérifié.

## Analyses factorielles

| Méthode | Calcul | Référence |
| --- | --- | --- |
| ACP normée | Corrélations accumulées ligne par ligne (le tableau centré-réduit n'est jamais stocké), diagonalisation de Jacobi. Coordonnées, cos², contributions ; variables et individus supplémentaires | Lebart, Morineau & Piron (1995) |
| ACM | Tableau de Burt creux, jamais de tableau disjonctif complet : (S'S)ₐᵦ = (Bₐᵦ / nK² − cₐcᵦ) / √(cₐcᵦ). Rapports de corrélation η² | Benzécri (1973) ; Greenacre (2017) |
| AFC | Décomposition de la matrice des résidus standardisés ; test du χ² d'indépendance | Benzécri (1973) |
| AFDM | Quantitatives centrées-réduites et indicatrices pondérées par 1/√pₖ dans une seule matrice Z'Z/n, accumulée en une passe. λ = Σ r² + Σ η² ; Σλ = P + M − K ; règle λ ≥ 1 (valeur propre moyenne). Modalités au barycentre des individus | Escofier (1979) ; Pagès (2004, 2014) |
| Nombre d'axes | Règle de Kaiser (ACP) ou seuil 1/K (ACM), coude, analyse parallèle de Horn | Horn (1965) |
| Stabilité des axes | Bootstrap des individus, réalignement de chaque réplique sur la solution de référence par rotation de Procrustes | Efron & Tibshirani (1993) ; Bickel, Götze & van Zwet (1997) pour le « m parmi n » |
| Qualité du modèle | T² de Hotelling (limite (n−1)²/n · Bêta⁻¹) et Q, écart au sous-espace (limite par l'approximation de Box) | Jackson & Mudholkar (1979) |
| Valeurs manquantes | Suppression, moyenne, ou ACP itérative régularisée (seules les cellules manquantes changent ; arrêt à 10⁻¹⁰) | Josse & Husson (2012, 2016) |

## Mode supervisé, comparaison, dates, qualité

| Élément | Calcul | Référence |
| --- | --- | --- |
| Importance d'une variable (cible binaire) | Valeur d'information IV = Σ (pₖ⁺ − pₖ⁻) ln(pₖ⁺ / pₖ⁻) sur des déciles (quantitatives) ou des modalités ; AUC de Mann-Whitney. Repères de Siddiqi : < 0,02 inutile, 0,1 moyen, 0,3 fort | Siddiqi (2006) ; Hanley & McNeil (1982) |
| Fuites de données | AUC ≥ 0,95 (ou IV ≥ 2 sans AUC) : variable signalée et écartée de l'arbre | — |
| Arbre de décision | CART : Gini (cible binaire) ou variance (cible numérique), 32 coupures candidates par quantiles, modalités ordonnées par taux ; appris sur 100 000 lignes au plus, feuilles recalculées sur toutes | Breiman et al. (1984) |
| Comparaison de deux groupes | d de Cohen (écart-type combiné), test de Welch (loi de Student, fonction bêta incomplète) ; V de Cramér et test du χ² pour les qualitatives | Cohen (1988) ; Welch (1947) ; Cramér (1946) |
| Dates | Formats ISO, jj/mm/aaaa, aaaa/mm/jj, aaaa-mm ; dates impossibles refusées (31/02) ; variables dérivées : année, mois écoulés, trimestre, mois, jour de la semaine, ancienneté | — |
| Doublons | Empreinte de 53 bits par ligne (deux accumulateurs mélangés) ; effectif exact vérifié face au comptage par chaînes | — |

## Classification

- **HCPC** : classification ascendante hiérarchique de Ward sur les coordonnées factorielles (algorithme des plus proches voisins réciproques, mise à jour de Lance-Williams), puis consolidation par k-means.
  - Nombre de classes : plus grand rapport de gains d'inertie successifs.
  - Au-delà de 1 200 individus : pré-classification k-means++, comme le paramètre `kk` de FactoMineR.
  - Références : Husson, Lê & Pagès (2017) ; Murtagh & Contreras (2012).
- **Description des classes et des sélections** : valeurs-tests quantitatives et qualitatives, avec les queues hypergéométriques exactes (Lebart et al., 1995), plus les parangons et les individus spécifiques.
- **Silhouette** : Rousseeuw (1987).

## Relations entre variables

- **Pearson, Spearman et corrélations partielles** (inverse de la matrice de corrélation).
- **Corrélation de distance (dCor)** : détecte toute dépendance, y compris non monotone, par exemple en U (Székely, Rizzo & Bakirov, 2007).
- **Scagnostics** : onze mesures de forme d'un nuage de points.
  - Sept mesures classiques, calculées sur l'arbre couvrant minimal : isolés, asymétrique, clairsemé, amas, strié, filament, monotone (Wilkinson, Anand & Grossman, 2005 ; version robuste de cassowaryr, Mason et al., 2022).
  - Quatre mesures de dépendance : dCor, non linéaire, non monotone, courbure.
- **ANOVA** (η²) et **V de Cramér**.

## Projections non linéaires et qualité des cartes

- **t-SNE** exact dans un Web Worker (van der Maaten & Hinton, 2008).
- **UMAP** (McInnes, Healy & Melville, 2018).
- **Fiabilité et continuité** : un voisin sur la carte est-il un vrai voisin ? un vrai voisin est-il resté proche ? (Venna & Kaski, 2001).
- **Diagramme de Shepard** : distances d'origine comparées aux distances projetées (Kruskal, 1964).

## Visualisation multidimensionnelle

| Vue | Référence |
| --- | --- |
| Grand Tour : trajectoire continue entre projections | Asimov (1985) ; Buja et al. (2005) |
| Coordonnées parallèles | Inselberg (1985) |
| Matrice réordonnable | Bertin (1967) |
| Matrice de nuages avec scagnostics | Wilkinson et al. (2005) |
| Densité par noyau, arbre couvrant minimal, nuages d'incertitude | — |

## Précision numérique

| Fonction | Méthode | Précision |
| --- | --- | --- |
| Loi normale | Φ par la fonction gamma incomplète ; Φ⁻¹ par Acklam, puis un pas de Newton | 1·10⁻¹⁴ |
| Lois bêta et χ² (quantiles) | séries et fractions continues des fonctions bêta et gamma incomplètes, puis dichotomie | 6·10⁻¹⁵ |
| Queues hypergéométriques | sommes exactes, log-gamma de Lanczos (g = 7) | 3·10⁻¹³ |
| Valeurs propres (ACP, ACM, AFC) | Jacobi cyclique | 6·10⁻¹⁵ |

La dernière colonne donne l'écart maximal mesuré face à numpy et scipy (`tests/crosscheck.py`).

## Validation

- **Tests internes** (`node tests/run_tests.mjs`) : **78 tests**.
  - Identités exactes : Σλ = p, Σλ ACM = M/K − 1, moyennes de T² et de Q, Σ des gains de Ward = inertie totale, Φ⁻¹(Φ(z)) = z.
  - Valeurs publiées du rapport.
  - Cas construits : relation en U, bimodalité, atypiques.
- **Contre-vérification indépendante** (`python tests/crosscheck.py`) : **49 comparaisons** avec numpy, scipy et scikit-learn.
  - Les écarts mesurés vont de 0 à 3·10⁻¹³.
  - Seule exception : le point fixe de l'imputation, à 5·10⁻⁶, qui correspond à l'arrêt d'un algorithme itératif.

  Elles portent sur :
  - l'ACP complète, T², Q et leurs limites ;
  - l'ACM (comparée à la SVD du tableau disjonctif) et l'AFC ;
  - Ward (hauteurs scipy, partition ARI = 1) et la silhouette ;
  - dCor, Spearman et Pearson ;
  - les quantiles des lois bêta, χ² et normale ;
  - les queues hypergéométriques ;
  - la fiabilité et la continuité ;
  - les valeurs-tests des individus supplémentaires ;
  - le point fixe de l'imputation ;
  - l'AFDM (valeurs propres, coordonnées, barycentres des modalités) ;
  - l'AUC (scikit-learn), le test de Welch, le V de Cramér et le test du χ² de la comparaison de groupes.
- **Cas limites** (`node tests/robustness.mjs`) : **146 cas** (tableaux vides, constants, colinéaires, unicode, valeurs extrêmes…), chaque colonne essayée comme cible.
- **Mode grands volumes** (`node tests/bench_big.mjs`) : **28 contrôles**, dont le lasso comparé point par point à PNPOLY et la lecture en colonnes (Parquet) comparée à la lecture CSV.
- **Banc de charge** (`node tests/bench.mjs 100000 20`) : il vérifie aussi Σλ ACM = M/K − 1 sur 100 000 lignes.

## Ce que l'outil ne fait pas

- **Pas d'inférence causale** : les insights décrivent des associations.
- **Un seul modèle prédictif, volontairement simple** : l'arbre de décision de l'onglet Cible est appris sur toutes les données présentes, sans échantillon de validation. Il décrit ; il faut le valider sur d'autres données avant de s'en servir pour décider. La « prévision » d'un nouvel individu dans le Simulateur reste une projection sur les axes.
- **Méthodes échantillonnées au-delà d'une taille donnée** : l'échantillonnage est signalé à l'écran (voir [PERFORMANCES.md](PERFORMANCES.md)). Les grandeurs qui décrivent les données (axes, coordonnées, valeurs-tests) restent exactes sur toutes les lignes.

## Références

- Asimov, D. (1985). The Grand Tour. *SIAM J. Sci. Stat. Comput.* 6(1).
- Breiman, L., Friedman, J., Olshen, R. & Stone, C. (1984). *Classification and Regression Trees*. Wadsworth.
- Cohen, J. (1988). *Statistical Power Analysis for the Behavioral Sciences*, 2ᵉ éd. Erlbaum.
- Cramér, H. (1946). *Mathematical Methods of Statistics*. Princeton.
- Escofier, B. (1979). Traitement simultané de variables qualitatives et quantitatives en analyse factorielle. *Cahiers de l'analyse des données* 4(2).
- Franklin, W. R. (1970, publié en ligne). PNPOLY : point inclusion in polygon test.
- Hanley, J. A. & McNeil, B. J. (1982). The meaning and use of the area under a ROC curve. *Radiology* 143.
- Benzécri, J.-P. (1973). *L'analyse des données*. Dunod.
- Bertin, J. (1967). *Sémiologie graphique*. Mouton.
- Bickel, P., Götze, F. & van Zwet, W. (1997). Resampling fewer than n observations. *Statistica Sinica* 7.
- Buja, A., Cook, D., Asimov, D. & Hurley, C. (2005). Computational methods for high-dimensional rotations in data visualization. *Handbook of Statistics* 24.
- Efron, B. & Tibshirani, R. (1993). *An Introduction to the Bootstrap*. Chapman & Hall.
- Greenacre, M. (2017). *Correspondence Analysis in Practice*, 3ᵉ éd. CRC Press.
- Horn, J. L. (1965). A rationale and test for the number of factors in factor analysis. *Psychometrika* 30.
- Husson, F., Lê, S. & Pagès, J. (2017). *Exploratory Multivariate Analysis by Example Using R*, 2ᵉ éd. CRC Press.
- Inselberg, A. (1985). The plane with parallel coordinates. *The Visual Computer* 1.
- Jackson, J. E. & Mudholkar, G. S. (1979). Control procedures for residuals associated with principal component analysis. *Technometrics* 21.
- Josse, J. & Husson, F. (2012). Handling missing values in exploratory multivariate data analysis methods. *J. SFdS* 153(2) ; (2016) missMDA, *J. Stat. Software* 70.
- Kruskal, J. B. (1964). Multidimensional scaling by optimizing goodness of fit. *Psychometrika* 29.
- Lebart, L., Morineau, A. & Piron, M. (1995). *Statistique exploratoire multidimensionnelle*. Dunod.
- Mason, H., Lee, S., Laa, U. & Cook, D. (2022). cassowaryr: compute scagnostics on pairs of numeric variables. *R Journal* 14.
- McInnes, L., Healy, J. & Melville, J. (2018). UMAP. arXiv:1802.03426.
- Pagès, J. (2004). Analyse factorielle de données mixtes. *Revue de statistique appliquée* 52(4) ; (2014) *Multiple Factor Analysis by Example Using R*. CRC Press.
- Murtagh, F. & Contreras, P. (2012). Algorithms for hierarchical clustering: an overview. *WIREs DMKD* 2.
- Rousseeuw, P. J. (1987). Silhouettes. *J. Comput. Appl. Math.* 20.
- Siddiqi, N. (2006). *Credit Risk Scorecards*. Wiley.
- Welch, B. L. (1947). The generalization of « Student's » problem when several different population variances are involved. *Biometrika* 34.
- Székely, G., Rizzo, M. & Bakirov, N. (2007). Measuring and testing dependence by correlation of distances. *Ann. Statist.* 35.
- van der Maaten, L. & Hinton, G. (2008). Visualizing data using t-SNE. *JMLR* 9.
- Venna, J. & Kaski, S. (2001). Neighborhood preservation in nonlinear projection methods. *ICANN*.
- Wilkinson, L., Anand, A. & Grossman, R. (2005). Graph-theoretic scagnostics. *IEEE InfoVis*.

## Mode grands volumes

| Élément | Méthode | Référence |
| --- | --- | --- |
| Lecture | Découpage CSV (RFC 4180) octet par octet, nombres lus sans passer par des chaînes, dictionnaire de modalités par empreinte FNV-1a | — |
| Cartes de densité | Agrégation par cases de tous les points, intensité par égalisation d'histogramme, couleur des modalités mélangée case par case | Datashader (Bednar et al.) |
| Échelle des cartes | Même échelle sur les deux axes : les distances du plan factoriel sont respectées | — |
| Filtrage croisé | Filtres combinés (rectangle, intervalles, modalités, classes, atypiques) recalculés sur toutes les lignes | imMens (Liu, Jiang & Heer, 2013) ; Falcon (Moritz, Howe & Heer, 2019) |
| Description d'une sélection | Taille d'effet (écart des moyennes en écarts-types), valeur-test indiquée | Cohen (1988) |
| Échantillons | Sélection séquentielle uniforme (algorithme S), reproductible | Knuth, *TAOCP* vol. 2 |
| Lecture Parquet et Excel | Parquet lu groupe de lignes par groupe de lignes (bibliothèque hyparquet) ; Excel converti en CSV (SheetJS), dates en texte ISO | — |
| Lasso | Règle pair-impair, arêtes rangées par bandes horizontales : chaque point n'est comparé qu'aux arêtes de sa bande ; résultat identique à PNPOLY | Franklin (PNPOLY) |
| Relief 3D | Effectifs par case lissés (trois flous en boîte, rayon choisi pour que le bruit de Poisson reste sous 5 %), même intensité que la carte | — |
| Valeurs propres au-delà de 32 variables | Householder puis QL implicite (tred2 / tql2), résidu de l'ordre de 10⁻¹⁵ | Wilkinson & Reinsch (1971) ; JAMA |

Avec des millions de lignes, presque toute différence est statistiquement significative. Les sélections sont donc classées par taille d'effet et non par p-valeur.
