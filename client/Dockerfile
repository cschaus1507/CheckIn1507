# Client container for Adam-style 3-container setup (nginx serving Vite build)
FROM node:22-alpine AS build
WORKDIR /app
RUN npm config set registry https://registry.npmjs.org/
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
