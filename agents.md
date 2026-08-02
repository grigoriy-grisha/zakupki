# agents.md — AI Agent Instructions for Cursor

## Project Context

This is **zakupki** — a monorepo for a group-buying (совместные закупки) management system built with:

- **pnpm workspaces** monorepo (apps + shared packages)
- **Next.js 16** (App Router) + **React 19** + **tRPC 11** + **Tailwind 4** + **Radix UI** frontend
- **grammY** Telegram bot
- **PostgreSQL** + **Prisma 7.8** ORM
- **BullMQ** + **Redis** job queues
- **TypeScript 6** strict mode, ESM throughout

All user-facing text is in **Russian**.

---

## General Rules

### Language & Style

- Write all code comments, commit messages, and documentation in **English**
- All user-facing strings (bot replies, UI labels, error messages) must be in **Russian**
- Use **4 spaces** for indentation (not tabs, not 2 spaces)
- Use **single quotes** for strings
- Add **trailing commas** everywhere
- Max line width: **120 characters**
- Always add **semicolons** at end of statements

### TypeScript

- Enable and respect **strict mode** — no `any` unless absolutely necessary
- Always use `import type` for type-only imports (enforced by ESLint `consistent-type-imports`)
- Prefix unused parameters with `_` (e.g., `_event`, `_ctx`)
- Remove unused imports — ESLint enforces this as an error
- Imports are auto-sorted by `eslint-plugin-simple-import-sort` — external first, then `@zakupki/*`, then relative

### File Naming

- Files and directories: **kebab-case** (`order-collection.service.ts`, `use-product-form.ts`)
- React component files: **kebab-case** (`product-card.tsx`, `purchase-form.tsx`)
- Test files: `__tests__/*.test.ts`

---

## Architecture — Follow These Patterns

### Layered Architecture

Every feature follows the same three-layer pattern:

```
Router/Handler  →  Service  →  Repository  →  Prisma (dbClient)
  (validation)    (logic)     (queries)       (database)
```

**Never** skip layers. Routers/handlers never call repositories directly. Services never build HTTP responses.

### Repository Pattern

- Repositories are **classes** that wrap Prisma queries
- They import `dbClient` from `@zakupki/database` and alias it as `const db = dbClient`
- They contain **no business logic** — only data access
- Complex queries use Prisma `include`, `select`, and `$transaction`
- Location: `domain/repositories/` (bot) or `server/domain/` (frontend)

```typescript
// Example repository
import { dbClient } from '@zakupki/database';

const db = dbClient;

export class ExampleRepository {
    async findById(id: number) {
        return db.example.findUnique({
            where: { id },
            include: { relation: true },
        });
    }
}
```

### Service Pattern

- Services are **classes** with constructor-injected repositories
- They contain **all business logic** — validation, state transitions, calculations
- They throw custom errors from `@zakupki/types` (`NotFoundError`, `ValidationError`, `ForbiddenError`)
- Location: `services/` directory

```typescript
// Frontend service (DI via constructor)
export class ExampleService {
    constructor(private repo: ExampleRepository) {}

    async getById(id: number) {
        const item = await this.repo.getById(id);
        if (!item) throw new NotFoundError('Ресурс', id);
        return item;
    }
}

// Bot service (DI via private field)
export class ExampleService {
    private repo = new ExampleRepository();

    async doSomething(userId: number) {
        // business logic here
    }
}
```

### tRPC Router Pattern (Frontend)

- One router per domain entity in `server/routers/`
- Use `protectedProcedure` for authenticated users, `adminProcedure` for admin-only
- Validate inputs with **Zod** schemas
- Call `ctx.services.<service>` to access services via the `ServiceContainer`
- All routers are composed in `server/routers/_app.ts`

```typescript
import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from '../trpc';

export const examplesRouter = router({
    list: protectedProcedure
        .input(z.object({ search: z.string().optional() }).optional())
        .query(async ({ ctx, input }) => {
            return ctx.services.example.list(input?.search);
        }),

    create: adminProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ ctx, input }) => {
        return ctx.services.example.create(input);
    }),
});
```

### Bot Handler Pattern

- Handlers are async functions taking `CustomContext`
- Use middleware chains for auth guards: `bot.command('orders', auth, ordersCommand)`
- Create service instances per-request in handlers (bot services are stateless)

