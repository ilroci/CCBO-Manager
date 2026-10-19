# syntax=docker/dockerfile:1

# Certificati CA extra (proxy aziendali). docker-compose sostituisce questo stage vuoto
# con ../docker/certs; con un `docker build` manuale: --build-context extra-certs=../docker/certs
FROM scratch AS extra-certs

FROM node:22-alpine AS base
COPY --from=extra-certs / /tmp/extra-certs/
RUN cat /tmp/extra-certs/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null; \
    rm -rf /tmp/extra-certs && apk add --no-cache openssl
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
RUN chown node:node /app
USER node

FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
# postinstall → prisma generate
RUN npm ci

# --- Sviluppo: hot reload con src/ montata da docker-compose -------------------
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run dev"]

# --- Produzione ----------------------------------------------------------------
FROM deps AS build
COPY --chown=node:node . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
# node_modules completi: il CLI prisma (devDependency) serve per `migrate deploy` all'avvio
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
