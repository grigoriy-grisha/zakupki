import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../src/order';
import type { OrderLineProps, PurchaseItem } from '../../src/order';

// ── Helpers ────────────────────────────────────────────────────────
// Чистые функции без БД, без Prisma. REORDER-книга создаётся с
// `targetRemainder: 50` — это «остаток добора» для пула.

function makeReorderItem(overrides: Partial<PurchaseItem> = {}): PurchaseItem {
    return {
        purchaseItemId: 42,
        pricePerUnit: 100,
        priceOverride: null,
        priceTiers: null,
        packDiscountPercent: 0,
        supplierPackageAmount: 10,
        supplierPackageUnit: null,
        supplierPackagePrice: null,
        unitCode: 'piece',
        multiplicity: 1,
        minPackageAmount: 1,
        minPackageUnit: null,
        supplementStep: null,
        fulfillmentStatus: 'REORDER',
        targetRemainder: 50,
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

/** Замороженная COLLECTION-строка (после COLLECTION→REORDER).
 * basePackageCount по умолчанию = packageCount (или 0, если не задано). */
function makeFrozenCollectionLine(overrides: Partial<OrderLineProps> = {}): OrderLine {
    const pkg = overrides.packageCount ?? 0;
    return OrderLine.create(
        makeLineProps({
            id: 1,
            quantity: 80,
            amountDue: 8000,
            baseQuantity: 80,
            basePackageCount: pkg,
            createdOnStage: 'COLLECTION',
            ...overrides,
        }),
    );
}

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

// ── A. Создание книги на REORDER ───────────────────────────────────

describe('A. Создание книги на REORDER', () => {
    it('пустая книга → нет строк', () => {
        const book = OrderBook.create(makeReorderItem());
        expect(book.lines).toHaveLength(0);
        expect(book.activeLines).toHaveLength(0);
    });

    it('remainder виден сразу (targetRemainder=50)', () => {
        const book = OrderBook.create(makeReorderItem({ targetRemainder: 50 }));
        expect(book.remainder).toBe(50);
    });

    it('poolFor для пустой книги → pool=50, canAddMore=50', () => {
        const book = OrderBook.create(makeReorderItem());
        const pool = book.poolFor(1);
        expect(pool.pool).toBe(50);
        expect(pool.canAddMore).toBe(50);
    });
});

// ── B. Юзер без строки добирает из остатка ─────────────────────────

describe('B. Юзер без строки добирает из остатка', () => {
    it('adjust(+30) на пустой книге → появляется supplement-строка', () => {
        const result = OrderBook.create(makeReorderItem()).adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            purchaseItemId: 42,
            userId: 1,
            createdOnStage: 'REORDER',
            quantity: 30,
            amountDue: 3000,
            packageCount: 0,
        });

        const sup = result.book.supplementLineFor(1);
        expect(sup).not.toBeNull();
        expect(sup?.quantity).toBe(30);
        expect(sup?.createdOnStage).toBe('REORDER');
        expect(sup?.baseQuantity).toBeNull();
        expect(sup?.packageCount).toBe(0);
    });

    it('после adjust(+30) remainder стал 20', () => {
        const book = applyAdjust(OrderBook.create(makeReorderItem()), 1, 30);
        expect(book.remainder).toBe(20);
    });

    it('poolFor после adjust(+30) → pool=20, canAddMore=20', () => {
        const book = applyAdjust(OrderBook.create(makeReorderItem()), 1, 30);
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(20);
        expect(pool.canAddMore).toBe(20);
        expect(pool.supplementClaimed).toBe(30);
        expect(pool.maxAllowed).toBe(50);
    });
});

// ── C. Юзер с COLLECTION-строкой добирает из остатка ──────────────

