# Prisme Studio : image statique minimale (nginx non privilégié, utilisateur sans droits root, port 8080).
#   python build.py                                   (construit dist/site/)
#   docker build -f deploy/Dockerfile -t prisme-studio:4.0.0 .
#   docker run --rm -p 8080:8080 prisme-studio:4.0.0      puis http://localhost:8080
FROM nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.title="Prisme Studio" \
      org.opencontainers.image.description="Visualisation et analyse multidimensionnelle dans le navigateur (ACP, ACM, AFC, HCPC, projections, grands volumes)" \
      org.opencontainers.image.version="4.0.0"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/prisme/security-headers.conf
COPY dist/ /tmp/dist/
USER root
# site complet (service worker, manifeste, icônes) ; la version hors ligne remplace la page si elle a été construite
RUN cp -r /tmp/dist/site/. /usr/share/nginx/html/ \
 && if [ -f /tmp/dist/Prisme-Studio-offline.html ]; then cp /tmp/dist/Prisme-Studio-offline.html /usr/share/nginx/html/index.html; fi \
 && rm -f /usr/share/nginx/html/_headers && mkdir -p /usr/share/nginx/html/data && rm -rf /tmp/dist && chown -R 101:101 /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
