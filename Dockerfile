# Root Dockerfile (Render-compatible)
# - Builds the Vite/React client
# - Installs production deps for the Node/Express server
# - Serves the built SPA from the server so client-side routes like /manage work on refresh

# ---------- 1) Build the React client ----------
FROM node:20-bullseye-slim AS client-build
WORKDIR /app/client

# Force public registry + reduce noise.
# Also force devDependencies to install in this build stage (Vite lives in devDependencies).
# Some CI/CD environments set npm production flags that would otherwise omit dev deps.
ENV NODE_ENV=development \
    npm_config_registry=https://registry.npmjs.org/ \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_progress=false \
    npm_config_production=false

COPY client/package*.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY client/ ./
RUN npm run build


# ---------- 2) Install server deps (prod-only) ----------
FROM node:20-bullseye-slim AS server-deps
WORKDIR /app/server

ENV npm_config_registry=https://registry.npmjs.org/         npm_config_audit=false         npm_config_fund=false         npm_config_progress=false

COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund


# ---------- 3) Runtime ----------
FROM node:20-bullseye-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Render provides PORT; default for local runs
ENV PORT=10000
# Tell server to serve client build (server/src/index.js already supports this)
ENV SERVE_CLIENT=true

# Server code + deps
COPY server/ ./server/
COPY --from=server-deps /app/server/node_modules ./server/node_modules

# Built client -> server/public
RUN mkdir -p ./server/public
COPY --from=client-build /app/client/dist ./server/public

EXPOSE 10000

CMD ["node", "server/src/index.js"]
