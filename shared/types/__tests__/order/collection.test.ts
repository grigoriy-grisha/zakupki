import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../src/order';
import type { OrderLineProps, PurchaseItem } from '../../src/order';

// ── Helpers ────────────────────────────────────────────────────────
// Чистые функции без БД, без Prisma — собираем PurchaseItem и OrderLine
// руками, чтобы было видно все поля.

function makeCollectionItem(overrides: Partial<PurchaseItem> = {}): PurchaseItem {
    return {
        purchaseItemId: 42,
        pricePerUnit: 100,
        priceOverride: null,
        priceTiers: null,
        packDiscountPercent: 0,
        supplierPackageAmount: null,
        supplierPackageUnit: null,
        supplierPackagePrice: null,
        unitCode: 'piece',
        multiplicity: 1,
        minPackageAmount: 1,
        minPackageUnit: null,
        supplementStep: null,
        fulfillmentStatus: 'COLLECTION',
        targetRemainder: null,
        ...overrides,
    };
}

function makeLineProps(overrides: Partial<OrderLineProps> = {}): OrderLineProps {
    return {
        id: 1,
        purchaseItemId: 42,
        userId: 1,
        quantity: 0,
        amountDue: 0,
        packageCount: 0,
        status: 'ACTIVE',
        createdOnStage: 'COLLECTION',
        baseQuantity: null,
        basePackageCount: null,
        ...overrides,
    };
}

/** Прокидываем adjust к следующему шагу. Если что-то пошло не так — кидаем. */
function applyAdjust(book: OrderBook, userId: number, delta: number): OrderBook {
    const result = book.adjust(userId, delta);
    if (!result.ok) throw new Error(`adjust неожиданно упал: ${result.error.message}`);
    return result.book;
}

function applyAdjustPackages(book: OrderBook, userId: number, delta: number): OrderBook {
    const result = book.adjustPackages(userId, delta);
    if (!result.ok) throw new Error(`adjustPackages неожиданно упал: ${result.error.message}`);
    return result.book;
}

// ── A. Создание книги ───────────────────────────────────────────────

describe('A. Создание книги', () => {
    it('пустая книга → нет строк', () => {
        const book = OrderBook.create(makeCollectionItem());
        expect(book.lines).toHaveLength(0);
        expect(book.activeLines).toHaveLength(0);
    });
});

// ── B. Добавление количества ────────────────────────────────────────

describe('B. adjust(+delta) — добавление количества', () => {
    it('юзер без строки заказал +10 → появляется строка с qty=10 и amountDue=1000', () => {
        const book = makeCollectionItem({ pricePerUnit: 100 });
        const result = OrderBook.create(book).adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            purchaseItemId: 42,
            userId: 1,
            createdOnStage: 'COLLECTION',
            quantity: 10,
            amountDue: 1000,
        });

        const line = result.book.baseLineFor(1);
        expect(line).not.toBeNull();
        expect(line?.quantity).toBe(10);
        expect(line?.packageCount).toBe(0);
        expect(line?.createdOnStage).toBe('COLLECTION');
        expect(line?.baseQuantity).toBeNull();
    });

    it('тот же юзер добавил ещё +5 → строка обновляется, не дублируется', () => {
        const book1 = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 10);
        const book2 = applyAdjust(book1, 1, 5);

        expect(book2.lines).toHaveLength(1);
        expect(book2.baseLineFor(1)?.quantity).toBe(15);
        expect(book2.baseLineFor(1)?.amountDue).toBe(1500);
    });

    it('два разных юзера → две независимые строки', () => {
        const book1 = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 10);
        const book2 = applyAdjust(book1, 2, 7);

        expect(book2.lines).toHaveLength(2);
        expect(book2.baseLineFor(1)?.quantity).toBe(10);
        expect(book2.baseLineFor(2)?.quantity).toBe(7);
    });
});

// ── C. Уменьшение количества ────────────────────────────────────────

describe('C. adjust(-delta) — уменьшение количества', () => {
    it('юзер с qty=10 убавил -5 → qty=5, сумма пересчитана', () => {
        const book1 = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 10);
        const book2 = applyAdjust(book1, 1, -5);

        expect(book2.baseLineFor(1)?.quantity).toBe(5);
        expect(book2.baseLineFor(1)?.amountDue).toBe(500);
        expect(book2.lines).toHaveLength(1);
    });

    it('юзер с qty=10 убавил -10 → строка удаляется (hard delete)', () => {
        const book1 = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 10);
        const result = book1.adjust(1, -10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
        expect(result.book.baseLineFor(1)).toBeNull();
    });
});

// ── D. Нулевые дельты ───────────────────────────────────────────────