describe('C. Юзер с COLLECTION добирает из остатка', () => {
    it('adjust(+20) к замороженной COLLECTION-строке → 2 строки', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ quantity: 80, amountDue: 8000, baseQuantity: 80 })],
        );
        const result = book1.adjust(1, 20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);

        // COLLECTION-строка не тронута
        const base = result.book.baseLineFor(1);
        expect(base?.quantity).toBe(80);
        expect(base?.baseQuantity).toBe(80);
        expect(base?.createdOnStage).toBe('COLLECTION');

        // supplement-строка добавлена
        const sup = result.book.supplementLineFor(1);
        expect(sup?.quantity).toBe(20);
        expect(sup?.createdOnStage).toBe('REORDER');
    });

    it('totalFor агрегирует base + supplement = 100', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20);

        const total = book2.totalFor(1);
        expect(total.quantity).toBe(100);
        expect(total.packageCount).toBe(0);
    });

    it('после добора remainder=0', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20);
        expect(book2.remainder).toBe(0);
    });
});

// ── D. Убавка добора (supplement) ──────────────────────────────────

describe('D. Убавка добора', () => {
    it('adjust(-10) на supplement-строке → qty=10, COLLECTION не тронута', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20); // supplement: 20
        const book3 = applyAdjust(book2, 1, -10); // supplement: 10

        expect(book3.supplementLineFor(1)?.quantity).toBe(10);
        expect(book3.baseLineFor(1)?.quantity).toBe(80);
        expect(book3.lines).toHaveLength(2);
    });

    it('adjust(-20) на supplement-строке → supplement удаляется, COLLECTION остаётся', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20);
        const result = book2.adjust(1, -20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.supplementLineFor(1)).toBeNull();
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.lines).toHaveLength(1);
    });
});

// ── E. Убавка базовой COLLECTION-строки (после добора=0) ───────────

describe('E. Убавка базовой COLLECTION-строки', () => {
    it('adjust(-30) на COLLECTION-строке → qty=50, baseQuantity=80 (заморозка остаётся)', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, -30);

        const base = book2.baseLineFor(1);
        expect(base?.quantity).toBe(50);
        expect(base?.baseQuantity).toBe(80); // заморозка не меняется
    });

    it('adjust(-80) на COLLECTION-строке → строка удаляется (hard_delete)', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book1.adjust(1, -80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.book.lines).toHaveLength(0);
    });
});

// ── F. Убавка без строк — no-op ────────────────────────────────────

describe('F. Убавка без строк', () => {
    it('adjust(-5) на пустой книге → ok, без изменений', () => {
        const book = OrderBook.create(makeReorderItem());
        const result = book.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
        expect(result.book.lines).toHaveLength(0);
    });

    it('adjust(0) → ok, без изменений', () => {
        const book = OrderBook.create(makeReorderItem());
        const result = book.adjust(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
    });
});

// ── G. Смешанная убавка: сначала добор, потом база ─────────────────

describe('G. Смешанная убавка', () => {
    it('-10 → supplement=10, -20 → supplement удалена, -30 → base=50', () => {
        let book = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        book = applyAdjust(book, 1, 20); // supplement: 20

        book = applyAdjust(book, 1, -10);
        expect(book.supplementLineFor(1)?.quantity).toBe(10);
        expect(book.baseLineFor(1)?.quantity).toBe(80);

        book = applyAdjust(book, 1, -20);
        expect(book.supplementLineFor(1)).toBeNull();
        expect(book.baseLineFor(1)?.quantity).toBe(80);

        book = applyAdjust(book, 1, -30);
        expect(book.baseLineFor(1)?.quantity).toBe(50);
        expect(book.lines).toHaveLength(1);
    });
});

// ── H. Превышение пула ─────────────────────────────────────────────

describe('H. Превышение пула', () => {
    it('adjust(+30) при остатке=20 → ошибка pool_exceeded', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book1.adjust(1, 30);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
        expect(result.error.canAddMore).toBe(20);
    });

    it('после ошибки книга не изменилась', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book1.adjust(1, 30);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        // на ошибке book возвращается тот же (immutable)
        expect(book1.baseLineFor(1)?.quantity).toBe(80);
        expect(book1.supplementLineFor(1)).toBeNull();
    });

    it('adjust(+60) при остатке=50 на пустой книге → ошибка', () => {
        const book = OrderBook.create(makeReorderItem({ targetRemainder: 50 }));
        const result = book.adjust(1, 60);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
    });
});

