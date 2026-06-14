# Тесты PAYMENT+ для OrderBook + admin-методы (в обход правил)

## Контекст

COLLECTION (23 кейса) и REORDER (42 кейса) уже написаны и зелёные. Сейчас шаг 3 — PAYMENT+.

**Юзерская спецификация (уточнённая):**

1. **User-методы** (`adjust`, `adjustPackages`) — подчиняются правилам этапа:
    - PAYMENT+: только `adjust(+X)` для новой supplement-строки. `adjust(-X)` запрещён (`canDecrease: false`). `adjustPackages` запрещён (`canAddPackages: false`).
2. **Admin-методы** — идут **в обход** всех правил (`canIncrease/canDecrease/canAddPackages/poolApplies`). Просто напрямую работают с данными.

**Список admin-методов (4 штуки):**

| Метод                           | Что делает                                                                       | В обход                                            |
| ------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| `adminDelete(userId)`           | Удаляет все активные строки юзера (bulk)                                         | `canAddNew` (наличие), `onZero` (всё равно delete) |
| `adminDecrease(userId, amount)` | Убавляет суммарно на amount (по всем активным строкам). До 0 → удаление          | `canDecrease`, `onZero`                            |
| `adminAdd(userId, amount)`      | Добавляет amount (по всем активным строкам)                                      | `canIncrease`, `canAddNew`, `poolApplies`          |
| `adminSetQuantity(userId, qty)` | Устанавливает точное `qty` (суммарно по всем активным строкам). qty=0 → удаление | Все правила                                        |

**Admin работает с ВСЕМИ строками юзера по этому PurchaseItem (bulk):**

- COLLECTION-строка (замороженная база)
- REORDER-supplement-строка (если есть)
- PAYMENT-supplement-строка (если есть)

То есть если у юзера 2 строки (COLLECTION qty=80 + PAYMENT qty=20), то `adminDecrease(30)` сначала убавляет PAYMENT (20), потом COLLECTION (10). Остаётся COLLECTION qty=70.

**Аналогия с уже написанным `adjustReorder`:**

- REORDER-RULE работает так: убавка сначала supplement, потом COLLECTION.
- Admin-методы на любом этапе: убавка сначала supplement-строки (REORDER/PAYMENT), потом COLLECTION.
- Добавка: наоборот — сначала COLLECTION (если есть), потом supplement? Или в новую строку? **Нужно уточнить** — см. «Открытые вопросы» внизу.

**Текущее состояние PAYMENT_PLUS_RULE (order-book.ts строки 122-141):**

- `target: 'supplement'`, `onZero: 'hard_delete'`, `poolApplies: true`.
- `canAddPackages: false`, `canAddNew: true`, `canIncrease: false`, `canDecrease: false`.
- Правила остаются как есть (user-методы `adjust`/`adjustPackages` подчиняются им). Admin-методы идут в обход.

---

## Что покрываем тестами

### Файл 1: `shared/types/__tests__/order/payment-plus.test.ts` — user-методы

~20 кейсов. Стиль как в collection.test.ts / reorder.test.ts.

**A. Создание книги на PAYMENT (3 кейса)**

- Пустая книга → `lines.length === 0`.
- `remainder` при `targetRemainder=50` → `50`.
- `poolFor(1)` → `pool: 50, canAddMore: 50`.

**B. Юзер без строки берёт из остатка (3 кейса)**

- `adjust(1, +30)` → создаётся supplement-строка:
    - `createdOnStage: 'PAYMENT'`
    - `quantity: 30`, `amountDue: 3000`
    - `baseQuantity: null`, `packageCount: 0`
- `changes[0]`: `upsert` с `createdOnStage: 'PAYMENT'`.
- `remainder` после: `20`.
- `poolFor(1)`: `pool: 20, canAddMore: 20, maxAllowed: 50`.

**C. Увеличение существующей supplement-строки запрещено (2 кейса)**

- Есть supplement-строка `qty: 30`. `adjust(1, +10)` → `'forbidden'` (canIncrease=false).
- Книга не изменилась.

**D. Убавка запрещена через adjust (2 кейса)**

- `adjust(1, -5)` на supplement-строке → `'forbidden'` (canDecrease=false).
- `adjust(1, -30)` (вся строка) → тоже `'forbidden'` (нельзя обойти через «убавку до 0»).

**E. Упаковки на PAYMENT+ запрещены (3 кейса)**

- `adjustPackages(1, +1)` → `'forbidden'`.
- `adjustPackages(1, -1)` на пустой → `'forbidden'`.
- `adjustPackages` НЕ создаёт COLLECTION-строку.