describe('D. Пустые/нулевые дельты', () => {
    it('delta=0 на пустой книге → ok без изменений', () => {
        const book = OrderBook.create(makeCollectionItem());
        const result = book.adjust(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
    });

    it('delta<0 при qty=0 → ok без ошибки и без изменений', () => {
        const book = OrderBook.create(makeCollectionItem());
        const result = book.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
        expect(result.book.lines).toHaveLength(0);
    });
});

// ── E. Упаковки ─────────────────────────────────────────────────────

describe('E. adjustPackages(±1) — упаковки', () => {
    it('юзер без строки добавил +1 упаковку → строка qty=0, packageCount=1', () => {
        const book = makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 });
        const result = OrderBook.create(book).adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const line = result.book.baseLineFor(1);
        expect(line?.quantity).toBe(0);
        expect(line?.packageCount).toBe(1);
        // amountDue = qty*price + pkgCount*packagePrice = 0 + 1*1000 = 1000
        expect(line?.amountDue).toBe(1000);
        expect(line?.createdOnStage).toBe('COLLECTION');
    });

    it('юзер с +1 упаковкой добавил ещё +1 → packageCount=2, qty не меняется', () => {
        const book1 = applyAdjustPackages(
            OrderBook.create(makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 })),
            1,
            1,
        );
        const book2 = applyAdjustPackages(book1, 1, 1);

        const line = book2.baseLineFor(1);
        expect(line?.quantity).toBe(0);
        expect(line?.packageCount).toBe(2);
        expect(line?.amountDue).toBe(2000);
        expect(book2.lines).toHaveLength(1);
    });

    it('юзер с 1 упаковкой убавил -1 → qty=0 и pkg=0 → строка удаляется', () => {
        const book1 = applyAdjustPackages(
            OrderBook.create(makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 })),
            1,
            1,
        );
        const result = book1.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.book.lines).toHaveLength(0);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toEqual({ type: 'delete', lineId: expect.any(Number) });
    });

    it('убавка ниже нуля (было 0, -1) → ошибка negative', () => {
        const book = OrderBook.create(makeCollectionItem({ supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('товар без supplierPackageAmount → ошибка no_package', () => {
        const book = OrderBook.create(makeCollectionItem({ supplierPackageAmount: null }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('no_package');
    });
});

// ── F. Пул (на COLLECTION его нет) ──────────────────────────────────

describe('F. Пул на COLLECTION отсутствует', () => {
    it('remainder === null', () => {
        const book = OrderBook.create(makeCollectionItem());
        expect(book.remainder).toBeNull();
    });

    it('poolFor → pool=null, maxAllowed=Infinity', () => {
        const book = OrderBook.create(makeCollectionItem());
        const pool = book.poolFor(1);

        expect(pool.pool).toBeNull();
        expect(pool.maxAllowed).toBe(Number.POSITIVE_INFINITY);
        expect(pool.canAddMore).toBe(Number.POSITIVE_INFINITY);
    });
});

// ── G. Чтение строк ─────────────────────────────────────────────────

describe('G. Чтение строк', () => {
    it('COLLECTION-строка видна через baseLineFor и не видна через supplementLineFor', () => {
        const book = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 5);

        expect(book.baseLineFor(1)).not.toBeNull();
        expect(book.supplementLineFor(1)).toBeNull();
    });

    it('CANCELLED-строка не попадает в activeLines', () => {
        const book = OrderBook.create(
            makeCollectionItem({ pricePerUnit: 100 }),
            [OrderLine.create(makeLineProps({ status: 'CANCELLED', quantity: 5, amountDue: 500 }))],
        );

        expect(book.lines).toHaveLength(1);
        expect(book.activeLines).toHaveLength(0);
    });
});

// ── H. displayContextFor ────────────────────────────────────────────

describe('H. displayContextFor — контекст для UI', () => {
    it('packagePrice по умолчанию = pricePerUnit * supplierPackageAmount', () => {
        const book = OrderBook.create(
            makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 }),
        );
        const ctx = book.displayContextFor(1);

        expect(ctx.packagePrice).toBe(1000);
        expect(ctx.showPackageButtons).toBe(true);
    });

    it('явный supplierPackagePrice перебивает расчёт', () => {
        const book = OrderBook.create(
            makeCollectionItem({
                pricePerUnit: 100,
                supplierPackageAmount: 10,
                supplierPackagePrice: 850,
            }),
        );
        const ctx = book.displayContextFor(1);

        expect(ctx.packagePrice).toBe(850);
    });

    it('без supplierPackageAmount → кнопки упаковок скрыты', () => {
        const book = OrderBook.create(makeCollectionItem({ supplierPackageAmount: null }));
        const ctx = book.displayContextFor(1);

        expect(ctx.showPackageButtons).toBe(false);
        expect(ctx.packagePrice).toBe(0);
    });

    it('canAdd=true, canDecrease=true (qty>0), isSoldOut=false, isSupplement=false', () => {
        const book = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 3);
        const ctx = book.displayContextFor(1);

        expect(ctx.canAdd).toBe(true);
        expect(ctx.canDecrease).toBe(true);
        expect(ctx.isSoldOut).toBe(false);
        expect(ctx.isSupplement).toBe(false);
        expect(ctx.currentQuantity).toBe(3);
    });

    it('canDecrease=false если currentQuantity=0', () => {
        const book = OrderBook.create(makeCollectionItem());
        const ctx = book.displayContextFor(1);

        expect(ctx.currentQuantity).toBe(0);
        expect(ctx.canDecrease).toBe(false);
    });
});

// ── I. freezeBaseQuantities ─────────────────────────────────────────

describe('I. Заморозка базы (подготовка к REORDER)', () => {
    it('freezeBaseQuantities проставляет baseQuantity=quantity и basePackageCount=packageCount', () => {
        const book = OrderBook.create(
            makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 }),
            [OrderLine.create(makeLineProps({ quantity: 7, amountDue: 700, packageCount: 2 }))],
        );
        const book2 = applyAdjust(book, 1, 0); // sanity: line exists
        const frozen = book2.freezeBaseQuantities();

        expect(frozen.baseLineFor(1)?.baseQuantity).toBe(7);
        expect(frozen.baseLineFor(1)?.quantity).toBe(7);
        expect(frozen.baseLineFor(1)?.basePackageCount).toBe(2);
        expect(frozen.baseLineFor(1)?.packageCount).toBe(2);
    });
});