```typescript
import type { CustomContext } from '../domain/types';
import { ExampleService } from '../services/example.service';

export async function exampleCommand(ctx: CustomContext) {
    const userId = ctx.session.userId!;
    const service = new ExampleService();
    const result = await service.getData(userId);
    await ctx.reply(result);
}
```

### Service Container (Frontend)

- All frontend services are wired in `server/lib/service-container.ts`
- Singleton `serviceContainer` is accessed via `ctx.services` in tRPC procedures
- When adding a new service: create repo + service, add both to `ServiceContainer`

---

## Frontend Conventions

### Next.js App Router

- Use the App Router (`src/app/` directory)
- Route groups with parentheses: `(admin)`, `(auth)`
- Each route segment has its own `components/`, `hooks/`, `lib/` subdirectories
- `page.tsx` for route pages, `layout.tsx` for layouts
- API routes in `app/api/`

### React Components

- Use **function components** with explicit return types only when needed
- UI primitives in `components/ui/` follow **shadcn/ui** pattern
- Use `cn()` helper for conditional class names (clsx + tailwind-merge)
- Use `class-variance-authority` (cva) for component variants
- Icons in `components/icons/`

### Custom Hooks

- Hooks are thin wrappers around tRPC React Query hooks
- Name with `use` prefix: `useProductList`, `useCreateProduct`
- Group hooks per feature in `hooks/` directories with `index.ts` barrel exports
- Return raw tRPC hooks — don't add extra abstraction layers

```typescript
import { trpc } from '@/lib/client/trpc';

export function useProductList(search?: string) {
    return trpc.products.list.useQuery({ search: search || undefined });
}

export function useCreateProduct() {
    return trpc.products.create.useMutation();
}
```

### Forms

- Use `react-hook-form` with `@hookform/resolvers/zod`
- Define Zod schemas in `lib/schema.ts` per feature
- Form types are inferred from Zod: `z.infer<typeof schema>`

### State Management

- Server state: **tRPC + React Query** exclusively
- Client state: React `useState`/`useReducer` — no global state library
- No Redux, Zustand, or similar

### Styling

- **Tailwind CSS** utility classes only — no CSS modules, no styled-components
- Use CSS variables for theming (defined in `globals.css`)
- Responsive design with Tailwind breakpoints

---

## Database Conventions

### Prisma Schema

- Schema lives in `shared/database/prisma/schema.prisma`
- Enums in Prisma → mirrored as string union types in `@zakupki/types`
- Use `@id @default(autoincrement())` for integer IDs
- Use `@@index` for frequently queried fields
- Use `@@unique` for composite unique constraints
- Decimal fields: `@db.Decimal(10, 2)` for money, `@db.Decimal(10, 3)` for quantities
- Always add `createdAt` and `updatedAt` timestamps where appropriate

### Migrations

- Create with: `pnpm db:migrate` (runs `prisma migrate dev`)
- Migration names: descriptive snake_case
- After schema changes: `pnpm db:generate` to regenerate client
- Never edit migration files manually

### Query Patterns

- Always cast Prisma `Decimal` to `Number()` before arithmetic
- Use `$transaction(async (tx) => {...})` for multi-step operations
- Use `select` over `include` when you only need specific fields
- Use `as const` on shared include objects to preserve types

---

## Shared Packages

### @zakupki/database

- Exports `dbClient` (PrismaClient singleton), `Prisma` namespace, and all generated types
- Import pattern: `import { dbClient, Prisma, RoleKind } from '@zakupki/database'`
- Client uses `@prisma/adapter-pg` for PostgreSQL connection
- Singleton pattern via `globalThis` to survive HMR in dev

### @zakupki/types

- Shared TypeScript types, enums, and constants
- Custom error classes: `AppError`, `NotFoundError`, `ValidationError`, `ForbiddenError`, `BusinessRuleError`, `InsufficientStockError`, `PurchaseNotActiveError`, `InvalidPaymentTransitionError`
- Pricing logic: `calculateOrderAmount`, `getOrderQuantityValidationError`, `snapOrderQuantity`
- Status labels: `PURCHASE_STATUS_LABELS`, `PURCHASE_FULFILLMENT_LABELS`

### @zakupki/queue

