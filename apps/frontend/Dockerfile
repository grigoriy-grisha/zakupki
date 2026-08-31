# Multi-stage build for the Next.js frontend (+ embedded Telegram bot).
# Build context MUST be the repo root (needed for shared/* workspace packages
# and next.config.ts outputFileTracingRoot pointing at ../../).
# Compatible with the default Dockerfile frontend (no syntax directive needed).

FROM node:22.15.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
RUN apk add --no-cache libc6-compat

# 1. Builder phase
FROM base AS builder
WORKDIR /app

# NEXT_PUBLIC_* are inlined into the bundle at build time, so pass them as ARGs.
ARG NEXT_PUBLIC_VK_APP_ID
ENV NEXT_PUBLIC_VK_APP_ID=$NEXT_PUBLIC_VK_APP_ID

ARG NEXT_PUBLIC_VK_REDIRECT_URL
ENV NEXT_PUBLIC_VK_REDIRECT_URL=$NEXT_PUBLIC_VK_REDIRECT_URL

ARG NEXT_PUBLIC_TELEGRAM_BOT_ID
ENV NEXT_PUBLIC_TELEGRAM_BOT_ID=$NEXT_PUBLIC_TELEGRAM_BOT_ID

ARG NEXT_PUBLIC_BOT_USERNAME
ENV NEXT_PUBLIC_BOT_USERNAME=$NEXT_PUBLIC_BOT_USERNAME

# Copy only the manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY shared/database/package.json ./shared/database/
COPY shared/types/package.json ./shared/types/
COPY shared/logger/package.json ./shared/logger/
COPY shared/storage/package.json ./shared/storage/
COPY shared/queue/package.json ./shared/queue/
# prisma config + schema are needed by the @zakupki/database postinstall
# (prisma generate) that runs during `pnpm install`.
COPY shared/database/prisma ./shared/database/prisma

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

# Raise the V8 heap ceiling so `next build` doesn't SIGABRT on JS heap OOM
# (OS swap handles the spill to disk).
ENV NODE_OPTIONS=--max-old-space-size=3072

# Shared packages are consumed as TS source (tsconfig paths + transpilePackages),
# so they don't need a separate build — only the Prisma client must be generated
# (postinstall runs it, but we repeat it explicitly for reliability).
RUN pnpm --filter @zakupki/database prisma:generate

RUN pnpm --filter @zakupki/frontend build

# 2. Runner phase
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone output keeps the traced node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
