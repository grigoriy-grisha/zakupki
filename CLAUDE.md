# CLAUDE.md — Project Intelligence for Claude Code

## Project Overview

**zakupki** — monorepo for a group-buying (совместные закупки) management system. Telegram bot + web admin panel + customer shop.

## Tech Stack

- **Runtime**: Node.js 22.15.0, TypeScript 6, ESM (`"type": "module"`)
- **Package manager**: pnpm 10.28.1 workspaces
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, Radix UI, tRPC 11, React Query, Zod, next-auth (JWT)
- **Bot**: grammY (Telegram bot framework)
- **Database**: PostgreSQL 17 + Prisma 7.8 (with `@prisma/adapter-pg`)
- **Queue**: BullMQ + Redis 7 (ioredis)
- **Storage**: Yandex S3 (fallback: local filesystem in `uploads/`)
- **Logging**: pino
- **Testing**: Vitest
- **Linting**: ESLint 9 (flat config) + Prettier
- **Infrastructure**: Docker Compose (Postgres + Redis)

## Commands

```bash
# Dev
pnpm dev:web          # Next.js frontend on :5000
pnpm dev:bot          # Telegram bot (tsx watch)

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations (dev)
pnpm db:deploy        # Run migrations (prod)
pnpm db:studio        # Prisma Studio
pnpm db:seed          # Seed database
pnpm db:reset         # Reset database

# Quality
pnpm lint             # ESLint
pnpm lint:fix         # ESLint --fix
pnpm format           # Prettier write
pnpm format:check     # Prettier check
pnpm typecheck        # tsc --noEmit across all packages
pnpm test             # Vitest run
pnpm test:watch       # Vitest watch

# Admin
pnpm db:grant-admin   # Grant admin role via script
```

## Monorepo Structure

```
apps/
  bot/                    # Telegram bot (grammY)
  frontend/               # Next.js 16 web app
shared/
  database/               # Prisma schema + client singleton
  queue/                  # BullMQ queues (base class + implementations)
  storage/                # S3/local storage config helpers
  logger/                 # pino logger factory
  types/                  # Shared types, errors, pricing logic
```

All workspace packages use `@zakupki/` scope and are linked via `workspace:*`.

## Architecture Patterns

### Layered Architecture (both apps)

```
Handler/Router → Service → Repository → Database (Prisma)
```

- **Repositories** (`domain/repositories/` or `server/domain/`) — raw DB queries via Prisma, no business logic
- **Services** (`services/`) — business logic, validation, orchestration. Accept repository instances via constructor injection
- **Handlers** (bot) / **Routers** (frontend tRPC) — request/response layer, input validation, call services

### Frontend Server Layer (`apps/frontend/src/server/`)

- `server/trpc.ts` — tRPC context factory, auth resolution, procedure factories (`publicProcedure`, `protectedProcedure`, `adminProcedure`)
- `server/routers/` — tRPC routers, one per domain entity. Input validation with Zod schemas
- `server/services/` — business logic classes, constructor-injected repositories
- `server/domain/` — repository classes + domain helpers + type definitions
- `server/lib/service-container.ts` — singleton `ServiceContainer` that wires all repos and services

### Bot Layer (`apps/bot/src/`)

- `handlers/` — grammY command handlers and message handlers
- `services/` — business logic (UserService, OrderService, PaymentService, OrderCollectionService)
- `domain/repositories/` — Prisma queries
- `domain/types.ts` — CustomContext (grammY Context + SessionFlavor + db)
- `middlewares/` — init (auth + session), requireAuth guard
- `lib/` — utility functions (URL builders, Telegram helpers, parsing)
- `notifications/` — BullMQ queue workers for channel posts

### Auth & RBAC

- **Frontend**: next-auth with JWT strategy. Three providers: `vk`, `telegram`, `telegram-webapp`
- **Bot**: session-based auth via Telegram user ID → `ctx.session.userId`
- **RBAC**: Role-based access control via `rbac-config.ts` (ADMIN / CLIENT roles)
- **tRPC procedures**: `protectedProcedure` (any auth), `adminProcedure` (ADMIN role required)
- **Middleware** (`middleware.ts`): route-level access control, platform prefix handling (`/tg/`, `/vk/`)

### Platform Prefixes

Routes can be prefixed with `/tg/` or `/vk/` for Telegram/VK mini-app contexts. Middleware strips the prefix for routing and re-adds it for redirects.

## Code Conventions

### Formatting (Prettier)

- **tabWidth**: 4 spaces
- **singleQuote**: true
- **trailingComma**: all
- **printWidth**: 120
- **semi**: true

### TypeScript

