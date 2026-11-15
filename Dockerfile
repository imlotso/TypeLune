FROM node:26-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ libatomic1 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SITE_OPERATOR=""
ARG VITE_SITE_CONTACT_EMAIL=""
ARG VITE_PRIVACY_VERSION=""
ARG VITE_PRIVACY_EFFECTIVE_DATE=""
ARG VITE_TERMS_VERSION=""
ARG VITE_TERMS_EFFECTIVE_DATE=""
RUN npm run build && npx esbuild scripts/postgres-database.ts --bundle --platform=node --format=esm --packages=external --outfile=build-operator/postgres-database.mjs && npm prune --omit=dev

FROM node:26-bookworm-slim
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/app/data/dazi.sqlite
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 && rm -rf /var/lib/apt/lists/* && mkdir -p /app/data && chown node:node /app/data
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts/backup.mjs /app/scripts/bootstrap-admin.mjs ./scripts/
COPY --from=build --chown=node:node /app/build-operator/postgres-database.mjs ./scripts/postgres-database.mjs
COPY --from=build --chown=node:node /app/server/postgres/support-settings.sql ./server/postgres/support-settings.sql
USER node
EXPOSE 3001
CMD ["node", "dist/server/app.js"]