**F. Превышение пула (2 кейса)**

- `adjust(1, +60)` при остатке 50 → `'pool_exceeded', canAddMore: 50`.
- `adjust(1, +30)` → ok, потом `adjust(1, +30)` → `'pool_exceeded', canAddMore: 20`.

**G. COLLECTION-строка из предыдущего этапа (2 кейса)**

- COLLECTION `qty: 80, baseQuantity: 80`. `adjust(1, +20)` при `targetRemainder=20` → supplement-строка `qty: 20`. COLLECTION не тронута. `totalFor(1).quantity === 100`.

**H. displayContextFor на PAYMENT+ (6 кейсов)**

- `isSupplement === true`.
- `minAllowed === frozenBase` (например 80 для COLLECTION qty=80, baseQuantity=80).
- `canAdd === true/false` в зависимости от пула.
- `canDecrease === true` если `currentQuantity > frozenBase` (есть добор).
- `canDecrease === false` если `currentQuantity === frozenBase`.
- `showPackageButtons === false`.
- `activeStep` учитывает `supplementStep`.

**I. Несколько юзеров (1 кейс)**

- User1 взял 30, user2 `poolFor(2).canAddMore === 20`.

**J. CANCELLED-строка (1 кейс)**

- COLLECTION-строка `status: 'CANCELLED'` → `activeLines` без неё, `baseLineFor(1) === null`.

**K. Иммутабельность (1 кейс)**

- После `adjust` исходный book не изменяется.

### Файл 2: `shared/types/__tests__/order/admin.test.ts` — admin-методы (новый)

~25 кейсов. Admin-методы тестируются на **каждом этапе** (COLLECTION / REORDER / PAYMENT+) — все три должны вести себя **одинаково** в обход правил.

**A. adminDelete (6 кейсов)**

| Сценарий                                    | Ожидание                               |
| ------------------------------------------- | -------------------------------------- |
| COLLECTION+PAYMENT+ `userId=1`, adminDelete | обе строки удалены, changes=2×`delete` |
| Только COLLECTION, adminDelete              | строка удалена, change=`delete`        |
| Только PAYMENT-supplement, adminDelete      | строка удалена, change=`delete`        |
| Нет строк у юзера                           | no-op, ok, changes=[]                  |
| Другой юзер не задет                        | `lines` для userId=2 без изменений     |
| Возвращает новый book (immutable)           | исходный book не изменился             |

**B. adminDecrease (6 кейсов)**

| Сценарий                                          | Ожидание                                       |
| ------------------------------------------------- | ---------------------------------------------- |
| COLLECTION `qty: 80`, adminDecrease(30)           | `qty: 50`, baseQuantity: 80, change=`upsert`   |
| COLLECTION `qty: 80`, adminDecrease(80)           | hard_delete, change=`delete`                   |
| COLLECTION+PAYMENT (80+20=100), adminDecrease(30) | PAYMENT: 0 (delete), COLLECTION: 70, changes=2 |
| amount > qty                                      | ошибка `'negative'`                            |
| amount <= 0                                       | ошибка `'negative'`                            |
| Юзер без строк                                    | ошибка `'negative'` (не найдено что убавлять)  |

**C. adminAdd (6 кейсов)**

| Сценарий                                               | Ожидание                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| COLLECTION `qty: 80`, adminAdd(30)                     | `qty: 110`, change=`upsert`                                                                              |
| Нет строк у юзера, adminAdd(10)                        | создаётся COLLECTION-строка qty=10, change=`upsert` с `createdOnStage: 'COLLECTION'`? **Нужно уточнить** |
| COLLECTION+PAYMENT (80+20=100), adminAdd(50)           | новая сумма 150, **порядок применения не уточнён**                                                       |
| amount <= 0                                            | ошибка `'negative'`                                                                                      |
| Без `targetRemainder`, пул не задан                    | `adjust` бы упал, adminAdd проходит                                                                      |
| Несколько юзеров — adminAdd на user1 не задевает user2 | ok                                                                                                       |

**D. adminSetQuantity (6 кейсов)**

| Сценарий                                             | Ожидание                                              |
| ---------------------------------------------------- | ----------------------------------------------------- |
| COLLECTION `qty: 80`, adminSetQuantity(100)          | `qty: 100`, change=`upsert`                           |
| COLLECTION `qty: 80`, adminSetQuantity(0)            | hard_delete, change=`delete`                          |
| COLLECTION+PAYMENT (80+20=100), adminSetQuantity(50) | сумма 50, **распределение не уточнено** (см. вопросы) |
| qty < 0                                              | ошибка `'negative'`                                   |
| Юзер без строк, qty > 0                              | создаётся строка? (аналогично adminAdd)               |
| qty === текущему                                     | no-op                                                 |

