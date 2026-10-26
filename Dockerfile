# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.34.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Lokalny dev: kod montowany z hosta w docker-compose.yml.
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# Migracje produkcyjne: `prisma migrate deploy` jako osobny krok przed startem web.
# Nigdy `db push` na produkcji.
FROM deps AS migrate
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["pnpm", "prisma", "migrate", "deploy"]

FROM deps AS builder
COPY . .
# Next importuje auth i inicjalizuje Prisma podczas zbierania danych tras.
# Build nie łączy się z bazą; techniczny URL dotyczy tylko tego polecenia,
# a uruchomiony kontener nadal wymaga własnego DATABASE_URL.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/detailflow_build \
    SKIP_ENV_VALIDATION=1 pnpm build

# Produkcja: web (domyślnie) albo worker (`node dist/worker.mjs`) z tego samego obrazu.
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
