# Глубокий рефакторинг: чистая доменная модель заказа

## Контекст

**Проблема:** Бизнес-логика заказов размазана по 10+ файлам в разных слоях приложения:

- `OrderService` (server) — 434 строки, связан с Prisma-типами, репозиториями, async settings
- `OrderCollectionService` (bot) — парсит текст, делегирует в OrderService, агрегирует результат
- `order-context.ts` + `order-quantity.ts` (frontend) — дублирует расчёт пула, агрегацию, permissions
- `items-tab.tsx` / `supplement-tab.tsx` (admin) — ещё одна копия расчёта пула
- `order-strategies.ts` / `supplement.ts` (shared) — pure-функции, но разобщены

**Следствия:**

- Изменение бизнес-правил требует правок в 5+ местах
- Невозможно написать юнит-тест — логика прибита к DB через Prisma-типы
- Типы из БД протекают повсюду (`NonNullable<Awaited<ReturnType<PurchaseRepository['findItemWithPrice']>>>`)
- Много `any`-кастов из-за отсутствия единой модели

**Цель:** Выделить всю бизнес-логику заказа в чистую доменную модель (pure TypeScript, без DB, без lib-зависимостей) с чётким контрактом «вход → выход», которую можно тестировать одной строкой.

---

## Архитектура

```
┌──────────────────────────────────────────┐
│  Presentation (tRPC router, bot handler) │
│  - валидация входа (Zod)                 │
│  - вызов ApplicationService              │
└──────────────┬───────────────────────────┘
               │
┌──────────────▼───────────────────────────┐
│  ApplicationService (OrderService)       │
│  - fetch data from repos (async)         │
│  - map to domain input                   │
│  - call OrderDomain (pure, sync)         │
│  - persist result via repos (async)      │
│  - return domain output mapped to tRPC   │
└──────────────┬───────────────────────────┘
               │ pure, sync, no deps
┌──────────────▼───────────────────────────┐
│  Domain Layer (OrderDomain)              │
│  shared/types/src/order/                 │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  Types:                             │ │
│  │  - OrderLine (value object)         │ │
│  │  - PurchaseItemContext              │ │
│  │  - StageAction, StagePermission     │ │
│  │  - AdjustResult, PoolInfo           │ │
│  │  - MergedOrderLine                  │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Stage Strategies:                  │ │
│  │  - CollectionStage                  │ │
│  │  - ReorderStage                     │ │
│  │  - PaymentPlusStage                 │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Core Functions (facade):           │ │
│  │  - adjustQuantity()                 │ │
│  │  - adjustPackageCount()             │ │
│  │  - computePool()                    │ │
│  │  - aggregateLines()                 │ │
│  │  - buildOrderContext()              │ │
│  │  - canPerformAction()               │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## Доменные типы

Все типы — plain TypeScript interfaces/types, без Prisma, без Decimal, без async.

### `shared/types/src/order/types.ts`

```typescript
// ── Value Objects ────────────────────────────────

/** Одна строка заказа (immutable value object) */
export interface OrderLineVO {
    id: number;
    purchaseItemId: number;
    userId: number;
    quantity: number; // уже Number(), не Decimal
    amountDue: number;
    packageCount: number;
    status: 'ACTIVE' | 'CANCELLED';
    createdOnStage: PurchaseFulfillmentStatus;
    baseQuantity: number | null; // null = не заморожен
}

/** Контекст товара закупки — всё что нужно для принятия решения */
export interface PurchaseItemContext {
    purchaseItemId: number;

    // Цены
    pricePerUnit: number;
    priceOverride: number | null;
    priceTiers: PriceTier[] | null;
    packDiscountPercent: number;

    // Упаковка
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;

    // Параметры товара
    unitCode: string;
    multiplicity: number;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplementStep: number | null;

    // Параметры закупки
    fulfillmentStatus: PurchaseFulfillmentStatus;
    targetRemainder: number | null;

    // Все строки этого purchaseItem (для pool calc)
    orderLines: OrderLineVO[];
}

