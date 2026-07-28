# Build from the REPO ROOT so the workspace lockfile is in context:
#   docker build -f apps/api/Dockerfile -t crm-api .

FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=apps/api --include-workspace-root

COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

# ---------------------------------------------------------------------------

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev \
  && npm cache clean --force

COPY --from=build /repo/apps/api/dist ./apps/api/dist

# Don't run as root.
USER node

EXPOSE 4000

# Env comes from `docker run --env-file apps/api/.env` or your orchestrator,
# so there is no --env-file flag here.
CMD ["node", "apps/api/dist/server.js"]
