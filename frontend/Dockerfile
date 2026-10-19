# syntax=docker/dockerfile:1

# Certificati CA extra (proxy aziendali). docker-compose sostituisce questo stage vuoto
# con ../docker/certs; con un `docker build` manuale: --build-context extra-certs=../docker/certs
FROM scratch AS extra-certs

FROM node:22-alpine AS base
COPY --from=extra-certs / /tmp/extra-certs/
RUN cat /tmp/extra-certs/*.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null; \
    rm -rf /tmp/extra-certs
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app
RUN chown node:node /app
USER node

FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# --- Sviluppo: Vite con HMR, src/ montata da docker-compose ---------------------
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Produzione: build statica servita da nginx ---------------------------------
FROM deps AS build
# Vite incorpora l'URL nel bundle in fase di build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY --chown=node:node . .
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