// ── Результаты ──────────────────────────────────

export type AdjustQuantityResult = { ok: true; effects: OrderEffect[] } | { ok: false; error: OrderError };

export type AdjustPackageResult = { ok: true; effects: OrderEffect[] } | { ok: false; error: OrderError };

export interface OrderEffect {
    type: 'upsert' | 'delete' | 'zero_out';
    purchaseItemId: number;
    userId: number;
    createdOnStage: string;
    // upsert:
    quantity?: number;
    amountDue?: number;
    packageCount?: number;
}

export interface OrderError {
    code: 'invalid_action' | 'pool_exceeded' | 'not_found' | 'forbidden';
    message: string;
    details?: {
        canAddMore?: number;
        unitShort?: string;
    };
}

// ── Pool ────────────────────────────────────────

export interface PoolInfo {
    pool: number | null;
    maxAllowed: number;
    /** Для UI: сколько ещё можно добавить */
    canAddMore: number;
    supplementClaimed: number;
    totalBaseQuantity: number;
    totalOrderedQuantity: number;
}

// ── Aggregation ─────────────────────────────────

export interface AggregatedOrder {
    purchaseItemId: number;
    quantity: number;
    amountDue: number;
    packageCount: number;
    baseQuantity: number;
    lineIds: number[];
}

export interface OrderDisplayContext {
    shortName: string;
    price: number;
    currentQuantity: number;
    currentPackageCount: number;
    activeStep: number;
    isSupplement: boolean;
    pool: PoolInfo | null;
    isSoldOut: boolean;
    packSize: number | null;
    showPackageButtons: boolean;
    packagePrice: number;
    total: number;
    fullPacks: number;
    canAdd: boolean;
    canDecrease: boolean;
    maxAllowed: number;
    minAllowed: number;
}
```

---

## Стратегии по этапам

Ключевой паттерн: каждый этап — своя стратегия, инкапсулирующая правила.

### `shared/types/src/order/stages.ts`

```typescript
export interface StageStrategy {
    /** Можно ли добавить/убавить/создать новый */
    canAddNew(): boolean;
    canIncrease(): boolean;
    canDecrease(): boolean;

    /** Работает с COLLECTION-строкой или supplement-строкой */
    targetLineType: 'base' | 'supplement';

    /** Допустимы ли упаковки */
    packagesAllowed(): boolean;

    /** Что делать при обнулении qty */
    onZeroQuantity(line: OrderLineVO): 'hard_delete' | 'zero_out';

    /** Валидация пула (null = пул не применим) */
    validatePool(item: PurchaseItemContext, userId: number, newQty: number, currentQty: number): OrderError | null;

