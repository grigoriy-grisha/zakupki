# План: стабилизация порядка элементов (без миграции)

## Корневая причина

Postgres не гарантирует порядок строк без `ORDER BY`. Два запроса, питающие все 4 админ-вкладки `/purchases/[id]`, не имеют `orderBy`:

1. `PurchaseRepository.getById` → `items: [...]` (массив PurchaseItem) — питает items-tab, supplements, packing, и список позиций в participants-tab
2. `OrderRepository.getByPurchase` → массив OrderLine — питает participants-tab (заказы внутри карточки участника)

После любой мутации (DELETE / inline-UPDATE / adminAdd / adminDecrease) React Query рефётчит запрос, Postgres может вернуть строки в другом порядке → UI «скачет».

## Решение

Добавить стабильный `orderBy` к двум запросам + вложенному `items` в 3 list-методах. **Без миграции, без schema-изменений, без UI** — `id` уже есть и по семантике это порядок добавления.

Почему `id`: первичный autoincrement → монотонно растёт → отражает хронологию добавления позиции в закупку. Для OrderLine — хронологию создания строки заказа. Это и есть интуитивный порядок, который админ ожидает.

---

## Изменения

### 1. `apps/frontend/src/server/domain/purchase.repository.ts`

**`getById` (строки 74-91):** вложенный `items` получает сортировку.

```typescript
items: {
    where: PurchaseRepository.itemsWhere(includeHidden),
    orderBy: { id: 'asc' },               // ← ДОБАВИТЬ
    include: {
        product: { include: productInclude },
        supplier: { select: { id: true, name: true } },
        currency: { select: { id: true, name: true, code: true, symbol: true } },
        orderLines: { include: { user: true }, omit: { tgChatMessageId: true } },
    },
},
```

**`list`, `listByStatuses`, `listByStatusesForUser` (строки 21, 39, 60):** то же самое — вложенный `items` получает `orderBy: { id: 'asc' }`. Это отдельный запрос (список закупок), но та же проблема проявится, когда список закупок будет отрисовывать позиции (e.g. в раскрытой карточке).

**Принцип DRY:** `orderLines` внутри `list`/`listByStatuses`/`listByStatusesForUser` (строки 26, 44, 65) тоже без `orderBy` — но это лёгкий select для счётчиков, не влияет на UI-порядок. Не трогаем, чтобы минимизировать diff.

### 2. `apps/frontend/src/server/domain/order.repository.ts`

**`getByPurchase` (строки 174-190):** добавить `orderBy` на верхний уровень.

```typescript
return dbClient.orderLine.findMany({
    where: { purchaseItem: { purchaseId }, status: 'ACTIVE' },
    orderBy: [{ userId: 'asc' }, { id: 'asc' }],   // ← ДОБАВИТЬ
    include: { ... },
});
```

Двойной ключ `userId, id`: участники на вкладке «Участники» группируются по пользователю в коде (`useParticipantsData:56-71` — `userOrders` Map), и визуально логично, чтобы строки одного участника шли подряд. Сортировка только по `id` дала бы «чередование» строк разных пользователей в исходном массиве — но т.к. они всё равно группируются в Map по userId, это не критично. Однако `userId: 'asc'` даёт ещё и детерминированный порядок самих участников (по возрастанию id = по времени регистрации), что полезно для отображения. Дополнительно стабилизируем `id` внутри пользователя.

---

## Что НЕ меняется

- React-ключи (`key={item.id}`, `key={userId}`, `key={item.id}`) — уже корректные
- Мутации (`adminAdd`, `adminDecrease`, `delete`, etc.) — без изменений
- Инвалидация React Query — без изменений (`getById` invalidate уже стоит во всех hooks)
- Schema, миграции, UI-компоненты — без изменений
- `productInclude` (сортировка внутри Product: photos, characteristicValues) — уже корректно отсортированы

## Проверка

1. `pnpm --filter @zakupki/frontend exec tsc --noEmit` — typecheck
2. Ручной smoke: открыть `/purchases/[id]` → вкладка Товары → изменить inline-поле позиции в середине списка → убедиться, что порядок строк не изменился
3. Smoke для Участников: убрать −1 у одного участника → убедиться, что его заказ остался на своём месте в карточке, и сама карточка не перескочила

## Объём diff

2 файла, ~6 строк добавлено (`orderBy` clauses). Никаких других изменений.