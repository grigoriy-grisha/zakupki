## Объединение одинаковых товаров в карточке участника

**Цель:** в панели заказов участника объединить несколько `OrderLine` одного участника на один `PurchaseItem` в одну визуальную позицию. Показывать количество в формате «2 уп + 20 гр» + «всего 120 гр» + явный бейдж целых упаковок.

**Контекст модели данных:** у одного `(userId, purchaseItemId)` может быть несколько `OrderLine` — unique constraint это тройка `(purchaseItemId, userId, createdOnStage)`. То есть строка `COLLECTION` (сбор) + строка `REORDER` (добор) — это нормально. Бэкенд-мутации `adminAdjust`/`adminSetQuantity` уже работают на уровне пары `(purchaseItemId, userId)` и не требуют `lineId`.

**Пример (весовой товар, упаковка 50 гр):** россыпью 70 (сбор 30 + добор 40) + 1 явная упаковка ×50 = 120 гр всего → `countFullSupplierPacks(120, 50)=2` уп, остаток `120-2×50=20` гр, из них 1 упаковка «явная» (`packageCount=1`).

### Что переиспользуем (без дублирования)
- `mergeLines(toOrderLinesVO(lines))` из `@zakupki/types` — уже объединяет COLLECTION+supplement в `AggregatedOrder` (суммирует quantity/amountDue/packageCount, собирает `lineIds`). Ту же логику используют магазин и бот.
- `countFullSupplierPacks(qty, packSize)` из `@zakupki/types` — делитель `packAmount`, не `minPackageAmount`.
- `effectiveQty = quantity + packageCount * packSize` — общее количество в базовых единицах.

### Слой 1 — shared/types: новый хелпер splitQtyIntoPackages

Файл: `shared/types/src/pack-discount/calculation.ts` (рядом с `countFullSupplierPacks`).

```ts
/**
 * Раскладывает общее количество на целые упаковки и остаток-россыпь.
 * total=120, packSize=50 → { packs: 2, remainder: 20 }.
 * total=0 или packSize<=0 → { packs: 0, remainder: total }.
 */
export function splitQtyIntoPackages(
    total: number,
    packSize: number | null,
): { packs: number; remainder: number } {
    if (!Number.isFinite(total) || total <= 0 || packSize == null || packSize <= 0) {
        return { packs: 0, remainder: Number.isFinite(total) ? Math.max(0, total) : 0 };
    }
    const packs = Math.floor((total + 1e-9) / packSize);
    return { packs, remainder: +(total - packs * packSize).toFixed(3) };
}
```
Реэкспорт из `shared/types/src/pack-discount/index.ts` и корневого `shared/types/src/index.ts`.

### Слой 2 — новый хук use-participant-merged-orders

Файл: `apps/frontend/src/app/(admin)/purchases/[id]/hooks/use-participant-merged-orders.ts` (чистая функция `mergeParticipantOrders` + thin wrapper). Группирует `OrderRow[]` одного участника по `purchaseItemId` через `mergeLines`, возвращает `MergedParticipantOrder[]`.

```ts
export interface MergedParticipantOrder {
    purchaseItemId: number;
    /** Сумма quantity всех строк (россыпь, без упаковок). */
    quantity: number;
    /** Сумма amountDue всех строк. */
    amountDue: number;
    /** Сумма packageCount всех строк (явные упаковки). */
    packageCount: number;
    /** Оригинальные ID строк (для потенциальных углублённых действий). */
    lineIds: number[];
    /** Первая строка — для доступа к purchaseItem/product. */
    source: ParticipantOrder;
}
```
Логика `mergeParticipantOrders(orders: ParticipantOrder[]): MergedParticipantOrder[]`:
- `Map<purchaseItemId, { source, lines }>` (source — первая встреченная, как в магазинском `groupOrdersByPurchase`).
- Для каждого item: `const agg = mergeLines(toOrderLinesVO(lines));` → `{ purchaseItemId, quantity, amountDue, packageCount, lineIds: agg.lineIds, source }`.
- Реэкспорт из `hooks/index.ts`.

