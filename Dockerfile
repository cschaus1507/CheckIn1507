# Render-compatible root Dockerfile
# Builds client with Vite, then runs the Node/Express API server and serves the built SPA.

FROM node:22-alpine AS client-build
WORKDIR /app/client

# Use public npm registry
RUN npm config set registry https://registry.npmjs.org/

COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app/server
RUN npm config set registry https://registry.npmjs.org/
COPY server/package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000
ENV SERVE_CLIENT=true

# Server code + deps
COPY server/ ./server/
COPY --from=server-deps /app/server/node_modules ./server/node_modules

# Built client -> server/public
RUN mkdir -p ./server/public
COPY --from=client-build /app/client/dist ./server/public

EXPOSE 10000

CMD ["node", "server/src/index.js"]
