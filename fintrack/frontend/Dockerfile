# ============================================================
# fintrack — Frontend Dockerfile (React + Vite)
# File: frontend/Dockerfile
# Version: 1.0 — 2026-03-26
#
# Multi-stage build:
#   Stage 1 (builder): installs deps and builds production bundle
#   Stage 2 (runner):  serves bundle with nginx
#
# For development: override CMD to run vite dev server instead
# ============================================================

# Stage 1 — Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 — Serve
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config — handles SPA routing (all paths → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
