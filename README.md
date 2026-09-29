# Prisme Studio

**Visualisation et analyse multidimensionnelle dans le navigateur.** On dépose un fichier et on obtient en quelques secondes :

- l'analyse factorielle adaptée (ACP, ACM, AFC ou AFDM pour les données mixtes) ;
- des classes ;
- ce qui explique une variable cible (arbre de décision lisible) ;
- des relations entre variables, détectées automatiquement ;
- l'exploration du nuage en 3D et en dimension supérieure.

Aucune installation, aucun serveur : **les données ne quittent jamais le poste**.

Version 4.1.0.

- **Studio complet** : jusqu'à 500 000 lignes.
- **Mode grands volumes** : CSV, Parquet ou Excel ; 10 millions de lignes testées (CSV de 1,45 Go).

## En 30 secondes

Il faut Python 3 ; Node.js est conseillé pour les tests.

```bash
python build.py
```

Ouvrir `dist/Prisme-Studio.html` par double-clic. L'écran d'accueil propose un exemple, votre fichier (CSV, TSV, Excel, JSON ou Parquet) ou un grand fichier. L'interface existe en français et en anglais.

## Mettre en ligne gratuitement

Le site est publié par **GitHub Pages** : https://levraiowen.github.io/prisme-studio/. À chaque `git push`, `.github/workflows/pages.yml` teste le moteur, construit `dist/site/` et le met en ligne.

Les autres options sont détaillées dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) : Netlify Drop, Docker pour une entreprise.

Une fois en ligne, l'application est installable et fonctionne hors ligne.

## Ce que l'outil fait

| Analyse | Vues |
| --- | --- |
| ACP, ACM, AFC et AFDM, choisies selon les types de colonnes | Nuage 3D avec sélection au lasso partagée par toutes les vues |
| Mode supervisé : valeur d'information, AUC, arbre de décision, détection des fuites de données | Couleur de la 3D par la cible, taux par classe et par modalité |
| Comparaison de deux groupes : d de Cohen, test de Welch, V de Cramér | Distributions superposées, écarts de proportions |
| Analyse temporelle : dates reconnues, variables dérivées, agrégation par mois, trimestre, année | Évolution par période, trajectoire dans le plan factoriel |
| Qualité des données : doublons exacts, identifiants répétés, types ambigus, type modifiable | Aide « ? » sur chaque graphique |
| Nombre d'axes : Kaiser, coude, analyse parallèle de Horn, stabilité par bootstrap | Hyperespace : Grand Tour entre projections, anatomie des axes |
| HCPC (Ward + k-means) avec description des classes par valeurs-tests | Coordonnées parallèles, matrice de Bertin |
| Relations entre variables : Pearson, Spearman, dCor, scagnostics | Matrice de nuages classée par scagnostics |
| Insights automatiques (asymétrie, bimodalité, atypiques, liens non linéaires, classes…) | t-SNE et UMAP avec fiabilité et continuité, diagramme de Shepard |
| Diagnostic T² / Q, individus supplémentaires, simulateur de projection | Cartes de densité, arbre couvrant minimal, nuages d'incertitude |
| **Grands volumes** : ACP exacte, classes et atypiques sur des millions de lignes ; CSV, Parquet, Excel | Cartes de densité façon Datashader, relief 3D, lasso, filtrage croisé, annuler et rétablir |
| Valeurs manquantes : suppression, moyenne ou imputation par ACP itérative | Thème clair ou sombre, présentation guidée |
| Lien de partage d'une vue avec ses réglages et ses filtres ; annuler et rétablir | Export PDF direct, version anglaise, utilisation sur téléphone |

Toute sélection (lasso, classe, filtre) est **expliquée** : les variables et modalités qui la distinguent du reste.

## Organisation du dossier

```
prisme-studio/
├── README.md              ce fichier
├── CHANGELOG.md           historique des versions
├── build.py               construit dist/ à partir de src/
├── package.json           raccourcis : npm run build | test | serve | deploy:netlify
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
│   │   ├── big.js         mode grands volumes (lecture en flux, colonnes typées, Parquet, lasso)
│   │   ├── data.js        dates, qualité des données, comparaison de groupes
│   │   ├── target.js      mode supervisé : valeur d'information, AUC, arbre de décision
│   │   └── datasets.js    jeu d'exemple
│   ├── ui/                interface : scène 3D, graphiques, onglets, grands volumes, API, accueil, aide, partage, anglais
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
npm test                        # 78 tests, 146 cas limites, 28 contrôles du mode grands volumes
python tests/crosscheck.py      # 49 comparaisons avec numpy, scipy et scikit-learn (pip install -r requirements-dev.txt)
node tests/bench.mjs 100000 20  # banc de charge
node tests/gen_demo.mjs 2000000 demo.csv   # jeu de démo de 2 M lignes pour essayer le mode grands volumes
```

La CI (`.github/workflows/ci.yml`) rejoue ces suites à chaque push.

## Auteur

Owen, à partir d'un projet d'analyse de données de L3 (ACP, ACM, AFC).