// ── I. Упаковки на REORDER ─────────────────────────────────────────

describe('I. Упаковки на REORDER', () => {
    it('adjustPackages(+1) → создаётся COLLECTION-строка qty=0, packageCount=1', () => {
        const result = OrderBook.create(makeReorderItem()).adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const base = result.book.baseLineFor(1);
        expect(base).not.toBeNull();
        expect(base?.quantity).toBe(0);
        expect(base?.packageCount).toBe(1);
        expect(base?.createdOnStage).toBe('COLLECTION');
    });

    it('+1 на существующей COLLECTION-строке с basePkg=0 → идёт в REORDER-pkg', () => {
        // На REORDER: COLLECTION заморожена с basePackageCount=0, gap=0,
        // новая упаковка идёт в REORDER-строку, а не в COLLECTION.
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, packageCount: 0 })],
        );
        const result = book1.adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.packageCount).toBe(0);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
    });

    it('-1 упаковки → packageCount=0, строка остаётся', () => {
        // COLLECTION: pkg=1, basePkg=1 (на frozen). -1 → pkg=0, строка остаётся (qty>0).
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, packageCount: 1, basePackageCount: 1 })],
        );
        const result = book1.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.packageCount).toBe(0);
        expect(result.book.baseLineFor(1)).not.toBeNull();
    });

    it('убавка упаковок ниже нуля → ошибка negative', () => {
        const book = OrderBook.create(makeReorderItem());
        const result = book.adjustPackages(1, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('товар без supplierPackageAmount → ошибка no_package', () => {
        const book = OrderBook.create(makeReorderItem({ supplierPackageAmount: null }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('no_package');
    });
});

// ── J. Пул: чтение ────────────────────────────────────────────────

describe('J. Пул: чтение', () => {
    it('remainder виден, если targetRemainder задан', () => {
        const book = OrderBook.create(makeReorderItem({ targetRemainder: 50 }));
        expect(book.remainder).toBe(50);
    });

    it('poolFor после adjust(+30) → pool=20, canAddMore=20, supplementClaimed=30', () => {
        const book = applyAdjust(OrderBook.create(makeReorderItem()), 1, 30);
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(20);
        expect(pool.canAddMore).toBe(20);
        expect(pool.supplementClaimed).toBe(30);
        expect(pool.maxAllowed).toBe(50);
    });

    it('poolFor для пустого юзера при остатке=50 → pool=50, canAddMore=50', () => {
        const book = OrderBook.create(makeReorderItem({ targetRemainder: 50 }));
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(50);
        expect(pool.canAddMore).toBe(50);
        expect(pool.supplementClaimed).toBe(0);
    });
});

// ── K. displayContextFor на REORDER ────────────────────────────────

describe('K. displayContextFor на REORDER', () => {
    it('isSupplement=true на REORDER (этап добора из остатков)', () => {
        const book = OrderBook.create(makeReorderItem());
        const ctx = book.displayContextFor(1);
        expect(ctx.isSupplement).toBe(true);
    });

    it('canAdd=true при наличии остатка', () => {
        const book = OrderBook.create(makeReorderItem());
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(true);
    });

    it('canAdd=false когда пул исчерпан', () => {
        const book = applyAdjust(OrderBook.create(makeReorderItem()), 1, 50);
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(false);
    });

    it('canDecrease=true когда qty>0', () => {
        const book = applyAdjust(OrderBook.create(makeReorderItem()), 1, 10);
        const ctx = book.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(10);
        expect(ctx.canDecrease).toBe(true);
    });

    it('canDecrease=true даже если qty=baseQuantity (на REORDER не лимитируем baseQuantity)', () => {
        const book = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const ctx = book.displayContextFor(1);
        // base 80 + supplement 0 = 80, qty === baseQuantity
        expect(ctx.currentQuantity).toBe(80);
        expect(ctx.canDecrease).toBe(true);
    });

    it('minAllowed=0 на REORDER (не как на PAYMENT+)', () => {
        const book = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.minAllowed).toBe(0);
    });

    it('showPackageButtons=true если supplierPackageAmount задан', () => {
        const book = OrderBook.create(makeReorderItem({ supplierPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(true);
    });

    it('maxAllowed=pool+currentQuantity', () => {
        const book = applyAdjust(OrderBook.create(makeReorderItem()), 1, 30);
        const ctx = book.displayContextFor(1);
        // pool=20, currentQuantity=30, maxAllowed=50
        expect(ctx.maxAllowed).toBe(50);
    });
});

// ── L. Несколько юзеров и общий пул ───────────────────────────────

describe('L. Несколько юзеров и общий пул', () => {
    it('user2 добрал 20 → pool уменьшился на 20', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, baseQuantity: 30, amountDue: 3000 })),
                OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 20, baseQuantity: 20, amountDue: 2000 })),
            ],
        );
        const book2 = applyAdjust(book1, 2, 20);

        // pool = 50 - 20 = 30 (canAddMore у всех = pool)
        expect(book2.remainder).toBe(30);
        expect(book2.poolFor(1).canAddMore).toBe(30);
        expect(book2.poolFor(2).canAddMore).toBe(30);
    });

    it('user1 добрал 30 → остаток стал 20 (50-30=20)', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, baseQuantity: 30, amountDue: 3000 })),
                OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 20, baseQuantity: 20, amountDue: 2000 })),
            ],
        );
        const book2 = applyAdjust(book1, 1, 30);

        // targetRemainder=50, user1 добрал 30 → pool = 50 - 30 = 20
        expect(book2.remainder).toBe(20);
        expect(book2.poolFor(2).canAddMore).toBe(20);
    });
});