// ── J. Сохранение упаковок при qty → 0 (COLLECTION) ─────────────────

describe('J. Сохранение упаковок при qty → 0 (COLLECTION)', () => {
    it('qty → 0 при наличии упаковок → строка сохраняется, упаковки остаются', () => {
        // Создаём строку: qty=2, packageCount=1 (например, добавили 1 упаковку поверх 2 единиц).
        const book1 = OrderBook.create(
            makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 }),
            [OrderLine.create(makeLineProps({ quantity: 2, amountDue: 200, packageCount: 1 }))],
        );

        // Убавляем qty до 0.
        const result = book1.adjust(1, -2);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Строка сохранилась.
        const line = result.book.baseLineFor(1);
        expect(line).not.toBeNull();
        expect(line?.quantity).toBe(0);
        expect(line?.amountDue).toBe(0);
        expect(line?.packageCount).toBe(1); // упаковки целы
        expect(result.book.lines).toHaveLength(1);

        // Эффект — upsert (не delete), с сохранённым packageCount.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 1,
        });
    });

    it('adjustPackages(-1) после zeroing qty → строка hard-deleted', () => {
        // Строка: qty=2, packageCount=2.
        const book1 = OrderBook.create(
            makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 }),
            [OrderLine.create(makeLineProps({ quantity: 2, amountDue: 200, packageCount: 2 }))],
        );

        // Убавляем qty до 0 — строка выживает с pkgCount=2.
        const afterQtyZero = applyAdjust(book1, 1, -2);
        expect(afterQtyZero.baseLineFor(1)?.quantity).toBe(0);
        expect(afterQtyZero.baseLineFor(1)?.packageCount).toBe(2);

        // Убираем обе упаковки — после первой строка жива (qty=0, pkg=1).
        const afterPkgMinus1 = applyAdjustPackages(afterQtyZero, 1, -1);
        expect(afterPkgMinus1.baseLineFor(1)?.quantity).toBe(0);
        expect(afterPkgMinus1.baseLineFor(1)?.packageCount).toBe(1);

        // Убираем последнюю упаковку — оба ноль, строка удаляется.
        const result = afterPkgMinus1.adjustPackages(1, -1);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.book.lines).toHaveLength(0);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.type).toBe('delete');
    });

    it('regression: qty → 0 без упаковок → hard_delete (старое поведение)', () => {
        const book1 = applyAdjust(OrderBook.create(makeCollectionItem({ pricePerUnit: 100 })), 1, 5);
        const result = book1.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('убавка qty до 0 с упаковками НЕ сбрасывает baseQuantity=null', () => {
        const book1 = OrderBook.create(
            makeCollectionItem({ pricePerUnit: 100, supplierPackageAmount: 10 }),
            [OrderLine.create(makeLineProps({ quantity: 3, amountDue: 300, packageCount: 2, baseQuantity: null }))],
        );

        const result = book1.adjust(1, -3);
        if (!result.ok) throw new Error('expected ok');

        const line = result.book.baseLineFor(1);
        expect(line?.baseQuantity).toBeNull(); // не трогаем
        expect(line?.packageCount).toBe(2);
    });
});