### Слой 3 — новый компонент упаковочного дисплея

Файл: `apps/frontend/src/app/(admin)/purchases/[id]/components/participants/quantity-display.tsx` (presentation only, без state).

Пропсы: `{ totalQty, packageCount, packAmount, unitShort }`. Считает:
- `effective = totalQty + packageCount * packAmount` (если packAmount задан) иначе `totalQty`.
- `const { packs, remainder } = splitQtyIntoPackages(effective, packAmount ?? null)`.
- Явные упаковки (`packageCount` из данных) vs всего целых упаковок (`packs`).

Формат вывода (на основе ответа «Упаковки + остаток»):
```
📦 2 уп + 20 гр
всего 120 гр · 📦 1 упаковка целиком
```
- «2 уп + 20 гр» — крупно: если `packs>0` — «N уп + R гр», иначе просто «{effective} {unit}».
- «всего {effective} {unit} · 📦 {packageCount} упаковка целиком» — мелко серым. Склонение «упаковка/упаковки/упаковок» (локальный хелпер, как `pluralPacks` в product-card). Бейдж явных упаковок только при `packageCount>0`.
- Штучные товары (`unitCode='piece'`): «{effective} шт» без упаковочного расщепления (упаковки для штук не имеют смысла).

### Слой 4 — переделка ParticipantOrdersPanel

Файл: `participant-orders-panel.tsx`. Изменения:

1. **Группировка:** вместо `orders.map(order => ...)` — `const merged = mergeParticipantOrders(orders); merged.map(group => ...)`.
2. **Фото/название/поставщик:** из `group.source.purchaseItem.product` / `.supplier` (как сейчас, но из объединённого источника).
3. **AdminOrderLineEditor:** инпут показывает `group.quantity` (сумма россыпи). `±` и commit (setQuantity) идут с `purchaseItemId`+`userId` — бэкенд сам найдёт строки. Шаг ± через `getOrderQuantityStep(buildOrderQtyOptions(...))` из `group.source.purchaseItem` (как сейчас). `adminAdjust({ purchaseItemId, userId, delta })`, `adminSetQuantity({ purchaseItemId, userId, qty })`.
4. **QuantityDisplay** вставляется под названием товара (вместо текущей строки `+{order.packageCount} упак.`).
5. **Сумма справа:** `{safeNumber(group.amountDue).toLocaleString('ru-RU')} ₽`.
6. **«Итого» снизу панели** остаётся без изменений (уже суммирует `due`).

### Слой 5 — новый бэкенд-эндпоинт deleteAllByUserItem

Ответ «Удалить весь товар» — нужно убрать ВСЕ строки участника на один товар.

1. **Репозиторий** `apps/frontend/src/server/domain/order.repository.ts`: новый метод
   ```ts
   async deleteAllByUserAndItem(purchaseItemId: number, userId: number): Promise<number> {
       const r = await dbClient.orderLine.deleteMany({
           where: { purchaseItemId, userId, status: 'ACTIVE' },
       });
       return r.count;
   }
   ```
2. **Сервис** `apps/frontend/src/server/services/order.service.ts`: новый метод
   ```ts
   async deleteAllByUserAndItem(purchaseItemId: number, userId: number): Promise<void> {
       await this.repo.deleteAllByUserAndItem(purchaseItemId, userId);
       await this.emitPurchaseItemChanged(purchaseItemId);
       await this.notifyOrderLineDeleted(purchaseItemId, userId);
   }
   ```
   (использует существующие `emitPurchaseItemChanged`/`notifyOrderLineDeleted`; передаются `purchaseItemId`+`userId`, т.к. конкретного `lineId` больше нет).
3. **Роутер** `apps/frontend/src/server/routers/orders.ts`: новая процедура
   ```ts
   deleteAllByUserItem: adminProcedure
       .input(z.object({ purchaseItemId: z.number(), userId: z.number() }))
       .mutation(async ({ ctx, input }) => {
           await ctx.services.order.deleteAllByUserAndItem(input.purchaseItemId, input.userId);
       }),
   ```