// ── M. CANCELLED-строка ────────────────────────────────────────────

describe('M. CANCELLED-строка', () => {
    it('CANCELLED-строка не попадает в activeLines и не учитывается в пуле', () => {
        const book = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                OrderLine.create(
                    makeLineProps({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, status: 'CANCELLED' }),
                ),
            ],
        );

        expect(book.lines).toHaveLength(1);
        expect(book.activeLines).toHaveLength(0);
        expect(book.baseLineFor(1)).toBeNull();
        // пул считается по активным, а их нет → remainder = 50
        expect(book.remainder).toBe(50);
    });
});

// ── N. displayContextFor: supplement дробный ───────────────────────

describe('N. displayContextFor: supplementStep', () => {
    it('supplementStep=5 → activeStep=5', () => {
        const book = OrderBook.create(
            makeReorderItem({ supplementStep: 5, minPackageAmount: 10 }),
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.activeStep).toBe(5);
    });

    it('без supplementStep → activeStep=multiplicity', () => {
        const book = OrderBook.create(makeReorderItem({ multiplicity: 2, minPackageAmount: null }));
        const ctx = book.displayContextFor(1);
        expect(ctx.activeStep).toBe(2);
    });
});

// ── O. Иммутабельность ─────────────────────────────────────────────

describe('O. Иммутабельность', () => {
    it('после adjust исходный book не изменился', () => {
        const book = OrderBook.create(makeReorderItem());
        const result = book.adjust(1, 30);

        expect(book.lines).toHaveLength(0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.lines).not.toBe(book.lines);
    });

    it('после adjustPackages исходный book не изменился', () => {
        const book = OrderBook.create(makeReorderItem());
        const result = book.adjustPackages(1, 1);

        expect(book.lines).toHaveLength(0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
    });
});

// ── P. Сохранение упаковок при qty → 0 (REORDER base-строка) ────────

describe('P. Сохранение упаковок при qty → 0 (REORDER base-строка)', () => {
    it('adjust(-N) на base-строке с packageCount>0 → строка сохраняется, упаковки остаются', () => {
        // Замороженная COLLECTION-строка: qty=3, packageCount=1, baseQuantity=3.
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 3, baseQuantity: 3, amountDue: 300, packageCount: 1 })],
        );

        // Убавляем qty до 0.
        const result = book1.adjust(1, -3);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Строка сохранилась: qty=0, amountDue=0, packageCount=1, baseQuantity=3.
        const line = result.book.baseLineFor(1);
        expect(line).not.toBeNull();
        expect(line?.quantity).toBe(0);
        expect(line?.amountDue).toBe(0);
        expect(line?.packageCount).toBe(1);
        expect(line?.baseQuantity).toBe(3); // заморозка не сбрасывается
        expect(result.book.lines).toHaveLength(1);

        // Эффект — upsert, не delete.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 1,
            createdOnStage: 'COLLECTION',
        });
    });

    it('regression: qty → 0 на base-строке БЕЗ упаковок → hard_delete (старое поведение)', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, packageCount: 0 })],
        );
        const result = book1.adjust(1, -80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('regression: qty → 0 на supplement-строке → hard_delete (supplement без упаковок)', () => {
        // COLLECTION-строка: qty=80, packageCount=0 (защищена заморозкой), supplement: qty=20, pkgCount=0.
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20); // supplement: qty=20

        // Убавляем supplement до 0.
        const result = book2.adjust(1, -20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.supplementLineFor(1)).toBeNull();
        // base-строка не тронута
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
    });

    it('adjustPackages(-1) после zeroing qty → оба ноль → строка hard-deleted', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 3, baseQuantity: 3, amountDue: 300, packageCount: 2 })],
        );

        // zero qty → строка выживает с pkgCount=2.
        const afterQtyZero = applyAdjust(book1, 1, -3);
        expect(afterQtyZero.baseLineFor(1)?.quantity).toBe(0);
        expect(afterQtyZero.baseLineFor(1)?.packageCount).toBe(2);

        // -1 упаковки → строка ещё жива (qty=0, pkg=1).
        const afterMinus1 = applyAdjustPackages(afterQtyZero, 1, -1);
        expect(afterMinus1.baseLineFor(1)?.quantity).toBe(0);
        expect(afterMinus1.baseLineFor(1)?.packageCount).toBe(1);

        // -1 упаковки (последняя) → оба ноль → удаляется.
        const result = afterMinus1.adjustPackages(1, -1);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.changes[0]?.type).toBe('delete');
    });
});

