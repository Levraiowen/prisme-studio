"""Construit Prisme Studio.

    python build.py             dist/site/                 site statique prêt à déployer (Cloudflare Pages, Netlify, GitHub Pages, nginx)
                                                           index.html, service worker (hors ligne), manifeste (installable), en-têtes de sécurité
                                dist/Prisme-Studio.html    l'application en un seul fichier (à ouvrir ou à partager tel quel)
                                dist/artifact.html         même application sans CSP (hébergeur qui impose la sienne)
    python build.py --offline   dist/Prisme-Studio-offline.html : bibliothèques intégrées, aucune connexion requise.
                                Au premier lancement, les bibliothèques sont téléchargées dans vendor/ et leur empreinte
                                SHA-384 est enregistrée dans vendor/lock.json ; les builds suivants vérifient ces empreintes.
"""
import base64, hashlib, json, pathlib, shutil, subprocess, sys, urllib.parse, urllib.request, datetime

VERSION = "4.0.0"
root = pathlib.Path(__file__).parent
dist = root / "dist"
CORE = ["engine.js", "datasets.js", "explore.js", "stats.js", "prep.js", "cluster.js", "embed.js", "scag.js", "insights.js", "big.js"]
UI = ["charts.js", "stage.js", "select.js", "studio.js", "hyper.js", "api.js", "big.js", "app.js"]   # app.js en dernier : il lance l'application
J = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/"
LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"] + [J + f for f in [
    "shaders/CopyShader.js", "shaders/LuminosityHighPassShader.js", "postprocessing/EffectComposer.js",
    "postprocessing/RenderPass.js", "postprocessing/ShaderPass.js", "postprocessing/UnrealBloomPass.js"]] + [
    "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"]
# bibliotheques chargees a la demande (integrees dans la version hors ligne). Parquet (module ES hyparquet) reste charge a la demande.
LAZY = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/umap-js@1.4.0/lib/umap-js.min.js"]
FONTS = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Unbounded:wght@400;500;600;700&display=swap"
CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net blob:; worker-src 'self' blob:; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; "
       "connect-src 'self' blob: data: https:; object-src 'none'; base-uri 'none'; form-action 'none'")
DESC = f"Prisme Studio {VERSION} : visualisation et analyse multidimensionnelle (ACP, ACM, AFC, classes, projections, grands volumes) dans le navigateur. Aucune donnée ne quitte le poste."
# icone : le prisme de la marque sur fond sombre
ICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#FF7A59"/>'
        '<stop offset=".34" stop-color="#FFC85C"/><stop offset=".67" stop-color="#4FD8E8"/><stop offset="1" stop-color="#A08BFF"/></linearGradient></defs>'
        '<rect width="64" height="64" rx="14" fill="#05070D"/><path d="M7 32h19" stroke="#E9EDF7" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>'
        '<path d="M31 11l16 35H15z" fill="none" stroke="#E9EDF7" stroke-width="3" stroke-linejoin="round"/>'
        '<path d="M36 28.5l21-8M37 32h20M36 35.5l21 8" stroke="url(#g)" stroke-width="3.2" stroke-linecap="round"/></svg>')

