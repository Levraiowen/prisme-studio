# Historique des versions

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