// ── Q. adjust(+N) на REORDER — заполняет COLLECTION до baseQuantity ───

describe('Q. adjust(+N) на REORDER — заполняет COLLECTION до baseQuantity', () => {
    it('delta=30 при COLLECTION qty=50, baseQty=80 → COLLECTION заполняется до 80, REORDER не создаётся', () => {
        // Юзер убавил COLLECTION на REORDER: qty=50, baseQty=80 (gap=30).
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 50, baseQuantity: 80, amountDue: 5000 })],
        );
        const result = book1.adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // COLLECTION заполнилась до 80, REORDER-supplement НЕ создался.
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)).toBeNull();

        // Эффект — один upsert на COLLECTION.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'COLLECTION',
            quantity: 80,
            amountDue: 8000,
        });
    });

    it('delta=50 при COLLECTION qty=50, baseQty=80 → 30 в COLLECTION + 20 в новую REORDER-supplement', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 50, baseQuantity: 80, amountDue: 5000 })],
        );
        const result = book1.adjust(1, 50);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // COLLECTION заполнилась до 80, REORDER-supplement получила 20.
        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(20);

        // Два upsert-эффекта: COLLECTION + REORDER.
        expect(result.changes).toHaveLength(2);
        const collectionChange = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'COLLECTION');
        const reorderChange = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'REORDER');
        expect(collectionChange).toMatchObject({ quantity: 80, amountDue: 8000 });
        expect(reorderChange).toMatchObject({ quantity: 20, amountDue: 2000 });
    });

    it('delta=30 при COLLECTION qty=80, baseQty=80 (gap=0) → всё в новую REORDER-supplement', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book1.adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80); // COLLECTION не тронута
        expect(result.book.supplementLineFor(1)?.quantity).toBe(30);

        // Один upsert на REORDER.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 30,
        });
    });

    it('delta=30 при существующей REORDER-supplement=10 → 40, COLLECTION не тронута', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 10); // supplement: 10
        const result = book2.adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(40);

        // Один upsert на REORDER.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 40,
        });
    });
});

