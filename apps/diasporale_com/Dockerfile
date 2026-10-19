# syntax=docker/dockerfile:1
# Image AUTOPORTANTE de diasporale.com, application externe du moteur ANTSIA.
#
# Contexte de construction = le dossier ECOSYSTEMES (parent d'ANTSIA et de
# DIASPORALE), avec UNE installation : celle d'ANTSIA, dont le package.json
# déclare les espaces de travail ../DIASPORALE/apps/* et ../DIASPORALE/packages/*.
# Fichier d'exclusion : Dockerfile.dockerignore, à côté (liste blanche).
#
#   docker build -f DIASPORALE/apps/diasporale_com/Dockerfile \
#     --build-arg NEXT_PUBLIC_CONVEX_URL=… --build-arg NEXT_PUBLIC_SITE_URL=… \
#     -t diasporale_com .            # lancé depuis ECOSYSTEMES
#
# Les variables NEXT_PUBLIC_* sont inscrites dans le bundle à la construction :
# chacune est un ARG ci-dessous (cliquet deploy-catalog du moteur). Aucun secret
# en ARG. Aucune publication sans décision du propriétaire (hébergement à trancher).

# ── Étape 1 : dépendances et construction ─────────────────────────────────────
FROM oven/bun:1.4.2 AS builder
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BUILD_SHA
ARG NEXT_PUBLIC_DIASPORALE_DATA_SOURCE
ARG NEXT_PUBLIC_IDN_PORTAL_URL
ARG NEXT_PUBLIC_CONSULATE_URL
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_BUILD_SHA=${NEXT_PUBLIC_BUILD_SHA} \
    NEXT_PUBLIC_DIASPORALE_DATA_SOURCE=${NEXT_PUBLIC_DIASPORALE_DATA_SOURCE} \
    NEXT_PUBLIC_IDN_PORTAL_URL=${NEXT_PUBLIC_IDN_PORTAL_URL} \
    NEXT_PUBLIC_CONSULATE_URL=${NEXT_PUBLIC_CONSULATE_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096
WORKDIR /src

COPY ANTSIA ./ANTSIA
COPY DIASPORALE ./DIASPORALE
RUN cd ANTSIA && bun install --frozen-lockfile
RUN cd DIASPORALE/apps/diasporale_com && bun run build

# ── Étape 2 : image d'exécution minimale (sortie standalone de Next) ─────────
# Racine de traçage = ECOSYSTEMES : le serveur est sous DIASPORALE/apps/diasporale_com.
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=builder --chown=node:node /src/DIASPORALE/apps/diasporale_com/.next/standalone ./
COPY --from=builder --chown=node:node /src/DIASPORALE/apps/diasporale_com/.next/static ./DIASPORALE/apps/diasporale_com/.next/static

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- "http://127.0.0.1:8080/api/sante-fonctionnelle" >/dev/null 2>&1 || exit 1
CMD ["node", "DIASPORALE/apps/diasporale_com/server.js"]
