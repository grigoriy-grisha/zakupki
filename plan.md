# План для Claude Code — Закупки
## Next.js 14 · tRPC · Prisma · shadcn/ui · Grammy

---

## Как работать с этим планом

Каждый шаг — отдельная сессия Claude Code.
Перед каждой сессией говори: `"Читай @zakupki-claude-code-plan.md, выполни шаг N"`

После каждого шага: `pnpm typecheck && pnpm lint`
После шагов с Prisma: `pnpm db:migrate`

---

## Шаг 1 — Monorepo scaffold

**Prompt для Claude Code:**
```
Создай Turborepo monorepo с pnpm workspaces.

Структура:
apps/web/          — Next.js 14 App Router, TypeScript strict
apps/bot/          — Grammy бот, TypeScript
packages/db/       — Prisma 5 + PostgreSQL клиент
packages/types/    — общие TypeScript типы
packages/telegram/ — утилиты для Telegram Bot API

Конфиги:
- turbo.json с pipeline: build, dev, typecheck, lint
- корневой package.json с workspaces
- tsconfig.base.json расширяют все пакеты
- .env.example со всеми нужными переменными
- .gitignore включая .env, node_modules, .next, dist

.env.example должен содержать:
DATABASE_URL=
BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
ADMIN_TELEGRAM_IDS=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
NEXTAUTH_SECRET=
NEXT_PUBLIC_BOT_USERNAME=
WEBHOOK_SECRET=

Проверь: pnpm install проходит без ошибок.
```

---

## Шаг 2 — Prisma schema

**Prompt:**
```
В packages/db/ создай Prisma schema и настрой клиент.

Schema (точная, не отклоняйся):

model User {
  id          Int         @id @default(autoincrement())
  telegramId  BigInt      @unique
  username    String?
  firstName   String
  lastName    String?
  phone       String?
  createdAt   DateTime    @default(now())
  orderLines  OrderLine[]
  payments    Payment[]
}

model Product {
  id            Int            @id @default(autoincrement())
  name          String
  description   String?
  photos        String[]
  unit          Unit
  pricePerUnit  Decimal        @db.Decimal(10, 2)
  brand         String?
  sku           String?        @unique
  createdAt     DateTime       @default(now())
  purchaseItems PurchaseItem[]
}

enum Unit { GRAM PIECE }

model Purchase {
  id          Int              @id @default(autoincrement())
  tag         String           @unique
  title       String
  status      PurchaseStatus   @default(DRAFT)
  minAmount   Decimal          @db.Decimal(10, 2)
  deadline    DateTime
  createdAt   DateTime         @default(now())
  items       PurchaseItem[]
  payments    Payment[]
}

enum PurchaseStatus { DRAFT ACTIVE CLOSED ARRIVED DONE }

model PurchaseItem {
  id             Int          @id @default(autoincrement())
  purchaseId     Int
  productId      Int
  priceOverride  Decimal?     @db.Decimal(10, 2)
  minQty         Decimal?
  tgMessageId    BigInt?
  tgChannelId    BigInt?
  isActive       Boolean      @default(true)
  purchase       Purchase     @relation(fields: [purchaseId], references: [id])
  product        Product      @relation(fields: [productId], references: [id])
  orderLines     OrderLine[]
  @@unique([purchaseId, productId])
}

model OrderLine {
  id              Int          @id @default(autoincrement())
  purchaseItemId  Int
  userId          Int
  quantity        Decimal      @db.Decimal(10, 3)
  amountDue       Decimal      @db.Decimal(10, 2)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  purchaseItem    PurchaseItem @relation(fields: [purchaseItemId], references: [id])
  user            User         @relation(fields: [userId], references: [id])
  @@unique([purchaseItemId, userId])
}

model Payment {
  id          Int       @id @default(autoincrement())
  userId      Int
  purchaseId  Int
  amount      Decimal   @db.Decimal(10, 2)
  paidAt      DateTime  @default(now())
  note        String?
  user        User      @relation(fields: [userId], references: [id])
  purchase    Purchase  @relation(fields: [purchaseId], references: [id])
}

Дополнительно:
- packages/db/src/index.ts — экспортирует prisma singleton и все типы из @prisma/client
- packages/db/src/seed.ts — 3 продукта (MIYUKI 11/0 Black 50г, TOHO 8/0 Silver 30г, Фурнитура застёжка 10шт), 1 закупка #СЗ7 ACTIVE, 5 пользователей, заказы

Запусти: pnpm db:migrate && pnpm db:seed
Проверь: pnpm typecheck в packages/db
```