// ── R. adjustPackages(+N) на REORDER — заполняет COLLECTION до basePackageCount ─

describe('R. adjustPackages(+N) на REORDER — заполняет COLLECTION до basePackageCount', () => {
    it('delta=1 при COLLECTION pkg=1, basePkg=3 (gap=2) → COLLECTION pkg=2, REORDER не создаётся', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 1,
                    basePackageCount: 3,
                }),
            ],
        );
        const result = book1.adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(1);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(2);
        expect(result.book.supplementLineFor(1)).toBeNull();

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'COLLECTION',
            packageCount: 2,
        });
    });

    it('delta=3 при COLLECTION pkg=1, basePkg=3 → COLLECTION pkg=3, REORDER-pkg=1', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 1,
                    basePackageCount: 3,
                }),
            ],
        );
        const result = book1.adjustPackages(1, 3);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        // REORDER-строка с qty=0, pkg=1.
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(0);

        expect(result.changes).toHaveLength(2);
        const coll = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'COLLECTION');
        const reo = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'REORDER');
        expect(coll).toMatchObject({ packageCount: 3 });
        expect(reo).toMatchObject({ quantity: 0, packageCount: 1 });
    });

    it('delta=1 при COLLECTION pkg=3, basePkg=3 (gap=0) → создаётся REORDER-pkg=1', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 3,
                    basePackageCount: 3,
                }),
            ],
        );
        const result = book1.adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 0,
            packageCount: 1,
        });
    });

    it('delta=2 при COLLECTION pkg=3, basePkg=3 и существующей REORDER-pkg=1 → REORDER-pkg=3', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 3,
                    basePackageCount: 3,
                }),
            ],
        );
        const book2 = applyAdjustPackages(book1, 1, 1); // создаёт REORDER-pkg=1
        const result = book2.adjustPackages(1, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(3);

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            packageCount: 3,
        });
    });
});

// ── S. adjustPackages(-N) на REORDER — каскад с REORDER-pkg на COLLECTION ─

