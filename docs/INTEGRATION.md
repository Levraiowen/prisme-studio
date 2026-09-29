# Intégration dans d'autres outils

## Paramètres d'URL

| Paramètre | Effet | Exemple |
| --- | --- | --- |
| `data` | Charge un fichier (CSV, TSV, JSON, Excel, Parquet) | `?data=/data/clients.parquet` |
| `method` | Force la méthode (`ACP`, `ACM`, `AFC`, `AFDM`) | `&method=ACM` |
| `ex` | Ouvre un exemple (`ecommerce`, `luxe`, `clients`, `ventes`) | `?ex=luxe` |
| `view` | Vue partagée (bouton « Partager ») : méthode, variables, réglages, onglet, sélection, filtres du mode grands volumes, encodés en base64url | `&view=eyJtIjoi…` |
| `lang` | `en` : interface en anglais | `&lang=en` |
| `tab` | Ouvre un onglet (`insights`, `classes`, `projections`, `matrices`, `hyper`, `profil`…) | `&tab=insights` |
| `theme` | `dark` ou `light` | `&theme=light` |
| `mode` | `big` : ouvre le fichier `data` en mode grands volumes (CSV, Parquet ou Excel de plusieurs millions de lignes) | `?data=/data/transactions.parquet&mode=big` |

## API JavaScript (même page)

```js
PrismeStudio.loadCSV(texte, "ventes.csv");          // → { method, n, axes, inertiaPct }
PrismeStudio.loadRows([{ age: 34, panier: 72, canal: "Web" }, …], "clients");
await PrismeStudio.loadURL("https://…/ventes.parquet", "ACP");
PrismeStudio.setMethod("ACM");
PrismeStudio.select([0, 4, 17]);                     // sélection partagée par toutes les vues
const r = PrismeStudio.results();                    // résultats complets (voir ci-dessous)
PrismeStudio.on("result", s => …); PrismeStudio.on("selection", s => …);
await PrismeStudio.openBig("https://…/transactions.csv");   // mode grands volumes (URL, File ou { text })
PrismeStudio.bigResults();                                  // résultats agrégés du mode grands volumes
```

## `postMessage` (iframe)

```js
const frame = document.querySelector("iframe");
frame.contentWindow.postMessage({ type: "prisme:load", csv: texte, name: "ventes.csv" }, "*");
frame.contentWindow.postMessage({ type: "prisme:results" }, "*");
window.addEventListener("message", e => {
  if (e.data.type === "prisme:results") console.log(e.data.data.eigenvalues);
});
```

- **Messages acceptés** :
  - `prisme:load` (`csv`, `rows` ou `url`, avec `name` et `method` facultatifs ; `big: true` pour le mode grands volumes) ;
  - `prisme:results` ;
  - `prisme:select` (`indices`) ;
  - `prisme:method` (`method`).
- **Messages émis** : `prisme:ready`, `prisme:loaded`, `prisme:result`, `prisme:selection`, `prisme:results`, `prisme:error`.
- **Démonstration complète** : `examples/embed.html`.

## Format des résultats (`results()`, bouton « Résultats (JSON) »)

```json
{
  "format": "prisme-studio-results", "version": "4.0.0", "method": "ACP",
  "eigenvalues": [2.97, 2.38, 1.43], "inertiaPct": [29.7, 23.8, 14.3], "cumulativePct": [29.7, 53.5, 67.9],
  "retainedAxes": 3,
  "variables": [{ "name": "Age", "coord": [0.12, -0.71, 0.3], "cos2": [], "contrib": [] }],
  "individuals": { "names": [], "coord": [[]], "cos2": [[]], "contrib": [[]] },
  "clusters": { "k": 3, "r2": 0.58, "labels": [], "sizes": [] },
  "insights": [{ "kind": "nonlin", "score": 0.7, "title": "…", "text": "…" }]
}
```

Les coordonnées sont données sur 5 axes au plus, arrondies à 10⁻⁶. `clusters` et `insights` sont présents une fois les calculs d'arrière-plan terminés.

En mode grands volumes, « Résultats (JSON) » produit le format `prisme-studio-bigdata-results`. Il contient :
- les statistiques exactes de chaque colonne ;
- l'ACP : valeurs propres, corrélations, coordonnées des variables, limites T² et Q ;
- les classes : tailles, centres, profils ;
- la sélection courante, décrite par le d de Cohen et la valeur-test.