---

## Шаг 3 — tRPC setup в Next.js

**Prompt:**
```
В apps/web/ настрой tRPC v11 с Next.js App Router.

Установи: @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod superjson

Создай:
1. apps/web/src/server/trpc.ts
   - initTRPC с context (prisma, adminId из headers)
   - publicProcedure
   - adminProcedure (middleware: проверяет X-Telegram-Id в ADMIN_TELEGRAM_IDS из env)
   - telegramProcedure (middleware: проверяет Telegram WebApp initData подпись)

2. apps/web/src/server/routers/_app.ts
   - appRouter объединяет: productsRouter, purchasesRouter, ordersRouter, paymentsRouter, usersRouter
   - экспортирует AppRouter тип

3. apps/web/src/server/routers/products.ts
   - getAll: z.object({ search?: string, brand?: string }) → Product[]
   - getById: z.object({ id: z.number() }) → Product
   - create: adminProcedure, z.object({ name, description?, unit, pricePerUnit, brand?, sku?, photos? })
   - update: adminProcedure, z.object({ id, ...partial })
   - delete: adminProcedure, z.object({ id })

4. apps/web/src/server/routers/purchases.ts
   - getAll: z.object({ status?: PurchaseStatus }) → Purchase[]
   - getById: z.object({ id }) → Purchase + items + orderLines stats
   - create: adminProcedure, z.object({ tag, title, minAmount, deadline })
   - updateStatus: adminProcedure, z.object({ id, status })
   - addItems: adminProcedure, z.object({ purchaseId, productIds: z.number().array() })
   - removeItem: adminProcedure, z.object({ purchaseItemId })
   - publishToChannel: adminProcedure, z.object({ purchaseId }) — публикует все items в TG канал

5. apps/web/src/server/routers/orders.ts
   - upsertOrder: telegramProcedure, z.object({ purchaseItemId, quantity }) — создаёт или обновляет заказ
   - getMyOrders: telegramProcedure → OrderLine[] с include product, purchase
   - getAllByPurchase: adminProcedure, z.object({ purchaseId }) → матрица

6. apps/web/src/server/routers/payments.ts
   - addPayment: adminProcedure, z.object({ userId, purchaseId, amount, note? })
   - getByPurchase: adminProcedure, z.object({ purchaseId }) → Payment[] с балансом

7. apps/web/src/server/routers/users.ts
   - getAll: adminProcedure → User[] с суммой долга
   - upsertFromTelegram: publicProcedure, z.object({ telegramId, username?, firstName, lastName? })

8. apps/web/src/app/api/trpc/[trpc]/route.ts — fetchRequestHandler

9. apps/web/src/trpc/client.ts — createTRPCReact<AppRouter>()
10. apps/web/src/trpc/server.ts — createCaller для Server Components
11. apps/web/src/app/providers.tsx — TRPCProvider + QueryClientProvider

Проверь: pnpm typecheck
```

---

## Шаг 4 — shadcn/ui + Layout

