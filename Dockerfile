# Syntax = docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for SQLite
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig*.json vite.config.ts ./
RUN npm ci

COPY index.html ./
COPY src/ ./src/

RUN npm run build

# --- Production Image ---
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV SPROUT_PORT=4120
ENV SPROUT_HOST=0.0.0.0
ENV SPROUT_DB_PATH=/app/data/sprout.db

RUN apk add --no-cache python3 make g++ su-exec

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create persistent data volume directory and copy entrypoint script
RUN mkdir -p /app/data && chown -R node:node /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4120

VOLUME ["/app/data"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server/server/index.js"]