    /** Агрегация строк для pool calc */
    aggregateForPool(lines: OrderLineVO[]): {
        totalBaseQuantity: number;
        supplementClaimed: number;
        totalOrderedQuantity: number;
    };
}
```

Три реализации:

#### `CollectionStage` (COLLECTION)

- `canAddNew() → true`, `canIncrease() → true`, `canDecrease() → true`
- `targetLineType → 'base'`
- `packagesAllowed() → true`
- `onZeroQuantity() → 'hard_delete'` (полное удаление строки)
- `validatePool() → null` (нет пула на COLLECTION)
- `aggregateForPool() → { totalBase: 0, supplement: 0, total: sum(qty) }` (pool не используется)

#### `ReorderStage` (REORDER)

- `canAddNew() → true`, `canIncrease() → true`, `canDecrease() → true`
- `targetLineType → 'base'` (работаем с COLLECTION-строкой!)
- `packagesAllowed() → true`
- `onZeroQuantity() → 'zero_out'` (сохраняем строку с qty=0, baseQuantity)
- `validatePool() → compute pool, check maxAllowed`
- `aggregateForPool()` — supplement = `Σ max(0, qty - baseQuantity)` для каждой ACTIVE строки (baseQuantity-based, не createdOnStage)

#### `PaymentPlusStage` (PAYMENT и далее)

- `canAddNew() → true`, `canIncrease() → true`, `canDecrease() → true` (но не ниже baseQuantity)
- `targetLineType → 'supplement'` (работаем с supplement-строкой!)
- `packagesAllowed() → false`
- `onZeroQuantity() → 'hard_delete'` (supplement можно убрать до 0 и удалить)
- `validatePool() → compute pool, check maxAllowed`
- `aggregateForPool()` — supplement = `Σ qty строк createdOnStage !== 'COLLECTION'` (createdOnStage-based)

### Фабрика стратегий

```typescript
export function getStageStrategy(stage: PurchaseFulfillmentStatus): StageStrategy {
    if (stage === 'COLLECTION') return new CollectionStage();
    if (stage === 'REORDER') return new ReorderStage();
    return new PaymentPlusStage();
}
```

---

## Фасад: OrderDomain

Единая точка входа. Все методы — **чистые синхронные функции**.

### `shared/types/src/order/order-domain.ts`

```typescript
export const OrderDomain = {
    // ── Основные операции ────────────────

    adjustQuantity(
        item: PurchaseItemContext,
        userId: number,
        delta: number,
    ): AdjustQuantityResult,

    adjustPackageCount(
        item: PurchaseItemContext,
        userId: number,
        delta: number,
    ): AdjustPackageResult,

    // ── Расчёты ──────────────────────────

    computePool(
        item: PurchaseItemContext,
        userId: number,
    ): PoolInfo,

    computeAmountDue(
        quantity: number,
        item: PurchaseItemContext,
    ): number,

    // ── Агрегация ────────────────────────

    aggregateUserLines(
        lines: OrderLineVO[],
        userId: number,
        purchaseItemId: number,
    ): AggregatedOrder,

    aggregateAllLines(
        lines: OrderLineVO[],
        purchaseItemId: number,
    ): AggregatedOrder & { perUser: Map<number, AggregatedOrder> },

    // ── UI Context ───────────────────────

    buildDisplayContext(
        item: PurchaseItemContext,
        userId: number,
    ): OrderDisplayContext,

    // ── Permissions ──────────────────────

    canPerformAction(
        stage: PurchaseFulfillmentStatus,
        action: 'add_new' | 'increase' | 'decrease' | 'cancel' | 'add_package',
    ): boolean,
};
```

### Реализация `adjustQuantity` (псевдокод):

```typescript
function adjustQuantity(item, userId, delta): AdjustQuantityResult {
    if (delta === 0) return { ok: true, effects: [] };

    const strategy = getStageStrategy(item.fulfillmentStatus);

    // Найти нужную строку
    const line = strategy.targetLineType === 'base'
        ? findBaseLine(item.orderLines, userId)
        : findSupplementLine(item.orderLines, userId);

    const currentQty = line?.quantity ?? 0;
    const newQty = currentQty + delta;

    // Permission check
    const action = !line ? 'add_new' : delta > 0 ? 'increase' : 'decrease';
    if (!canPerformAction(item.fulfillmentStatus, action)) {
        return { ok: false, error: { code: 'forbidden', message: '...' } };
    }

    // PAYMENT+: нельзя убавить ниже baseQuantity
    if (action === 'decrease' && strategy.targetLineType === 'supplement') {
        const baseLine = findBaseLine(item.orderLines, userId);
        if (baseLine && baseLine.quantity > 0 && newQty < 0) {
            return { ok: false, error: { ... } };
        }
    }

    // Pool validation при увеличении
    if (delta > 0) {
        const poolError = strategy.validatePool(item, userId, newQty, currentQty);
        if (poolError) return { ok: false, error: poolError };
    }

    // Compute amount
    const amountDue = computeAmountDue(newQty, item);

    // Build effects
    if (newQty <= 0) {
        const zeroAction = strategy.onZeroQuantity(line);
        if (zeroAction === 'hard_delete' && line) {
            return { ok: true, effects: [{ type: 'delete', ... }] };
        }
        if (zeroAction === 'zero_out' && line) {
            return { ok: true, effects: [{ type: 'zero_out', quantity: 0, amountDue: 0, ... }] };
        }
        return { ok: true, effects: [] }; // nothing to do
    }

    return {
        ok: true,
        effects: [{
            type: 'upsert',
            quantity: newQty,
            amountDue,
            createdOnStage: strategy.targetLineType === 'base' ? 'COLLECTION' : item.fulfillmentStatus,
            ...
        }],
    };
}
```

---

## Структура файлов

```
shared/types/src/order/
├── index.ts                  # barrel export
├── types.ts                  # все типы (OrderLineVO, PurchaseItemContext, results)
├── stages/
│   ├── index.ts              # StageStrategy interface + getStageStrategy factory
│   ├── collection.stage.ts   # CollectionStage
│   ├── reorder.stage.ts      # ReorderStage
│   └── payment-plus.stage.ts # PaymentPlusStage
├── order-domain.ts           # фасад — все чистые функции
├── pool.ts                   # computeSupplementPool (перенос из supplement.ts)
├── pricing.ts                # computeAmountDue (обёртка над calculateOrderAmount)
├── aggregation.ts            # aggregateLines, mergeUserLines (перенос из order-grouping.ts)
└── __tests__/
    ├── order-domain.test.ts  # основные тесты
    ├── stages.test.ts        # тесты стратегий
    ├── pool.test.ts          # тесты пула
    └── aggregation.test.ts   # тесты агрегации
