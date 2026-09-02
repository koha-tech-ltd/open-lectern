# syntax=docker/dockerfile:1.4
# Lectern — static Vite SPA served by nginx
#
# Build from repo root:
#   docker build -t lectern .

FROM node:22.14.0-bookworm-slim AS vite-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
ARG VITE_SITE_URL=https://lectern.click
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

FROM nginx:1.26-alpine AS runtime
RUN apk add --no-cache curl
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=vite-builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
