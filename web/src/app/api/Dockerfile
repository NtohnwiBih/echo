# Build from the repository root (compose does this):
#   docker build -f apps/api/Dockerfile --target runtime -t linguisticpro-api .
#
# Stages:
#   tools    full dev install + compiled app. Used for migrations, seeding and `prisma migrate dev`.
#   runtime  production dependencies and compiled output only.
FROM node:22-slim AS base
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS tools
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# Dependencies first so this layer is cached until a manifest changes.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @linguisticpro/api...
COPY apps/api apps/api
# Generates the Prisma client, then compiles to apps/api/dist.
RUN pnpm --filter @linguisticpro/api build

FROM tools AS prod-deps
RUN CI=true pnpm install --prod --frozen-lockfile --ignore-scripts --filter @linguisticpro/api...

FROM base AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /repo/apps/api
COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/package.json ./package.json
COPY --from=tools /repo/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]