```

---

## Изменения в существующих файлах

### 1. `shared/types/src/supplement.ts` → DEPRECATED

- `aggregateOrderLinesByStage` → переносится в `order/aggregation.ts`
- `getSupplementPool` → переносится в `order/pool.ts`
- Старый файл переэкспортит для обратной совместимости

### 2. `shared/types/src/order-strategies.ts` → DEPRECATED

- Все `can*` функции → переносятся в `order/stages/` и `order/order-domain.ts`
- Старый файл переэкспортит для обратной совместимости

### 3. `apps/frontend/src/server/services/order.service.ts` — СУЩЕСТВЕННО УПРОЩАЕТСЯ

**Было:** 434 строки бизнес-логики + DB-зависимости
**Станет:** ~120 строк "fetch → map → call domain → persist"

```typescript
export class OrderService {
    async adjustQuantity(purchaseItemId: number, userId: number, delta: number) {
        // 1. Fetch
        const item = await this.purchaseRepo.findItemWithPrice(purchaseItemId);
        if (!item) throw new NotFoundError('Товар закупки', purchaseItemId);

        // 2. Map to domain input
        const ctx = mapToPurchaseItemContext(item, await this.pricingSettings.getBeadPackPriceDiscountPercent());

        // 3. Call domain (pure!)
        const result = OrderDomain.adjustQuantity(ctx, userId, delta);

        // 4. Handle result
        if (!result.ok) throw new ValidationError(result.error.message);
        return this.persistEffects(result.effects);
    }