**Prompt:**
```
В apps/web/ настрой shadcn/ui и создай layout для админки.

1. Инициализируй shadcn: npx shadcn@latest init
   - style: default
   - base color: neutral
   - CSS variables: yes

2. Установи компоненты:
   npx shadcn@latest add button input label card table badge
   npx shadcn@latest add dialog sheet select textarea
   npx shadcn@latest add sidebar navigation-menu dropdown-menu
   npx shadcn@latest add toast sonner form
   npx shadcn@latest add data-table (или сделай вручную с @tanstack/react-table)

3. Создай apps/web/src/app/(admin)/layout.tsx:
   - Sidebar с навигацией: Dashboard, Закупки, Каталог товаров, Участники
   - Sidebar использует shadcn Sidebar компонент
   - Header с названием текущей страницы
   - Проверка adminId: если нет в ADMIN_TELEGRAM_IDS — редирект на /auth
   - Адаптивный: на мобиле sidebar сворачивается

4. Создай apps/web/src/app/(admin)/page.tsx — Dashboard:
   - 4 карточки (Card): Активных закупок, Участников всего, Товаров в каталоге, Ожидают оплаты
   - Данные через trpc.server (Server Component)
   - Таблица последних 5 заказов

5. Создай apps/web/src/app/auth/page.tsx:
   - Форма ввода Telegram ID для разработки (в prod заменить на Telegram Login Widget)

Проверь: pnpm build
```

---

## Шаг 5 — Страницы каталога товаров

**Prompt:**
```
Создай страницы управления товарами в apps/web/src/app/(admin)/products/

1. page.tsx — список товаров:
   - Server Component, данные через trpc.server.products.getAll
   - DataTable с колонками: фото (аватар), название, бренд, цена/ед, единица, SKU, действия
   - Поиск по названию (client-side фильтр через useQuery)
   - Кнопка "Добавить товар" → открывает Sheet с формой
   - Badge для Unit: GRAM="г" PIECE="шт"

2. components/ProductSheet.tsx — Sheet (боковая панель) для создания/редактирования:
   - react-hook-form + zod валидация
   - Поля: название, описание (Textarea), бренд, SKU, цена, единица (Select), фото
   - Загрузка фото: input type=file, preview, POST /api/upload → S3 URL
   - onSubmit: trpc.products.create.mutate или trpc.products.update.mutate
   - После успеха: toast "Товар сохранён", закрыть Sheet, invalidate query

3. apps/web/src/app/api/upload/route.ts:
   - POST: принимает FormData с файлом
   - Загружает в S3 через @aws-sdk/client-s3
   - Возвращает { url: string }
   - Проверяет: только image/*, максимум 5MB

Проверь: создай товар через UI, проверь что появляется в таблице
```

---

## Шаг 6 — Страницы закупок

**Prompt:**
```
Создай страницы управления закупками в apps/web/src/app/(admin)/purchases/

1. page.tsx — список закупок:
   - Tabs: Все / Черновики / Активные / Завершённые
   - Карточки (Card grid) для каждой закупки:
     - Тег (#СЗ7), название, статус (Badge с цветом), дедлайн, прогресс до min_amount
     - Progress bar: собрано / минимальная сумма
     - Ссылка на детальную страницу

2. new/page.tsx — создать закупку:
   - Форма: тег, название, минимальная сумма выкупа, дата дедлайна (DatePicker)
   - После создания: redirect на /purchases/[id]

3. [id]/page.tsx — детали закупки:
   - Заголовок: тег + статус + кнопки управления статусом
   - Tabs: "Товары", "Заказы", "Оплаты"

4. [id]/components/ItemsTab.tsx:
   - Список товаров в этой закупке (PurchaseItem[])
   - Каждый товар: фото, название, цена в закупке, кнопка удалить
   - Кнопка "Добавить товары" → Dialog с ProductPicker
   - После добавления: кнопка "Опубликовать в канал" (вызывает publishToChannel)

5. [id]/components/ProductPicker.tsx:
   - Dialog с поиском по каталогу
   - Checkbox для каждого товара
   - Кнопка "Добавить выбранные (N)" → trpc.purchases.addItems.mutate

6. [id]/components/OrdersTab.tsx:
   - Матрица: строки = товары, столбцы = участники
   - Ячейки: количество (г/шт) или "-"
   - Итого по строке (всего собрано), итого по столбцу (сумма участника)
   - Экспорт в Excel кнопка (используй xlsx пакет)

7. [id]/components/PaymentsTab.tsx:
   - Таблица: участник, должен, оплатил, остаток
   - Кнопка "Внести оплату" → Dialog с суммой и комментарием
   - Строки с остатком > 0 подсвечены (bg-destructive/10)

Проверь: создай закупку, добавь товары, проверь матрицу заказов
```