- **Strict mode** enabled everywhere
- `moduleResolution: "bundler"`
- `target: ES2017`, `module: esnext`
- `noEmit: true` (build via tsx/Next.js, not tsc)
- `consistent-type-imports` enforced — always use `import type` for types
- Unused imports are errors (ESLint `unused-imports/no-unused-imports`)
- Unused vars: prefix with `_` to suppress (`argsIgnorePattern: '^_'`)

### Import Sorting

Enforced via `eslint-plugin-simple-import-sort`. Order:

1. External packages
2. Internal `@zakupki/*` packages
3. Relative imports

### Naming Conventions

- **Files**: kebab-case (`order-collection.service.ts`, `product-form.tsx`)
- **Directories**: kebab-case (`domain/repositories/`, `post-templates/`)
- **Classes**: PascalCase (`OrderService`, `PurchaseRepository`)
- **Functions**: camelCase (`getUserOrders`, `calculateOrderAmount`)
- **Constants**: SCREAMING_SNAKE_CASE (`PROFILE_REFRESH_INTERVAL`, `BOT_TOKEN`)
- **Types/Interfaces**: PascalCase (`CustomContext`, `ProductCreateData`)
- **React components**: PascalCase (`ProductCard`, `PurchaseForm`)
- **React hooks**: `use` prefix (`useProductList`, `usePaymentForm`)
- **Zod schemas**: camelCase with `Schema` suffix (`productCreateSchema`, `priceTierSchema`)
- **Barrel exports**: `index.ts` files re-export from directory

### React / Frontend

- **shadcn/ui pattern**: components in `components/ui/`, use `cn()` helper (`clsx` + `tailwind-merge`)
- **`class-variance-authority`** for component variants (buttons, badges)
- **Feature-based organization**: each page/route has its own `components/`, `hooks/`, `lib/` subdirectories
- **Hooks**: thin wrappers around tRPC queries/mutations, return raw tRPC hooks
- **Forms**: `react-hook-form` + `@hookform/resolvers` + Zod schemas
- **Notifications**: `sonner` toast library
- **Data fetching**: tRPC React Query hooks exclusively

### Prisma / Database

- Schema in `shared/database/prisma/schema.prisma`
- Client singleton in `shared/database/src/database.ts` (globalThis caching for dev HMR)
- Re-exports `@prisma/client` types: `import { dbClient, Prisma, RoleKind } from '@zakupki/database'`
- Transactions: `dbClient.$transaction(async (tx) => { ... })`
- Decimal fields: cast to `Number()` before use — Prisma returns Decimal objects
- Enums defined in Prisma schema, mirrored in `@zakupki/types` as string unions

### Error Handling

- **Custom error hierarchy** in `shared/types/src/errors.ts`:
    - `AppError` (base, has `code` + `message`)
    - `NotFoundError`, `ValidationError`, `ForbiddenError`
    - `BusinessRuleError` → `InsufficientStockError`, `PurchaseNotActiveError`, `InvalidPaymentTransitionError`
- **tRPC**: `errorFormatter` maps `AppError` → `TRPCError` with correct HTTP codes
- **Bot**: try/catch in services, user-friendly Russian error messages
- **DB conflicts**: `handleDbConflict()` utility converts Prisma P2002 → TRPCError CONFLICT

### Localization

- All user-facing messages in **Russian**
- Number formatting: `toLocaleString('ru-RU')`
- Date formatting: `toLocaleDateString('ru-RU')`

### Queue (BullMQ)

- Base class: `BaseQueue<DataType, ResultType, NameType>` in `shared/queue`
- Redis singleton via `getRedisConnection()` with `maxRetriesPerRequest: null` (required by BullMQ)
- Job types defined in separate `.types.ts` files

### Storage

- Interface `IStorage` with two implementations: `LocalFileStorage` and `YandexS3Storage`
- Factory function selects implementation based on env vars
- Object keys: `{prefix}/{timestamp}-{random}.{ext}`

## Environment Variables

See `.env.example`. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `BOT_TOKEN` — Telegram bot token
- `NEXTAUTH_SECRET` — JWT signing secret
- `YANDEX_*` — S3 storage credentials (optional, falls back to local)

## Testing

- Vitest with `globals: true`
- Test files in `__tests__/` directories: `**/__tests__/**/*.test.ts`
- Currently only `shared/types` has tests (pricing logic)

## Git Conventions

- Branch naming: descriptive (`authorization`, `feat/product-attributes`)
- Migration naming: `YYYYMMDDHHMMSS_description` (Prisma convention)
- No interactive git commands (no `git rebase -i`, `git add -i`)
