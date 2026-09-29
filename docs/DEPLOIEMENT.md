# Déployer Prisme Studio

Prisme Studio est un **site statique** : pas de serveur applicatif, pas de base de données, pas de compte utilisateur.
- Les fichiers ouverts sont lus et analysés dans le navigateur du visiteur ; rien n'est envoyé à l'hébergeur.
- Un hébergement statique gratuit suffit donc, même pour des fichiers de plusieurs millions de lignes.

## 1. Construire

```bash
python build.py
```

| Sortie | Usage |
| --- | --- |
| `dist/site/` | **le site à déployer** : `index.html`, service worker (hors ligne), manifeste (installable), icônes, `_headers` (sécurité) |
| `dist/Prisme-Studio.html` | l'application en un seul fichier, à envoyer ou à ouvrir par double-clic |
| `dist/artifact.html` | même fichier sans CSP, pour un hébergeur qui impose la sienne |

Vérifier en local :

```bash
python -m http.server 8080 --directory dist/site
```

Puis ouvrir http://localhost:8080.

## 2. Déployer gratuitement

| | GitHub Pages (utilisé) | Netlify Drop (le plus rapide) |
| --- | --- | --- |
| Coût | gratuit (dépôt public) | gratuit |
| Mise en ligne | à chaque `git push` | glisser `dist/site` |
| Bande passante | 100 Go / mois | 100 Go / mois |
| En-têtes de sécurité (`_headers`) | non (la CSP de la page reste active) | oui |
| Adresse | `levraiowen.github.io/prisme-studio` | `nom.netlify.app` |

### Netlify Drop (1 minute, si besoin d'une autre adresse)

1. Ouvrir https://app.netlify.com/drop.
2. Glisser `dist/site`.

L'adresse est immédiate ; créer un compte gratuit pour la garder au-delà d'une heure.

### GitHub Pages (déploiement automatique, en place)

Le dépôt public `Levraiowen/prisme-studio` publie le site sur https://levraiowen.github.io/prisme-studio/. Pages sur un dépôt privé demanderait un abonnement payant.

À chaque `git push` sur `main`, `.github/workflows/pages.yml` teste le moteur, construit et publie `dist/site`. Réglage côté GitHub (déjà fait) : **Settings → Pages → Source → GitHub Actions**.

Suivre une publication : onglet **Actions** du dépôt, ou `gh run list`.

### Nom de domaine (facultatif)

Les deux services acceptent gratuitement un domaine personnel, par exemple `prisme.mondomaine.fr`. Le domaine lui-même coûte environ 10 € par an chez un registraire, et on le relie depuis le tableau de bord de l'hébergeur.

## 3. En entreprise : conteneur Docker

```bash
python build.py
docker build -f deploy/Dockerfile -t prisme-studio:4.1.0 .
docker run --rm -p 8080:8080 prisme-studio:4.1.0
```

Avec docker-compose : `docker compose -f deploy/docker-compose.yml up -d`.

- **Image** : `nginx-unprivileged`, sans droits root, port 8080, sonde `/health`, système de fichiers en lecture seule.
- **Politique de sécurité** : les en-têtes sont dans `deploy/security-headers.conf`, inclus dans chaque route de `deploy/nginx.conf`.
- **Données internes** : un dossier `deploy/data/`, monté en `/data` (lecture seule), met des jeux à disposition. Ils s'ouvrent par une URL : `https://prisme.intranet/?data=/data/ventes.csv`.
  - Un CSV de plus de 40 Mo s'ouvre automatiquement en mode grands volumes.
  - `&mode=big` force ce mode.
- **Données sur un autre serveur** : ce serveur doit autoriser l'origine de Prisme par l'en-tête `Access-Control-Allow-Origin`.
- **Réseau sans internet** : `python build.py --offline` télécharge une fois les bibliothèques, vérifie leur empreinte, puis produit une page qui n'a plus besoin d'internet. Le Dockerfile la sert automatiquement si elle existe.

## 4. Intégrer dans un portail

- Ajouter le domaine du portail à la directive `frame-ancestors` :
  - `dist/site/_headers` pour Netlify ;
  - `deploy/security-headers.conf` pour nginx.
- Piloter l'outil par `postMessage` : voir [INTEGRATION.md](INTEGRATION.md) et `examples/embed.html`.
- L'authentification reste celle du portail ou du proxy : Prisme ne gère pas de comptes.

## 5. Hors ligne et installation

Une fois déployé en HTTPS :
- **Installation** : le navigateur propose d'installer Prisme comme une application (icône dans la barre d'adresse sur Chrome et Edge, « Sur l'écran d'accueil » sur mobile).
- **Hors ligne** : après une première visite, l'application fonctionne sans connexion. Seuls le code et les bibliothèques sont mis en cache, jamais les données.

## 6. Prérequis côté visiteur

- **Navigateur** : Chrome, Edge, Firefox ou Safari récent, avec WebGL pour la 3D.
- **Mémoire** : 8 Go pour le Studio jusqu'à 250 000 lignes et pour le mode grands volumes jusqu'à environ 10 millions de lignes ; 16 Go au-delà. Voir [PERFORMANCES.md](PERFORMANCES.md).