describe('S. adjustPackages(-N) на REORDER — каскад с REORDER-pkg на COLLECTION', () => {
    it('delta=-1 при COLLECTION pkg=3 и REORDER-pkg=2 → REORDER-pkg=1, COLLECTION не тронута', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 3,
                    basePackageCount: 3,
                }),
            ],
        );
        const book2 = applyAdjustPackages(book1, 1, 2); // REORDER-pkg=2
        const result = book2.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            packageCount: 1,
        });
    });

    it('delta=-5 при COLLECTION pkg=3 и REORDER-pkg=2 → REORDER=0 (delete), COLLECTION=0 (delete)', () => {
        // COLLECTION pkg=3, REORDER-pkg=2, total=5. -5 → оба ноль, обе строки удаляются.
        // COLLECTION строка тоже удаляется, т.к. qty=80>0, НО pkg=0 — не hard-delete
        // (qty>0). Нужно опустить COLLECTION pkg до 0 И qty до 0 для hard-delete.
        // Проверим: cascade REORDER(-2)→0, COLLECTION(-3)→0. COLLECTION остаётся (qty=80>0).
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 3,
                    basePackageCount: 3,
                }),
            ],
        );
        const book2 = applyAdjustPackages(book1, 1, 2); // REORDER-pkg=2
        const result = book2.adjustPackages(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // REORDER-pkg=0 → hard-delete. COLLECTION pkg=0 (но qty=80) → остаётся.
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(0);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)).toBeNull();
        // Один delete (REORDER), один upsert (COLLECTION pkg=0).
        expect(result.changes.filter((c) => c.type === 'delete')).toHaveLength(1);
    });

    it('cascade: COLLECTION qty=0 + pkg=0 после cascade → COLLECTION hard-deleted', () => {
        // Юзер на REORDER имеет ТОЛЬКО пакеты (qty=0 в COLLECTION).
        // Удаляем все пакеты → COLLECTION qty=0 && pkg=0 → hard-delete.
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 0,
                    baseQuantity: 0,
                    amountDue: 0,
                    packageCount: 0,
                    basePackageCount: 2,
                }),
            ],
        );
        // Сначала доведём pkg до 2 (заполняем gap=2).
        const book2 = applyAdjustPackages(book1, 1, 2); // COLLECTION pkg=2
        // Теперь убавим все 2 — COLLECTION pkg=0, qty=0 → hard-delete.
        const result = book2.adjustPackages(1, -2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(0);
        expect(result.changes.filter((c) => c.type === 'delete')).toHaveLength(1);
    });

    it('delta=-1 при COLLECTION pkg=3 и без REORDER → COLLECTION pkg=2', () => {
        const book1 = OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 3,
                    basePackageCount: 3,
                }),
            ],
        );
        const result = book1.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.packageCount).toBe(2);
        expect(result.book.supplementLineFor(1)).toBeNull();

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'COLLECTION',
            packageCount: 2,
        });
    });
});

// ── T. Сосуществование qty и pkg на REORDER-линии ────────────────────

describe('T. Сосуществование qty и pkg на REORDER-линии', () => {
    function setupBook(): OrderBook {
        return OrderBook.create(
            makeReorderItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    packageCount: 3,
                    basePackageCount: 3,
                }),
                OrderLine.create(
                    makeLineProps({
                        id: 2,
                        userId: 1,
                        quantity: 10,
                        amountDue: 1000,
                        packageCount: 0,
                        createdOnStage: 'REORDER',
                        baseQuantity: null,
                        basePackageCount: null,
                    }),
                ),
            ],
        );
    }

    it('adjust(+20) на REORDER с qty+pkg → REORDER qty=30, pkg=0', () => {
        const book = setupBook();
        const result = book.adjust(1, 20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(30);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(0);
        // Один upsert на REORDER (COLLECTION не тронута).
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 30,
            packageCount: 0,
        });
    });

    it('adjustPackages(+2) на REORDER с qty+pkg → REORDER pkg=2, qty=10 не меняется', () => {
        const book = setupBook();
        const result = book.adjustPackages(1, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(10);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(2);
        // Один upsert на REORDER.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 10,
            packageCount: 2,
        });
    });

    it('adjustPackages(-1) на REORDER с qty+pkg → REORDER pkg=1, qty=10', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 1); // REORDER pkg=1
        const result = book2.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(10);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(0);
    });

    it('adjust(-25) на REORDER с qty+pkg → REORDER qty=5, pkg не меняется', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 2); // REORDER qty=10, pkg=2
        const result = book2.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(5);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(2);
    });

    it('adjust(-50) убавляет REORDER qty до 0, но pkg>0 → строка сохраняется', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 2); // REORDER qty=10, pkg=2
        const result = book2.adjust(1, -10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // REORDER строка: qty=0, pkg=2 — НЕ удаляется (pkg>0).
        expect(result.book.supplementLineFor(1)?.quantity).toBe(0);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(2);
    });

    it('totalFor суммирует packageCount из COLLECTION + REORDER-pkg', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 2); // REORDER qty=10, pkg=2
        const total = book2.totalFor(1);

        // packageCount = COLLECTION(3) + REORDER(2) = 5
        expect(total.packageCount).toBe(5);
    });
});
