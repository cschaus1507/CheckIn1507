# Multi-stage Dockerfile for the React frontend.
# Produces a small nginx image that serves the built client and supports React Router routes like /manage.

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

# Copy built static files
COPY --from=build /app/dist /usr/share/nginx/html

# Override default nginx config to support SPA routing (try_files fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
