# Historique des versions

## 4.1.0 — 29 septembre 2026

### Analyse

- **AFDM** (analyse factorielle de données mixtes) : quantitatives et qualitatives dans la même analyse, carré des liaisons, carte des modalités, simulateur, rapport.
- **Onglet Cible** (mode supervisé) : valeur d'information et AUC de chaque variable, arbre de décision lisible (CART), taux par classe et par modalité, couleur de la 3D par la cible. Les variables trop parfaites (AUC ≥ 0,95) sont signalées comme fuites possibles et écartées de l'arbre.
- **Onglet Comparer** : deux groupes (sélection, classe, modalité, cible) comparés variable par variable ; d de Cohen, test de Welch, V de Cramér.
- **Onglet Temps** : dates reconnues (ISO, jj/mm/aaaa…), variables dérivées, évolution par mois, trimestre ou année, trajectoire dans le plan factoriel, composition des classes.
- **Qualité des données** (onglet Profil) : doublons exacts, identifiants répétés, colonnes vides ou constantes, nombres mêlés de texte ; actions directes (retirer les doublons, exporter les lignes, changer le type).

### Grands volumes

- Lecture des fichiers **Parquet** (groupe de lignes par groupe de lignes, ouverts d'office au-delà de 400 000 lignes) et **Excel**, dans le fil de calcul.
- **Lasso** sur la carte de densité ; une zone par plan factoriel, combinables.
- **Relief 3D** de la densité.
- **Type des colonnes** modifiable à la main, puis relecture du fichier.
- **Annuler / rétablir** les filtres.
- Correction : un identifiant numérique séquentiel de plus de 1 000 lignes entrait dans l'ACP.
- Dates Excel lues en texte ISO, sans décalage de fuseau horaire (aussi dans le Studio).

### Confort

- **Écran d'accueil** : essayer un exemple, ouvrir son fichier, ouvrir un grand fichier.
- **Aide « ? »** sur chaque graphique : ce qu'il montre, comment le lire, le piège à éviter.
- **Lien de partage** d'une vue : méthode, variables, réglages, onglet, sélection et filtres.
- **Annuler / rétablir** dans le Studio (Ctrl + Z, Ctrl + Maj + Z).
- **Export PDF** direct du rapport.
- **Version anglaise** de l'interface (bouton EN) ; les phrases d'interprétation générées restent en français.
- **Téléphone** : en-tête compact, réglages dans un panneau, barre d'accès rapide, onglets collés en haut.

### Exactitude

- 78 tests internes, 146 cas limites, 28 contrôles du mode grands volumes, 49 comparaisons avec numpy, scipy et scikit-learn (AFDM, AUC, test de Welch, V de Cramér, χ² compris).

## 4.0.0 — 28 septembre 2026

### Grands volumes

- **Mode grands volumes** : CSV de plusieurs millions de lignes (10 M lignes / 1,45 Go testés).
  - Lecture en flux dans un Web Worker et stockage en colonnes typées.
  - ACP exacte sur toutes les lignes.
  - Cartes de densité à la Datashader.
  - Filtrage croisé et description des sélections par taille d'effet.
  - Classes, atypiques, passage d'un échantillon au Studio complet.
- **Valeurs propres** : Householder-QL au-delà de 32 variables, 10 fois plus rapide que Jacobi ; l'ACP accepte plusieurs centaines de variables.
- Jusqu'à 500 000 lignes : 100 000 lignes analysées en 1,4 s, 500 000 lignes en 9,7 s (voir [docs/PERFORMANCES.md](docs/PERFORMANCES.md)).
- Moins de copies en mémoire :
  - ACP sans stockage du tableau centré-réduit ;
  - cos² et contributions calculés à la demande ;
  - ACM par tableau de Burt creux.
- Calculs lourds dans un Web Worker (HCPC, scagnostics, insights) : l'interface reste fluide.
- Échantillonnage signalé à l'écran pour les méthodes en n² (3D au-delà de 60 000 points, t-SNE, UMAP, Shepard, silhouette, bootstrap « m parmi n »).
- HCPC : pré-classification k-means++ puis affectation de tous les individus.
- Tableau des individus paginé.

### Formats et intégration

- Nouveaux formats : Parquet et JSON, en plus de CSV, TSV et Excel ; chargement par URL.
- API `window.PrismeStudio`, protocole `postMessage` pour les iframes, paramètres d'URL `?data=&method=&tab=&theme=`.
- Export des résultats complets en JSON.

### Déploiement

- Politique de sécurité du contenu, nginx durci, image Docker non privilégiée, docker-compose en lecture seule.
- Version hors ligne avec empreintes SHA-384.
- Intégration continue.

### Exactitude

- 38 comparaisons indépendantes avec numpy, scipy et scikit-learn.
- Log-gamma de Lanczos.
- Point fixe de l'imputation atteint à 10⁻¹⁰.
- Variance calculée en deux passes.
- Valeurs manquantes exclues variable par variable dans les descriptions.

### Corrections

- Silhouette non calculée au-delà de 900 individus.
- Dépassement de pile sur les grands tableaux : 43 appels `Math.max(...)` remplacés.
- Scagnostics incomplets dans l'onglet Matrices.
- Worker de calcul qui ne démarrait pas.
- Événements d'intégration envoyés avant que la page parente se soit identifiée.
- Lecture :
  - marqueurs de valeurs manquantes reconnus (NA, NaN, null, #N/A…) ;
  - montants avec « € » ou « % » ;
  - identifiants numériques et index pandas exclus des variables ;
  - colonnes texte à trop de modalités écartées de l'ACM.
- Débordement des carrés pour des valeurs extrêmes (10²⁰⁰ ou 10⁻²⁰⁰).
- AFC de deux variables exactement indépendantes.
- ACM : garde-fous sur le nombre de modalités.
- Tableau de Burt et matrice de Bertin : ils ne recalculent plus tout le tableau.
- Banc de robustesse : 88 cas limites sans défaut (`tests/robustness.mjs`).

## 3.0.0

Prisme Studio : onglets Insights, Projections, Classes, Matrices, Profil ; sélection au lasso expliquée ; hyperespace.

## 2.0.0 et 1.0.0

Prisme, application de soutenance : ACP, ACM et AFC en 3D.