**E. Кросс-этапная консистентность (3 кейса)**

| Сценарий                                             | Ожидание                                        |
| ---------------------------------------------------- | ----------------------------------------------- |
| adminDecrease на COLLECTION (FULFILLMENT=COLLECTION) | работает (хотя user-`adjust(-X)` тоже работает) |
| adminDecrease на REORDER                             | работает                                        |
| adminDecrease на PAYMENT+                            | работает (хотя user-`adjust(-X)` запрещён)      |
| adminAdd на каждом этапе                             | работает одинаково                              |

**F. displayContextFor не меняется (1 кейс)**

- Admin-методы НЕ должны вызывать `displayContextFor` внутри (это статический метод, не зависит). После admin-операции `displayContextFor` всё ещё корректен (например, `canDecrease` не «открылся» магически).

---

## Доработка OrderBook (нужна до тестов)

Файл: `shared/types/src/order/order-book.ts`.

### 1. Новые методы (все идут в обход `rule`)

```ts
/** Admin: удалить все активные строки юзера (bulk). */
adminDelete(userId: number): AdjustResult {
    const userLines = this.activeLines.filter((l) => l.userId === userId);
    if (userLines.length === 0) return { ok: true, book: this, changes: [] };
    const newLines = this.lines.filter((l) => l.userId !== userId);
    const changes: OrderEffect[] = userLines.map((l) => ({ type: 'delete', lineId: l.id }));
    return { ok: true, book: this.withLines(newLines), changes };
}

/** Admin: убавить суммарно на amount. Сначала supplement-строки, потом COLLECTION. */
adminDecrease(userId: number, amount: number): AdjustResult {
    if (amount <= 0) return { ok: false, error: { code: 'negative', message: '...' } };

    const userLines = this.activeLines.filter((l) => l.userId === userId);
    const totalQty = userLines.reduce((s, l) => s + l.quantity, 0);
    if (amount > totalQty) return { ok: false, error: { code: 'negative', message: 'Нельзя убавить больше, чем есть в заказе' } };

    let remaining = amount;
    const newLines = [...this.lines];
    const changes: OrderEffect[] = [];

    // сначала supplement-строки (REORDER, PAYMENT и т.д.), потом COLLECTION
    const sorted = [...userLines].sort((a, b) => Number(a.isBase) - Number(b.isBase));
    for (const line of sorted) {
        if (remaining <= 0) break;
        if (line.quantity === 0) continue;
        const take = Math.min(remaining, line.quantity);
        const newQty = line.quantity - take;
        remaining -= take;
        if (newQty === 0) {
            // hard_delete
            const idx = newLines.indexOf(line);
            newLines.splice(idx, 1);
            changes.push({ type: 'delete', lineId: line.id });
        } else {
            const amountDue = computeAmountDue(newQty, this.item);
            const updated = line.withQuantity(newQty, amountDue);
            const idx = newLines.indexOf(line);
            newLines[idx] = updated;
            changes.push({ type: 'upsert', ... });
        }
    }

    return { ok: true, book: this.withLines(newLines), changes };
}

/** Admin: добавить amount к суммарному количеству (bulk). */
adminAdd(userId: number, amount: number): AdjustResult {
    if (amount <= 0) return { ok: false, error: { code: 'negative', message: '...' } };
    // Простое правило: добавляем к COLLECTION-строке (если есть), иначе создаём новую.
    // Нужно уточнить — см. открытые вопросы.
    ...
}

/** Admin: установить точное суммарное qty. */
adminSetQuantity(userId: number, qty: number): AdjustResult {
    if (qty < 0) return { ok: false, error: { code: 'negative', message: '...' } };
    // Если qty=0 → удалить все строки юзера.
    // Если qty>0 → установить через дельту (adminAdd или adminDecrease).
    ...
}
```

### 2. Возможные новые `OrderErrorCode`

Не нужны — `'negative'` уже есть и покрывает «нельзя убавить больше, чем есть» и «amount <= 0».

### 3. Не трогаем

- `adjust`, `adjustPackages` — без изменений.
- `STAGE_RULES` (COLLECTION_RULE, REORDER_RULE, PAYMENT_PLUS_RULE) — без изменений.
- `displayContextFor`, `poolFor`, `freezeBaseQuantities` — без изменений.
- COLLECTION/REORDER-тесты — не должны сломаться (admin-методы новые, ничего не перезаписывают).

