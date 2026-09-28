# Prisme Studio

**Visualisation et analyse multidimensionnelle dans le navigateur.** On dépose un fichier et on obtient en quelques secondes :

- l'analyse factorielle adaptée (ACP, ACM ou AFC) ;
- des classes ;
- des relations entre variables, détectées automatiquement ;
- l'exploration du nuage en 3D et en dimension supérieure.

Aucune installation, aucun serveur : **les données ne quittent jamais le poste**.

Version 4.0.0.

- **Studio complet** : jusqu'à 500 000 lignes.
- **Mode grands volumes** : 10 millions de lignes testées (CSV de 1,45 Go).

## En 30 secondes

Il faut Python 3 ; Node.js est conseillé pour les tests.

```bash
python build.py
```

Ouvrir `dist/Prisme-Studio.html` par double-clic, puis glisser un fichier : CSV, TSV, Excel, JSON ou Parquet.

## Mettre en ligne gratuitement

`python build.py` produit `dist/site/`, un site prêt à déployer. Le plus simple : sur [Cloudflare Pages](https://dash.cloudflare.com), aller dans **Workers & Pages → Create → Pages → Upload assets**, glisser `dist/site`, et le site est en ligne.

Les autres options sont détaillées dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) : Netlify Drop, GitHub Pages automatique à chaque push, Docker pour une entreprise.

Une fois en ligne, l'application est installable et fonctionne hors ligne.

## Ce que l'outil fait

| Analyse | Vues |
| --- | --- |
| ACP, ACM et AFC, choisies selon les types de colonnes | Nuage 3D avec sélection au lasso partagée par toutes les vues |
| Nombre d'axes : Kaiser, coude, analyse parallèle de Horn, stabilité par bootstrap | Hyperespace : Grand Tour entre projections, anatomie des axes |
| HCPC (Ward + k-means) avec description des classes par valeurs-tests | Coordonnées parallèles, matrice de Bertin |
| Relations entre variables : Pearson, Spearman, dCor, scagnostics | Matrice de nuages classée par scagnostics |
| Insights automatiques (asymétrie, bimodalité, atypiques, liens non linéaires, classes…) | t-SNE et UMAP avec fiabilité et continuité, diagramme de Shepard |
| Diagnostic T² / Q, individus supplémentaires, simulateur de projection | Cartes de densité, arbre couvrant minimal, nuages d'incertitude |
| **Grands volumes** : ACP exacte, classes et atypiques sur des millions de lignes | Cartes de densité façon Datashader, filtrage croisé, sélection décrite par taille d'effet |
| Valeurs manquantes : suppression, moyenne ou imputation par ACP itérative | Thème clair ou sombre, présentation guidée |

Toute sélection (lasso, classe, filtre) est **expliquée** : les variables et modalités qui la distinguent du reste.

## Organisation du dossier

```
prisme-studio/
├── README.md              ce fichier
├── CHANGELOG.md           historique des versions
├── build.py               construit dist/ à partir de src/
├── package.json           raccourcis : npm run build | test | serve | deploy:cloudflare | deploy:netlify
├── src/
│   ├── core/              moteur de calcul, sans interface (tourne aussi dans les Web Workers)
│   │   ├── engine.js      lecture des fichiers, ACP, ACM, AFC, valeurs propres
│   │   ├── stats.js       lois, moments, dépendances, valeurs-tests
│   │   ├── prep.js        transformations, valeurs manquantes, illustratives
│   │   ├── cluster.js     Ward, k-means, HCPC
│   │   ├── explore.js     Grand Tour, bootstrap, T² et Q, Shepard
│   │   ├── embed.js       t-SNE, UMAP, fiabilité et continuité
│   │   ├── scag.js        scagnostics
│   │   ├── insights.js    insights automatiques
│   │   ├── big.js         mode grands volumes (lecture en flux, colonnes typées)
│   │   └── datasets.js    jeu d'exemple
│   ├── ui/                interface : scène 3D, graphiques, onglets, grands volumes, API
│   ├── shell.html         structure de la page
│   └── styles.css         styles (thèmes clair et sombre)
├── tests/                 tests, contre-vérification Python, bancs de charge, générateur de démo
├── docs/                  déploiement, sécurité, méthodes, performances, intégration
├── deploy/                Dockerfile, nginx durci, docker-compose
├── examples/embed.html    intégration dans une autre page (iframe + postMessage)
├── .github/workflows/     ci.yml (tests à chaque push), pages.yml (déploiement GitHub Pages)
└── dist/                  généré par build.py (non versionné)
    ├── site/              le site à déployer
    ├── Prisme-Studio.html l'application en un seul fichier
    └── artifact.html      variante sans CSP
```

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Hébergement gratuit, Docker, hors ligne, portail |
| [docs/SECURITE.md](docs/SECURITE.md) | Circulation des données, CSP, dépendances et licences |
| [docs/METHODES.md](docs/METHODES.md) | Formules, références, précision numérique, validation |
| [docs/PERFORMANCES.md](docs/PERFORMANCES.md) | Mesures jusqu'à 10 millions de lignes, limites, part échantillonnée |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | API JavaScript, `postMessage`, paramètres d'URL, format des résultats |

## Validation

```bash
npm test                        # 53 tests, 88 cas limites, exactitude du mode grands volumes
python tests/crosscheck.py      # 38 comparaisons avec numpy, scipy et scikit-learn (pip install -r requirements-dev.txt)
node tests/bench.mjs 100000 20  # banc de charge
node tests/gen_demo.mjs 2000000 demo.csv   # jeu de démo de 2 M lignes pour essayer le mode grands volumes
```

La CI (`.github/workflows/ci.yml`) rejoue ces suites à chaque push.

## Auteur

Owen, à partir d'un projet d'analyse de données de L3 (ACP, ACM, AFC) réalisé avec Mathéo.