    // аналогично для adjustPackageCount, getUserOrders, etc.
}
```

### 4. `apps/frontend/src/server/bot/services/order-collection.service.ts` — УПРОЩАЕТСЯ

- `applyQuantityDelta` / `applyPackDelta` — делегируют в `OrderDomain`
- Агрегация результата — через `OrderDomain.aggregateUserLines()`
- Парсинг текста остаётся (это presentation logic)

### 5. `apps/frontend/src/app/shop/lib/order-context.ts` → ЗАМЕНЯЕТСЯ

- `buildItemOrderContext()` → одна строка: `OrderDomain.buildDisplayContext(item, userId)`
- Вся логика шагов, пула, разрешений — в домене

### 6. `apps/frontend/src/app/shop/lib/order-quantity.ts` → УПРОЩАЕТСЯ

- `buildShopOrderQuantityContext()` → делегирует в `OrderDomain.computePool()`

### 7. `apps/frontend/src/app/shop/lib/order-grouping.ts` → ЗАМЕНЯЕТСЯ

- `groupOrdersByPurchase()` → использует `OrderDomain.aggregateUserLines()`
- `MergedOrderLine` → alias для `AggregatedOrder`

### 8. `apps/frontend/src/app/(admin)/purchases/[id]/components/items-tab.tsx`

- Убирается дублирующий расчёт пула — используется `OrderDomain.computePool()`

### 9. `apps/frontend/src/server/bot/handlers/orders.ts`

- `formatPurchaseDetail` → использует `OrderDomain.aggregateAllLines()`

---

## План реализации (пошагово)

### Шаг 1: Создать доменные типы

- Файл: `shared/types/src/order/types.ts`
- Все интерфейсы из раздела «Доменные типы» выше
- Экспорт через `shared/types/src/order/index.ts` и `shared/types/src/index.ts`

### Шаг 2: Реализовать стратегии этапов

- `shared/types/src/order/stages/collection.stage.ts`
- `shared/types/src/order/stages/reorder.stage.ts`
- `shared/types/src/order/stages/payment-plus.stage.ts`
- `shared/types/src/order/stages/index.ts` — интерфейс + фабрика

### Шаг 3: Реализовать pool.ts и aggregation.ts

- `shared/types/src/order/pool.ts` — `computeSupplementPool()` из текущего `supplement.ts`, адаптированный под `OrderLineVO[]`
- `shared/types/src/order/aggregation.ts` — `aggregateLines()`, `mergeUserLines()`, `groupLinesByPurchase()`

### Шаг 4: Реализовать pricing.ts

- `shared/types/src/order/pricing.ts` — `computeAmountDue()` как обёртка над `calculateOrderAmount()`

### Шаг 5: Реализовать фасад OrderDomain

- `shared/types/src/order/order-domain.ts`
- `adjustQuantity()`, `adjustPackageCount()`, `computePool()`, `buildDisplayContext()`, `canPerformAction()`
- Все методы — pure sync functions

### Шаг 6: Refactor OrderService (server)

- Map Prisma → `PurchaseItemContext`
- Делегировать в `OrderDomain`
- `persistEffects()` — маппинг `OrderEffect[]` в вызовы репозитория

### Шаг 7: Refactor bot OrderCollectionService

- Использовать `OrderDomain.adjustQuantity()` вместо `serviceContainer.order.adjustQuantity()`
- Использовать `OrderDomain.aggregateUserLines()` для результата

### Шаг 8: Refactor frontend order-context

- `buildItemOrderContext()` → делегировать в `OrderDomain.buildDisplayContext()`
- `order-quantity.ts` → упростить

### Шаг 9: Refactor order-grouping

- Использовать `OrderDomain.aggregateUserLines()` / `aggregateAllLines()`

### Шаг 10: Refactor admin items-tab

- Заменить inline pool calc на `OrderDomain.computePool()`

### Шаг 11: Обновить barrel exports

- Старые `supplement.ts` и `order-strategies.ts` — добавить `@deprecated`, переэкспорт из нового расположения

---

## Mаппер Prisma → Domain

### `apps/frontend/src/server/lib/order-domain-mapper.ts`

```typescript
import type { PurchaseItemContext, OrderLineVO } from '@zakupki/types';