---

## Структура файлов

**Создаём:**

- `shared/types/__tests__/order/payment-plus.test.ts` — user-методы на PAYMENT+ (~20 кейсов).
- `shared/types/__tests__/order/admin.test.ts` — admin-методы на всех этапах (~25 кейсов).

**Редактируем:**

- `shared/types/src/order/order-book.ts` — добавляем `adminDelete`, `adminDecrease`, `adminAdd`, `adminSetQuantity`.

**Не трогаем:**

- `order-line.ts`, `pool.ts`, `aggregation.ts`, `pricing.ts`, `types.ts`.
- `collection.test.ts`, `reorder.test.ts` (уже зелёные).

---

## Критические файлы

- `shared/types/__tests__/order/payment-plus.test.ts` (создаём)
- `shared/types/__tests__/order/admin.test.ts` (создаём)
- `shared/types/src/order/order-book.ts` (добавляем 4 метода)

---

## Запуск

```bash
pnpm -F @zakupki/types test         # COLLECTION (23) + REORDER (42) + PAYMENT+ (~20) + admin (~25) = ~110 кейсов
pnpm -F @zakupki/types typecheck    # EXIT 0
pnpm -F @zakupki/frontend typecheck # EXIT 0
```

---

## Стиль тестов (наследуем)

- Helpers в начале файла, по аналогии с reorder.test.ts.
- `makePaymentItem(overrides?)` — `fulfillmentStatus: 'PAYMENT'`, `targetRemainder: 50`, `supplierPackageAmount: 10`.
- `applyAdjust`, `applyAdminDecrease`, `applyAdminAdd`, `applyAdminSetQuantity`, `applyAdminDelete` — кидают Error на !ok.
- `makeFrozenCollectionLine` — переиспользуем (можно дублировать, 5 строк).
- describe-блоки буквенные (A. — N.), `it` на русском.
- Никаких моков, Prisma, БД.
- Для admin.test.ts — параметризация: каждый сценарий прогоняем на COLLECTION / REORDER / PAYMENT+ (через `forEach` или `it.each`).

---

## Открытые вопросы (уточнить при имплементации или сейчас)

1. **adminAdd куда пишет?**
    - Вариант A: в существующую COLLECTION-строку (если есть), иначе создаёт новую COLLECTION-строку.
    - Вариант B: в существующую supplement-строку (если есть), иначе COLLECTION.
    - Вариант C: создаёт новую supplement-строку с `createdOnStage: текущий статус`.

2. **adminSetQuantity как распределяет по строкам?**
    - Вариант A: всё в COLLECTION-строку (схлопывает несколько строк в одну).
    - Вариант B: пропорционально текущему распределению.
    - Вариант C: оставляет существующую структуру, убавляет/добавляет до нужной суммы.

3. **Порядок убавки в adminDecrease (если несколько строк у юзера):**
    - Юзер сказал «сначала добор, потом база» для REORDER-`adjust(-X)`. Логично adminDecrease делать так же: сначала supplement-строки, потом COLLECTION.
    - **Подтвердить**.

4. **adminAdd для юзера, у которого только supplement-строка (например PAYMENT):**
    - Создаёт вторую supplement-строку? Или увеличивает существующую?

Предлагаю зафиксировать:

- adminDecrease: сначала supplement, потом base (как в `adjustReorder`).
- adminAdd: если есть COLLECTION-строка → увеличиваем её; иначе создаём новую COLLECTION-строку.
- adminSetQuantity: всё в COLLECTION-строку (схлопывание), если qty>0; если qty=0 → удалить все строки юзера.

Если юзер хочет другую семантику — уточним при имплементации.

---

## Самопроверка

- [ ] `pnpm -F @zakupki/types test` — все COLLECTION (23) + REORDER (42) + PAYMENT+ (~20) + admin (~25) зелёные.
- [ ] `pnpm -F @zakupki/types typecheck` — EXIT 0.
- [ ] `pnpm -F @zakupki/frontend typecheck` — EXIT 0.
- [ ] В тестовых файлах нет импортов из `@zakupki/database` / `@prisma/client`.
- [ ] PAYMENT+ тесты не ломают COLLECTION/REORDER.
- [ ] Admin-методы работают одинаково на COLLECTION/REORDER/PAYMENT+.
- [ ] User-`adjust(-X)` на PAYMENT+ по-прежнему запрещён (canDecrease=false).
- [ ] User-`adjustPackages` на PAYMENT+ по-прежнему запрещён (canAddPackages=false).