def read(p): return (root / p).read_text(encoding="utf-8")
core = "\n".join(read(f"src/core/{f}") for f in CORE).replace('"use strict";', "")
ui = "\n".join(read(f"src/ui/{f}") for f in UI).replace('"use strict";', "")
now = datetime.datetime.now(); stamp = now.date().isoformat()
# le noyau est aussi fourni sous forme de texte : il est recharge dans les Web Workers de calcul
js = f'"use strict";\nconst PRISME_VERSION = "{VERSION}", PRISME_BUILD = "{stamp}";\n{core}\nconst CORE_SRC = {json.dumps(core, ensure_ascii=False)};\n{ui}'
check = dist / ".bundle-check.js"; dist.mkdir(exist_ok=True); check.write_text(js, encoding="utf-8")
if shutil.which("node"):
    r = subprocess.run(["node", "--check", str(check)], capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit("Erreur de syntaxe JavaScript")
check.unlink()
css, shell = read("src/styles.css"), read("src/shell.html")

def page(scripts_html, csp=True, fonts=True, site=False):
    favicon = "data:image/svg+xml," + urllib.parse.quote(ICON)
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{f'<meta http-equiv="Content-Security-Policy" content="{CSP}">' if csp else ""}
<meta name="description" content="{DESC}">
<meta name="generator" content="Prisme Studio {VERSION} ({stamp})">
<meta name="theme-color" content="#05070D">
<meta property="og:type" content="website"><meta property="og:title" content="Prisme Studio"><meta property="og:description" content="{DESC}">
<title>Prisme Studio</title>
<link rel="icon" href="{favicon}">
{'<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-192.png">' if site else ""}
{f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="{FONTS}">' if fonts else ""}
<style>
{css}
</style>
</head>
<body>
{shell}
{scripts_html}<script>
{js}
</script>
</body>
</html>
"""
cdn = "".join(f'<script src="{u}"></script>\n' for u in LIBS)
outs = {"Prisme-Studio.html": page(cdn), "artifact.html": page(cdn, csp=False)}

if "--offline" in sys.argv:
    vendor = root / "vendor"; vendor.mkdir(exist_ok=True); lockf = vendor / "lock.json"; lock = json.loads(lockf.read_text()) if lockf.exists() else {}
    def fetch(url):
        f = vendor / url.split("/")[-1]
        if not f.exists():
            print("téléchargement", url); f.write_bytes(urllib.request.urlopen(url, timeout=60).read())
        data = f.read_bytes(); h = "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()
        if url in lock and lock[url] != h: sys.exit(f"Empreinte inattendue pour {url} : fichier altéré ?")
        lock[url] = h; return data.decode("utf-8")
    inline = "".join(f"<script>/* {u.split('/')[-1]} */\n{fetch(u)}\n</script>\n" for u in LIBS + LAZY)
    lockf.write_text(json.dumps(lock, indent=2))
    outs["Prisme-Studio-offline.html"] = page(inline, csp=False, fonts=False)

for name, html in outs.items():
    assert "�" not in html, "caractere de remplacement U+FFFD present"
    (dist / name).write_text(html, encoding="utf-8"); print(f"dist/{name} ({len(html.encode('utf-8')) / 1024:.0f} Ko)")

# ---------------------------------------------------------------- site statique pret a deployer
site = dist / "site"
if site.exists(): shutil.rmtree(site)
(site / "examples").mkdir(parents=True)
(site / "index.html").write_text(page(cdn, site=True), encoding="utf-8")
(site / "icon.svg").write_text(ICON, encoding="utf-8")
icons = [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}]
try:   # icones PNG pour l'installation (Chrome, Android, iOS) si Pillow est disponible
    from PIL import Image, ImageDraw
    for s in (192, 512):
        k = s / 64; im = Image.new("RGBA", (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(14 * k), fill="#05070D")
        d.line([(7 * k, 32 * k), (26 * k, 32 * k)], fill="#8E98B0", width=max(2, int(2.6 * k)))
        d.line([(31 * k, 11 * k), (47 * k, 46 * k), (15 * k, 46 * k), (31 * k, 11 * k)], fill="#E9EDF7", width=max(2, int(3 * k)), joint="curve")
        for (y0, y1), c in zip([(28.5, 20.5), (32, 32), (35.5, 43.5)], ["#FFC85C", "#4FD8E8", "#A08BFF"]):
            d.line([(36 * k, y0 * k), (57 * k, y1 * k)], fill=c, width=max(2, int(3.2 * k)))
        im.save(site / f"icon-{s}.png"); icons.append({"src": f"icon-{s}.png", "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any"})
except ImportError:
    print("(Pillow absent : icônes PNG non générées, l'icône SVG suffit pour la plupart des navigateurs)")
(site / "manifest.webmanifest").write_text(json.dumps({"name": "Prisme Studio", "short_name": "Prisme", "description": DESC, "lang": "fr", "start_url": "./", "scope": "./",
    "display": "standalone", "background_color": "#05070D", "theme_color": "#05070D", "icons": icons}, ensure_ascii=False, indent=1), encoding="utf-8")
# service worker : code et bibliotheques en cache pour l'usage hors ligne ; les donnees ne sont jamais mises en cache
(site / "sw.js").write_text(f"""// Prisme Studio {VERSION} ({now:%Y-%m-%d %H:%M}) : mise en cache du code et des bibliothèques pour l'usage hors ligne.
// Les fichiers de données (CSV, Excel, Parquet, URL) ne sont jamais mis en cache.
const V = "prisme-{VERSION}-{now:%Y%m%d%H%M%S}", SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"], CDN = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {{
  const r = e.request; if (r.method !== "GET") return; const u = new URL(r.url);
  const shell = u.origin === location.origin && (r.mode === "navigate" || /\\/(index\\.html|manifest\\.webmanifest|icon[^/]*)?$/.test(u.pathname));
  if (shell) e.respondWith(fetch(r).then(res => {{ if (res.ok) {{ const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); }} return res; }}).catch(() => caches.match(r).then(m => m || caches.match("./index.html"))));   // reseau d'abord : toujours la derniere version
  else if (CDN.includes(u.hostname)) e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {{ const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); return res; }})));   // versions figees dans l'URL : cache d'abord
}});
""", encoding="utf-8")
# en-tetes HTTP (Cloudflare Pages et Netlify lisent ce fichier ; GitHub Pages l'ignore, la CSP de la page s'applique alors seule)
(site / "_headers").write_text(f"""/*
  Content-Security-Policy: {CSP}; frame-ancestors 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
""", encoding="utf-8")
(site / "robots.txt").write_text("User-agent: *\nAllow: /\n", encoding="utf-8")
(site / "examples" / "embed.html").write_text(read("examples/embed.html").replace("../dist/Prisme-Studio.html", "../index.html"), encoding="utf-8")
size = sum(f.stat().st_size for f in site.rglob("*") if f.is_file())
print(f"dist/site/ ({len(list(site.rglob('*.*')))} fichiers, {size / 1024:.0f} Ko) : prêt à déployer")