/** Конвертация Prisma-объекта findItemWithPrice → PurchaseItemContext */
export function mapToPurchaseItemContext(
    item: NonNullable<Awaited<ReturnType<PurchaseRepository['findItemWithPrice']>>>,
    packDiscountPercent: number,
): PurchaseItemContext {
    return {
        purchaseItemId: item.id,
        pricePerUnit: Number(item.product.pricePerUnit),
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
        priceTiers: (item.product.priceTiers as any) ?? null,
        packDiscountPercent,
        supplierPackageAmount:
            item.product.supplierPackageAmount != null ? Number(item.product.supplierPackageAmount) : null,
        supplierPackageUnit: item.product.supplierPackageUnit ?? null,
        supplierPackagePrice:
            item.product.supplierPackagePrice != null ? Number(item.product.supplierPackagePrice) : null,
        unitCode: item.product.unitCode,
        multiplicity: Number(item.product.multiplicity),
        minPackageAmount: item.product.minPackageAmount != null ? Number(item.product.minPackageAmount) : null,
        minPackageUnit: item.product.minPackageUnit ?? null,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        fulfillmentStatus: (item.purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus,
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        orderLines: (item.orderLines ?? []).map(mapOrderLine),
    };
}

export function mapOrderLine(line: any): OrderLineVO {
    return {
        id: line.id,
        purchaseItemId: line.purchaseItemId,
        userId: line.userId,
        quantity: Number(line.quantity ?? 0),
        amountDue: Number(line.amountDue ?? 0),
        packageCount: line.packageCount ?? 0,
        status: line.status ?? 'ACTIVE',
        createdOnStage: line.createdOnStage ?? 'COLLECTION',
        baseQuantity: line.baseQuantity != null ? Number(line.baseQuantity) : null,
    };
}
```

---

## Пример теста (как легко будет тестировать)

```typescript
import { OrderDomain } from '@zakupki/types';

describe('OrderDomain.adjustQuantity', () => {
    const baseItem: PurchaseItemContext = {
        purchaseItemId: 1,
        fulfillmentStatus: 'REORDER',
        targetRemainder: null,
        supplierPackageAmount: 100, // пачка 100гр
        // ... остальные поля
        orderLines: [
            { id: 1, userId: 1, quantity: 40, baseQuantity: 10, createdOnStage: 'COLLECTION', ... },
            { id: 2, userId: 3, quantity: 130, baseQuantity: null, createdOnStage: 'COLLECTION', ... },
        ],
    };

    it('REORDER: allows adding from pool', () => {
        const result = OrderDomain.adjustQuantity(baseItem, userId=1, delta=10);
        expect(result.ok).toBe(true);
        expect(result.effects[0].quantity).toBe(50);
    });

    it('REORDER: rejects exceeding pool', () => {
        const result = OrderDomain.adjustQuantity(baseItem, userId=1, delta=100);
        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('pool_exceeded');
    });

    it('COLLECTION: no pool restriction', () => {
        const item = { ...baseItem, fulfillmentStatus: 'COLLECTION' };
        const result = OrderDomain.adjustQuantity(item, userId=1, delta=999);
        expect(result.ok).toBe(true);
    });
});
```

**Важно:** Ноль моков, ноль DB, ноль async — чистые функции, вход → выход.

---

## Верификация

1. **typecheck** — `pnpm typecheck` проходит без ошибок
2. **Существующие тесты** — `pnpm test` проходит (старые переэкспорты)
3. **Новые тесты** — `shared/types/src/order/__tests__/` покрывают:
    - adjustQuantity для каждого этапа (COLLECTION, REORDER, PAYMENT)
    - adjustPackageCount
    - computePool для REORDER (baseQuantity-based) и PAYMENT (createdOnStage-based)
    - aggregateLines
    - buildDisplayContext
4. **Ручное тестирование:**
    - REORDER: добавить из остатка → работает
    - REORDER: убавить и добавить обратно → pool не теряется
    - PAYMENT+: supplement через createdOnStage
    - Bot: `/orders` показывает агрегированные данные
    - Admin: «Доступно» показывает корректный pool
    - Shop: корзина, страница заказа — данные корректны

---

## Итого: что даёт рефакторинг

| Было                                  | Станет                         |
| ------------------------------------- | ------------------------------ |
| Логика в 10+ файлах                   | Логика в 1 доменном модуле     |
| Prisma-типы в бизнес-логике           | Чистые TS-интерфейсы           |
| Невозможно тестировать без DB         | Юнит-тесты одной строкой       |
| Pool logic дублируется 5 раз          | Один `computePool()`           |
| Stage routing через if/else в сервисе | Стратегии с полиморфизмом      |
| Изменение правил → 5 файлов           | Изменение правил → 1 стратегия |
