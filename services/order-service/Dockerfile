# ---- Stage 1: build (installe toutes les dependances, y compris devDependencies) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src

# ---- Stage 2: production (uniquement les dependances de prod + le code necessaire) ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=build /app/src ./src

ENV OTEL_SERVICE_NAME=order-service
ENV NODE_OPTIONS="--import ./src/tracing.js"

USER node
EXPOSE 3002
CMD ["node", "src/app.js"]
