# Multi-stage build: build the React client, then run the Express server.

FROM node:20-alpine AS client_build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev
COPY server/ ./

# Copy built client into the expected path the server uses: ../../client/dist
WORKDIR /app
COPY --from=client_build /app/client/dist ./client/dist

WORKDIR /app/server
ENV NODE_ENV=production
ENV SERVE_CLIENT=true
EXPOSE 3001

CMD ["node", "src/index.js"]