- BullMQ queue infrastructure
- `BaseQueue` abstract class for all queues
- `getRedisConnection()` — Redis singleton with BullMQ-compatible settings
- Re-exports `BullMQ`, `UnrecoverableError`

### @zakupki/storage

- Storage configuration helpers
- `isS3Configured()`, `getLocalUploadDir()`, `resolveLocalFilePath()`, `getPublicUrlPrefix()`

### @zakupki/logger

- Pino logger factory: `createLogger('module-name')`
- Returns child logger with module scope

---

## Error Handling

### Frontend (tRPC)

1. Services throw `AppError` subclasses from `@zakupki/types`
2. `errorFormatter` in `trpc.ts` maps them to `TRPCError` with correct HTTP codes:
    - `NotFoundError` → `NOT_FOUND` (404)
    - `ValidationError` → `BAD_REQUEST` (400)
    - `ForbiddenError` → `FORBIDDEN` (403)
    - `BusinessRuleError` → `BAD_REQUEST` (400)
3. Use `handleDbConflict()` for Prisma P2002 unique constraint violations → `CONFLICT` (409)

### Bot

- Wrap service calls in try/catch
- Return user-friendly Russian error messages via `ctx.reply()`
- Use discriminated union result types for complex operations: `{ ok: true, ... } | { ok: false, reason, message }`

---

## Authentication

### Frontend

- **next-auth** with JWT strategy
- Three credential providers: `vk` (VK ID OAuth), `telegram` (Telegram Login Widget), `telegram-webapp` (Telegram Mini App initData)
- JWT stores: `id`, `avatar`, `role`
- RBAC: `buildRbac(role)` returns permission config based on ADMIN/CLIENT role
- Middleware (`src/middleware.ts`): route protection, platform prefix handling, role-based redirects

### Bot

- Session-based: `initMiddleware` creates/gets user from Telegram ID
- `requireAuth()` middleware checks `ctx.session.userId`
- Profile refresh every 5 minutes (`PROFILE_REFRESH_INTERVAL`)

---

## Testing

- **Vitest** with `globals: true`
- Test files go in `__tests__/` directories: `**/__tests__/**/*.test.ts`
- Shared business logic (pricing, validation) should have unit tests in `shared/types/__tests__/`
- Run: `pnpm test` (single run), `pnpm test:watch` (watch mode)

---

## Environment

- Copy `.env.example` to `.env`
- Docker Compose provides Postgres 17 and Redis 7
- Without S3 credentials, files are stored locally in `uploads/`
- Bot requires `BOT_TOKEN` from @BotFather
- Frontend needs `NEXTAUTH_SECRET` and optionally `NEXT_PUBLIC_VK_APP_ID`

---

## Common Tasks

### Adding a New Domain Entity

1. **Database**: Add model to `shared/database/prisma/schema.prisma`, run `pnpm db:migrate`, `pnpm db:generate`
2. **Types**: Add shared types/enums/errors to `shared/types/src/`
3. **Repository**: Create `server/domain/<entity>.repository.ts` — Prisma queries only
4. **Service**: Create `server/services/<entity>.service.ts` — business logic, constructor-injected repo
5. **Service Container**: Register repo + service in `server/lib/service-container.ts`
6. **Router**: Create `server/routers/<entity>.ts` — tRPC procedures with Zod validation, add to `_app.ts`
7. **Frontend hooks**: Create `hooks/use-<entity>.ts` — tRPC React Query wrappers
8. **UI**: Create `components/` with forms, tables, dialogs using shadcn/ui + Tailwind

### Adding a New Bot Command

1. **Handler**: Create `handlers/<command>.ts` — export async function taking `CustomContext`
2. **Export**: Add to `handlers/index.ts` barrel
3. **Register**: Add `bot.command('<command>', auth, handler)` in `create-bot.ts`
4. **Menu**: Add to `setMyCommands` array in `index.ts`

### Adding a New Queue Job

1. **Types**: Define job data type in `shared/queue/src/queues/<name>/<name>.types.ts`
2. **Queue**: Create queue class extending `BaseQueue` in `shared/queue/src/queues/<name>/<name>.queue.ts`
3. **Export**: Re-export from `shared/queue/src/main.ts`
4. **Worker**: Setup worker with handler in the consuming app (bot or frontend)