---

## Шаг 7 — Grammy бот

**Prompt:**
```
Создай Telegram бота в apps/bot/

Установи: grammy @grammyjs/conversations @grammyjs/session @grammyjs/auto-retry

1. src/bot.ts — инициализация:
   - Bot с BOT_TOKEN из env
   - session middleware (in-memory для dev, Redis в prod)
   - conversations plugin
   - auto-retry plugin
   - Логирование каждого update (упрощённое)

2. src/index.ts:
   - В dev режиме: bot.start() (long polling)
   - В prod режиме: webhookCallback для Express/Next.js
   - Graceful shutdown на SIGINT/SIGTERM

3. src/commands/start.ts:
   - /start — upsert пользователя через fetch к tRPC endpoint
   - Приветствие с именем пользователя
   - Inline keyboard: "📦 Мои заказы", "🛍 Активные закупки"

4. src/commands/my_orders.ts:
   - /my_orders — список заказов пользователя
   - Группировка по закупке
   - Для каждой закупки: название, итого к оплате, статус
   - Кнопка "Детали" для каждой закупки

5. src/commands/purchases.ts:
   - /purchases — список активных закупок
   - Для каждой: тег, название, дедлайн через N дней
   - Кнопка "Участвовать" для каждой

6. src/conversations/addOrder.ts:
   - Conversation запускается из callback join_{purchaseItemId}
   - Шаг 1: показывает товар (название, цена, единица)
   - Шаг 2: "Сколько хотите? Введите количество в граммах:"
   - Ждёт число, валидирует (> 0, разумный максимум)
   - Шаг 3: подтверждение "Вы заказываете 50г × 120 руб = 6000 руб. Подтвердить?"
   - Inline: "✅ Да" / "❌ Отмена"
   - При подтверждении: сохраняет через API, обновляет пост в канале
   - Итог: "✅ Заказ добавлен! Итого по закупке: X руб"

7. src/callbacks/joinPurchase.ts:
   - Обрабатывает callback_data: join_{purchaseItemId}
   - Проверяет что закупка ACTIVE
   - Запускает conversation addOrder
   
8. src/callbacks/myOrder.ts:
   - Обрабатывает callback_data: myorder_{purchaseItemId}
   - Показывает текущий заказ пользователя по этому товару
   - Кнопки: "Изменить количество", "Удалить заказ"

9. src/services/postService.ts:
   - buildPostText(data): string — форматирует текст поста
   - buildKeyboard(purchaseItemId): InlineKeyboard
   - publishPost(purchaseItemId): публикует в канал, сохраняет tgMessageId
   - updatePost(purchaseItemId): редактирует существующий пост
   - Вызывается после каждого нового/изменённого заказа

Формат поста в канале:
📦 *MIYUKI 11/0 Black*
Закупка: #СЗ7 · до 15 июня

💰 120 руб/г
👥 8 участников · 📊 Собрано: 340г

[🛒 Участвовать] [📋 Мой заказ]

Проверь: /start работает, создай тестовый заказ через conversation
```

---

## Шаг 8 — Telegram Mini App (витрина)

