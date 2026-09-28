# Sécurité et confidentialité

## Circulation des données

- **Aucun envoi.** Les fichiers ouverts (CSV, Excel, JSON, Parquet) sont lus par le navigateur et restent en mémoire sur le poste. Aucune donnée n'est transmise à un serveur, ni à Prisme ni à un tiers.
- **Connexions sortantes**, uniquement vers des CDN publics, pour du code et jamais pour des données :
  - bibliothèques cdnjs.cloudflare.com et cdn.jsdelivr.net ;
  - polices fonts.googleapis.com et fonts.gstatic.com.

  La version `--offline` n'en fait aucune.
- **Chargement par URL** (`?data=` ou le champ « URL d'un fichier ») : le navigateur de l'utilisateur télécharge le fichier directement, sans cookies (`credentials: "omit"`). Le serveur de données doit autoriser l'accès (en-tête CORS).
- **Mémoire locale** : seul le thème choisi est conservé (`localStorage`). Les projets sont enregistrés uniquement quand l'utilisateur le demande, sous forme de fichier `.prisme.json` sur son poste.
- **Intégration par iframe** :
  - Prisme n'accepte de commandes que de la page qui l'intègre.
  - Il ne lui envoie aucun événement avant qu'elle se soit adressée à lui, puis répond à son origine exacte.
  - La page qui intègre peut lire les résultats. La directive `frame-ancestors` limite donc les domaines autorisés à intégrer Prisme ; par défaut, seul le même domaine l'est.

## Durcissement

- **Politique de sécurité du contenu (CSP)** :
  - pas d'`eval` ;
  - scripts limités à la page et aux deux CDN ;
  - workers en `blob:` uniquement ;
  - `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.

  Elle est fournie à deux endroits :
  - dans la page, par une balise `meta` ;
  - dans `deploy/security-headers.conf`, par un en-tête HTTP, avec `frame-ancestors`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` et COOP.
- **Contenu des fichiers** : chaque valeur lue (noms de colonnes, modalités, identifiants) est échappée avant affichage, contre l'injection de code (XSS).
- **Intégrité des dépendances** : empreintes SHA-384 vérifiées à chaque build hors ligne (`vendor/lock.json`).
- **Conteneur** : utilisateur non privilégié, `no-new-privileges`, toutes capacités retirées, système de fichiers en lecture seule.

## Dépendances

| Bibliothèque | Version | Licence | Usage |
| --- | --- | --- | --- |
| three.js (+ post-traitement) | r128 | MIT | Rendu 3D |
| PapaParse | 5.4.1 | MIT | Lecture CSV |
| SheetJS (xlsx) | 0.18.5 | Apache-2.0 | Lecture Excel, chargée à la demande |
| umap-js | 1.4.0 | Apache-2.0 | Projection UMAP, chargée à la demande |
| hyparquet | 1.31.2 | MIT | Lecture Parquet, chargée à la demande |

Tout le reste est écrit dans le projet, sans autre dépendance : algèbre linéaire, statistiques, classification, t-SNE, scagnostics, interface.