### Слой 6 — удаление позиции в UI

1. **Хук** `use-participant-order-actions.ts`: новая мутация `deleteAllByUserItem` (с `toast.success('Товар удалён')` + инвалидирует `orders.getAllByPurchase`/`purchases.getById`, как `deleteOrderLine`).
2. **AdminOrderLineEditor** (`admin-order-controls.tsx`): колбэк `onDelete` меняет сигнатуру с `(orderId, productName)` на `(purchaseItemId, productName)`. Вызов `onDelete(order.purchaseItemId, productName)` (для товара это его `purchaseItemId`, не `lineId`).
3. **ParticipantOrdersPanel:** `onSetDeleteLineTarget` теперь таргетит `{ purchaseItemId, name }` вместо `{ id, name }`. ConfirmDialog вызывает `orderActions.deleteAllByUserItem.mutate({ purchaseItemId, userId })`.
4. **AdminParticipantRow:** тип `deleteLineTarget` меняется с `{ id: number; name: string }` на `{ purchaseItemId: number; name: string }`; `onConfirm` передаёт `purchaseItemId`+`userId`.
5. **Текст ConfirmDialog:** «Товар «{name}» будет удалён из заказа {userName} целиком (сбор+добор+упаковки). Действие нельзя отменить.»

### Слой 7 — проверка типа и ребилд

- `pnpm --filter @zakupki/types exec tsc --noEmit` (shared-пакет первым).
- `pnpm --filter @zakupki/frontend exec tsc --noEmit` (хук/компоненты/сервис/роутер/репо).
- ESLint если доступен.

### Чего НЕ трогаем
- **`OrderBook`/стратегии** — не нужны изменения; мутации уже агрегатные.
- **`order.repository.getByPurchase`** — возвращает плоские строки; группировка в хуке.
- **items-вкладку/бот/магазин** — их отображение не меняется.
- **`mergeLines`** — берём как есть (уже суммирует всё нужное).
- **`ParticipantCommentStrip`/`ParticipantPaymentsPanel`/`AddPaymentDialog`** — не затрагиваются.
- **Бейджи статуса оплаты/суммы в `AdminParticipantRow`** — `due` уже сумма по всем строкам участника (`reduce(amountDue)`), не меняется.

### Риски и нюансы
- **`adminSetQuantity` схлопывает строки:** при ручном вводе количества в инпуте бэкенд удалит все строки пользователя и создаст одну новую `COLLECTION` (теряет baseQuantity-заморозку). Это существующее поведение, для админ-override допустимо.
- **Штучные товары:** `packAmount` часто null → `splitQtyIntoPackages` вернёт `{packs:0, remainder:effective}` → показываем просто «N шт».
- **`notifyOrderLineDeleted`** сейчас принимает `lineId` — нужно проверить сигнатуру и адаптировать (передать purchaseItemId+userId или заглушку, если метод берёт lineId только для логов). Уточню при реализации.
- **Порядок мап для `use-participant-merged-orders`:** source берёт ПЕРВУЮ строку (как в магазине). Все строки одной пары имеют одинаковый purchaseItem/product, так что фото/название стабильны.

### Что проверить руками
1. Участник с 2 строками на один товар (сбор+добор) → видит ОДНУ позицию с «2 уп + 20 гр», «всего 120 гр», бейджем явных упаковок.
2. `±` и ручной ввод количества → корректно меняют россыпь (бэкенд находит строки).
3. Корзина на объединённой позиции → ConfirmDialog → удаляются ВСЕ строки товара, список рефрешится.
4. Штучный товар → показывает «N шт» без упаковочного расщепления.
5. Участник с одним товаром и одной строкой → отображение не сломалось.
6. Суммы (due/итого/покрыто) в карточке участника и хедере списка не изменились.