**Prompt:**
```
Создай Telegram Mini App в apps/web/src/app/(miniapp)/

1. layout.tsx:
   - Подключает @twa-dev/sdk (npm install @twa-dev/sdk)
   - Client component: инициализирует WebApp.ready()
   - Получает initData из window.Telegram.WebApp.initData
   - Передаёт telegramId через контекст
   - Стили: учитывает SafeArea, тему Telegram (--tg-theme-bg-color и т.д.)

2. page.tsx — список активных закупок:
   - Карточки закупок с прогресс-баром
   - Тап на карточку → /purchase/[id]

3. purchase/[id]/page.tsx — товары закупки:
   - Список товаров с фото (carousel если несколько фото)
   - Каждый товар: название, цена, мой заказ (если есть)
   - Кнопка "+" → открывает QuantitySheet

4. purchase/[id]/components/QuantitySheet.tsx:
   - Sheet снизу (bottom sheet)
   - Числовой input с кнопками +/- (шаг 5г или 1шт)
   - Итого = количество × цена
   - Кнопка "Добавить в заказ" → trpc.orders.upsertOrder
   - После: обновляет пост в канале через бота

5. purchase/[id]/cart/page.tsx — мой заказ:
   - Список всех позиций в этой закупке
   - Итого к оплате
   - Кнопка изменить/удалить каждую позицию
   - Telegram.WebApp.MainButton: "Подтвердить заказ"

Проверь: открой Mini App через бота, добавь товар
```

---

## Шаг 9 — Webhook + интеграция бота с Next.js

**Prompt:**
```
Подключи Grammy бота к Next.js через webhook.

1. apps/web/src/app/api/bot/route.ts:
   - POST handler
   - Проверяет заголовок X-Telegram-Bot-Api-Secret-Token === WEBHOOK_SECRET из env
   - Если не совпадает: return 401
   - Передаёт update в bot.handleUpdate(update)
   - Возвращает 200 OK

2. apps/bot/src/webhook.ts:
   - Экспортирует handleUpdate функцию (для переиспользования в Next.js route)
   - Бот инициализируется один раз (singleton)

3. apps/web/src/app/api/set-webhook/route.ts (только для dev/setup):
   - GET: вызывает bot.api.setWebhook(url) с текущим NEXTAUTH_URL + /api/bot
   - Защищён WEBHOOK_SECRET в query params

4. В apps/bot/src/index.ts:
   - if (process.env.USE_POLLING === 'true') bot.start()
   - else: экспортирует только handleUpdate (webhook mode)

5. Обнови apps/web/src/server/routers/purchases.ts:
   publishToChannel procedure:
   - Берёт все PurchaseItem для данной закупки
   - Для каждого item: вызывает postService.publishPost или updatePost
   - Сохраняет tgMessageId в БД
   - Возвращает { published: number }

Проверь: отправь тестовый update через curl, убедись что бот отвечает
```

---

## Шаг 10 — Финальная полировка

**Prompt:**
```
Финальные задачи перед деплоем.

1. Экспорт в Excel (apps/web/src/app/(admin)/purchases/[id]/components/OrdersTab.tsx):
   - Кнопка "Экспорт XLSX"
   - Использует пакет xlsx
   - Формат как в оригинальном файле заказчицы:
     * Строки = товары, столбцы = участники
     * Первая колонка: название товара
     * Последняя колонка: итого собрано
     * Последняя строка: итого по участнику
   - Скачивается как zakupka_СЗ7_2025.xlsx

2. Уведомления участникам:
   - В PaymentsTab: кнопка "Уведомить всех должников"
   - adminProcedure: notifyDebtors(purchaseId)
   - Бот шлёт каждому должнику: "💰 Напоминание по закупке #СЗ7: к оплате X руб"

3. Error handling:
   - Глобальный error boundary в (admin)/layout.tsx
   - Toast уведомления для всех мутаций (onError → sonner toast)
   - В боте: try/catch вокруг всех API calls, человекочитаемые сообщения об ошибках

4. Loading states:
   - Skeleton компоненты для таблиц (shadcn Skeleton)
   - Disabled кнопки во время мутаций (isPending из useMutation)

5. Переменные окружения — финальная проверка:
   - Создай apps/web/src/env.ts с zod валидацией всех env переменных
   - Импортируй в каждом файле где используются env

6. Docker Compose для локальной разработки:
   - PostgreSQL 16
   - (опционально) Redis для Grammy sessions
   - Добавь в README инструкции по запуску

Финальная проверка:
- pnpm build — 0 ошибок
- pnpm typecheck — 0 ошибок  
- Создай закупку → добавь товары → опубликуй пост → участник нажимает кнопку в канале → заказ создаётся → пост обновляется → матрица в админке обновилась
```

---

## Структура файлов (итог)

```
zakupki/
├── CLAUDE.md                          ← Claude Code читает это
├── turbo.json
├── package.json
├── .env.example
│
├── packages/
│   ├── db/
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   └── src/index.ts               ← экспорт prisma + типов
│   ├── types/
│   │   └── src/index.ts               ← PurchaseWithItems и др.
│   └── telegram/
│       └── src/postService.ts         ← shared между bot и web
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (admin)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx       ← Dashboard
│   │   │   │   │   ├── products/
│   │   │   │   │   └── purchases/
│   │   │   │   ├── (miniapp)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── purchase/[id]/
│   │   │   │   ├── api/
│   │   │   │   │   ├── trpc/[trpc]/route.ts
│   │   │   │   │   ├── bot/route.ts
│   │   │   │   │   └── upload/route.ts
│   │   │   │   └── auth/page.tsx
│   │   │   ├── server/
│   │   │   │   ├── trpc.ts
│   │   │   │   └── routers/
│   │   │   │       ├── _app.ts
│   │   │   │       ├── products.ts
│   │   │   │       ├── purchases.ts
│   │   │   │       ├── orders.ts
│   │   │   │       ├── payments.ts
│   │   │   │       └── users.ts
│   │   │   ├── trpc/
│   │   │   │   ├── client.ts
│   │   │   │   └── server.ts
│   │   │   ├── components/
│   │   │   │   └── ui/               ← shadcn компоненты
│   │   │   └── env.ts
│   │   └── package.json
│   │
│   └── bot/
│       ├── src/
│       │   ├── index.ts
│       │   ├── bot.ts
│       │   ├── commands/
│       │   │   ├── start.ts
│       │   │   ├── my_orders.ts
│       │   │   └── purchases.ts
│       │   ├── conversations/
│       │   │   └── addOrder.ts
│       │   ├── callbacks/
│       │   │   ├── joinPurchase.ts
│       │   │   └── myOrder.ts
│       │   └── services/
│       │       └── postService.ts
│       └── package.json
```

---

## CLAUDE.md для проекта

Положи в корень репозитория:

```markdown
# CLAUDE.md

## Проект
Система совместных закупок бисера.
Web: Next.js 14 App Router + tRPC + shadcn/ui
Bot: Grammy v1 + conversations
DB: Prisma 5 + PostgreSQL
Monorepo: Turborepo + pnpm

## Команды
pnpm install        — зависимости
pnpm dev            — все сервисы
pnpm db:migrate     — после изменений schema
pnpm db:seed        — тестовые данные
pnpm db:studio      — Prisma Studio
pnpm typecheck      — ОБЯЗАТЕЛЬНО после изменений
pnpm build          — проверка перед коммитом

## Архитектура
- tRPC routers в apps/web/src/server/routers/
- adminProcedure: проверяет X-Telegram-Id в ADMIN_TELEGRAM_IDS
- telegramProcedure: проверяет Telegram WebApp initData
- Prisma клиент только через packages/db/src/index.ts
- S3 upload только через /api/upload route

## Правила
- NEVER коммить .env
- ALWAYS typecheck после изменений types/
- Prisma schema изменилась → создай миграцию СРАЗУ
- API мутации возвращают { data } или бросают TRPCError
- Даты в UTC везде
- BigInt для telegramId и tgMessageId (Telegram ID > 32 бит)

## Верификация
После каждого шага: pnpm typecheck && pnpm lint
Создай сущность → проверь в Prisma Studio → проверь в UI
```

---

## Деплой (Railway)

```
Проект Railway:
├── web     (Next.js)   — PORT=3000, все env
├── bot     (Grammy)    — USE_POLLING=true в dev, webhook в prod
└── postgres            — DATABASE_URL автоматически

Команды деплоя:
web: pnpm build && pnpm start
bot: pnpm build && node dist/index.js
```
