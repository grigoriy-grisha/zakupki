import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../src/order';
import type { OrderLineProps, PurchaseItem } from '../../src/order';

// ── Helpers ────────────────────────────────────────────────────────
// Чистые функции без БД, без Prisma. PAYMENT-книга создаётся с
// `targetRemainder: 50` — это «остаток добора» для пула. Упаковки заданы
// (supplierPackageAmount=10), чтобы можно было проверить их запрет.

function makePaymentItem(overrides: Partial<PurchaseItem> = {}): PurchaseItem {
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
        fulfillmentStatus: 'PAYMENT',
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
        createdOnStage: 'PAYMENT',
        baseQuantity: null,
        basePackageCount: null,
        ...overrides,
    };
}

/** Замороженная COLLECTION-строка (после COLLECTION→REORDER→PAYMENT).
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

// ── A. Создание книги на PAYMENT ───────────────────────────────────

describe('A. Создание книги на PAYMENT', () => {
    it('пустая книга → нет строк', () => {
        const book = OrderBook.create(makePaymentItem());
        expect(book.lines).toHaveLength(0);
        expect(book.activeLines).toHaveLength(0);
    });

    it('remainder виден сразу (targetRemainder=50)', () => {
        const book = OrderBook.create(makePaymentItem({ targetRemainder: 50 }));
        expect(book.remainder).toBe(50);
    });

    it('poolFor для пустой книги → pool=50, canAddMore=50', () => {
        const book = OrderBook.create(makePaymentItem());
        const pool = book.poolFor(1);
        expect(pool.pool).toBe(50);
        expect(pool.canAddMore).toBe(50);
    });
});

// ── B. Юзер без строки берёт из остатка ───────────────────────────

describe('B. Юзер берёт из остатка', () => {
    it('adjust(+30) на пустой книге → появляется supplement-строка PAYMENT', () => {
        const result = OrderBook.create(makePaymentItem()).adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            purchaseItemId: 42,
            userId: 1,
            createdOnStage: 'PAYMENT',
            quantity: 30,
            amountDue: 3000,
        });

        const sup = result.book.supplementLineFor(1);
        expect(sup).not.toBeNull();
        expect(sup?.quantity).toBe(30);
        expect(sup?.createdOnStage).toBe('PAYMENT');
        expect(sup?.baseQuantity).toBeNull();
        expect(sup?.packageCount).toBe(0);
    });

    it('после adjust(+30) remainder стал 20', () => {
        const book = applyAdjust(OrderBook.create(makePaymentItem()), 1, 30);
        expect(book.remainder).toBe(20);
    });

    it('poolFor после adjust(+30) → pool=20, canAddMore=20, maxAllowed=50', () => {
        const book = applyAdjust(OrderBook.create(makePaymentItem()), 1, 30);
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(20);
        expect(pool.canAddMore).toBe(20);
        expect(pool.maxAllowed).toBe(50);
        expect(pool.supplementClaimed).toBe(30);
    });
});

// ── C. Увеличение существующей supplement-строки разрешено ─────────

describe('C. Увеличение supplement-строки разрешено', () => {
    it('adjust(+10) к существующей supplement-строке → qty=40', () => {
        const book1 = applyAdjust(OrderBook.create(makePaymentItem({ targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(40);
        expect(result.book.supplementLineFor(1)?.amountDue).toBe(4000);
    });

    it('после успешного увеличения книга изменилась', () => {
        const book1 = applyAdjust(OrderBook.create(makePaymentItem({ targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, 10);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.remainder).toBe(10);
    });
});

// ── D. Убавка supplement-строки разрешена ──────────────────────────

describe('D. Убавка supplement-строки разрешена', () => {
    it('adjust(-5) на supplement-строке → qty=25', () => {
        const book1 = applyAdjust(OrderBook.create(makePaymentItem({ targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(25);
        expect(result.book.remainder).toBe(25);
    });

    it('adjust(-30) на supplement-строке qty=30 → строка удаляется', () => {
        const book1 = applyAdjust(OrderBook.create(makePaymentItem({ targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, -30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)).toBeNull();
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.remainder).toBe(50);
    });
});

// ── D2. COLLECTION-строка (замороженная) — НЕЛЬЗЯ менять ───────────

describe('D2. COLLECTION-строка (замороженная) защищена', () => {
    it('adjust(-5) на юзере с COLLECTION-строкой (без supplement) → forbidden', () => {
        // Юзер с замороженной COLLECTION-строкой (qty=80, baseQuantity=80) — нет supplement.
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book.adjust(1, -5);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('forbidden');
    });

    it('adjust(+5) к COLLECTION-строке (без supplement) → идёт в supplement', () => {
        // У юзера замороженная COLLECTION-строка. adjust(+5) должен создать supplement, не увеличивать COLLECTION.
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book.adjust(1, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80); // COLLECTION не тронута
        expect(result.book.supplementLineFor(1)?.quantity).toBe(5); // supplement создан
    });
});

// ── E. Упаковки на PAYMENT+ запрещены ──────────────────────────────

describe('E. Упаковки запрещены', () => {
    it('adjustPackages(+1) → ошибка forbidden', () => {
        const book = OrderBook.create(makePaymentItem({ supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('forbidden');
    });

    it('adjustPackages(-1) на пустой → ошибка forbidden', () => {
        const book = OrderBook.create(makePaymentItem({ supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('forbidden');
    });

    it('adjustPackages НЕ создаёт COLLECTION-строку', () => {
        const book = OrderBook.create(makePaymentItem({ supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        // даже при ошибке книга не изменилась
        expect(book.lines).toHaveLength(0);
    });
});

// ── F. Превышение пула ─────────────────────────────────────────────

describe('F. Превышение пула', () => {
    it('adjust(+60) при остатке=50 → ошибка pool_exceeded', () => {
        const book = OrderBook.create(makePaymentItem({ targetRemainder: 50 }));
        const result = book.adjust(1, 60);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
        expect(result.error.canAddMore).toBe(50);
    });

    it('user1 взял 30, user2 берёт 30 → pool_exceeded canAddMore=20', () => {
        const book1 = applyAdjust(OrderBook.create(makePaymentItem()), 1, 30);
        const result = book1.adjust(2, 30);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('pool_exceeded');
        expect(result.error.canAddMore).toBe(20);
    });
});

// ── G. COLLECTION-строка из предыдущего этапа ──────────────────────

describe('G. COLLECTION-строка из предыдущего этапа', () => {
    it('adjust(+20) при наличии COLLECTION-строки → две строки, supplement=20', () => {
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20);

        expect(book2.lines).toHaveLength(2);
        expect(book2.baseLineFor(1)?.quantity).toBe(80);
        expect(book2.supplementLineFor(1)?.quantity).toBe(20);
        expect(book2.supplementLineFor(1)?.createdOnStage).toBe('PAYMENT');
    });

    it('totalFor агрегирует base + supplement = 100', () => {
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 20 }),
            [makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20);

        const total = book2.totalFor(1);
        expect(total.quantity).toBe(100);
    });
});

// ── H. displayContextFor на PAYMENT+ ───────────────────────────────

describe('H. displayContextFor на PAYMENT+', () => {
    it('isSupplement=true', () => {
        const book = OrderBook.create(makePaymentItem());
        const ctx = book.displayContextFor(1);
        expect(ctx.isSupplement).toBe(true);
    });

    it('minAllowed=frozenBase (на PAYMENT+ нельзя ниже базы)', () => {
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.minAllowed).toBe(80);
    });

    it('canAdd=true при наличии остатка', () => {
        const book = OrderBook.create(makePaymentItem());
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(true);
    });

    it('canAdd=false когда пул исчерпан', () => {
        const book = applyAdjust(OrderBook.create(makePaymentItem()), 1, 50);
        const ctx = book.displayContextFor(1);
        expect(ctx.canAdd).toBe(false);
    });

    it('canDecrease=true если currentQuantity > frozenBase (есть добор)', () => {
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 20);
        const ctx = book2.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(100);
        expect(ctx.canDecrease).toBe(true);
    });

    it('canDecrease=false если currentQuantity === frozenBase (только база)', () => {
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(80);
        expect(ctx.canDecrease).toBe(false);
    });

    it('showPackageButtons=false (canAddPackages=false)', () => {
        const book = OrderBook.create(makePaymentItem({ supplierPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(false);
    });

    it('activeStep учитывает supplementStep', () => {
        const book = OrderBook.create(makePaymentItem({ supplementStep: 5, minPackageAmount: 10 }));
        const ctx = book.displayContextFor(1);
        expect(ctx.activeStep).toBe(5);
    });
});

// ── I. Несколько юзеров ────────────────────────────────────────────

describe('I. Несколько юзеров', () => {
    it('user1 взял 30 → user2 может взять ещё 20', () => {
        const book = applyAdjust(OrderBook.create(makePaymentItem()), 1, 30);
        const pool = book.poolFor(2);
        expect(pool.canAddMore).toBe(20);
    });

    it('user2 взял 20 → user1 canAddMore=0', () => {
        const book1 = applyAdjust(OrderBook.create(makePaymentItem()), 1, 30);
        const book2 = applyAdjust(book1, 2, 20);
        const pool = book2.poolFor(1);
        expect(pool.canAddMore).toBe(0);
    });
});

// ── J. CANCELLED-строка ────────────────────────────────────────────

describe('J. CANCELLED-строка', () => {
    it('CANCELLED-строка не попадает в activeLines', () => {
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        status: 'CANCELLED',
                        createdOnStage: 'COLLECTION',
                    }),
                ),
            ],
        );

        expect(book.lines).toHaveLength(1);
        expect(book.activeLines).toHaveLength(0);
        expect(book.baseLineFor(1)).toBeNull();
        // пул считается по активным → remainder = 50
        expect(book.remainder).toBe(50);
    });
});

// ── K. Иммутабельность ─────────────────────────────────────────────

describe('K. Иммутабельность', () => {
    it('после adjust исходный book не изменился', () => {
        const book = OrderBook.create(makePaymentItem());
        const result = book.adjust(1, 30);

        expect(book.lines).toHaveLength(0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.lines).not.toBe(book.lines);
    });
});

// ── L. createdOnStage consistency на PAYMENT+ past PAYMENT ────────────

describe('L. createdOnStage consistency на PAYMENT+ past PAYMENT', () => {
    it('adjust(+30) на SUPPLIER_ASSEMBLY → supplement-строка createdOnStage=SUPPLIER_ASSEMBLY', () => {
        const item = makePaymentItem({ fulfillmentStatus: 'SUPPLIER_ASSEMBLY', targetRemainder: 50 });
        const result = OrderBook.create(item).adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'SUPPLIER_ASSEMBLY',
            quantity: 30,
        });

        const sup = result.book.supplementLineFor(1);
        expect(sup).not.toBeNull();
        expect(sup?.createdOnStage).toBe('SUPPLIER_ASSEMBLY');
    });

    it('displayContextFor находит supplement-строку через supplementLineFor', () => {
        const item = makePaymentItem({ fulfillmentStatus: 'SUPPLIER_ASSEMBLY', targetRemainder: 50 });
        const book = applyAdjust(OrderBook.create(item), 1, 30);
        const ctx = book.displayContextFor(1);

        expect(ctx.isSupplement).toBe(true);
        expect(ctx.currentQuantity).toBe(30);
    });

    it('повторный adjust(+10) идёт в ту же supplement-строку (не создаёт новую)', () => {
        const item = makePaymentItem({ fulfillmentStatus: 'SUPPLIER_ASSEMBLY', targetRemainder: 50 });
        const book1 = applyAdjust(OrderBook.create(item), 1, 30);
        const result = book1.adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(1);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(40);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            createdOnStage: 'SUPPLIER_ASSEMBLY',
            quantity: 40,
        });
    });
});

// ── M. basePackageCount переживает PAYMENT+ ──────────────────────────

describe('M. basePackageCount переживает PAYMENT+', () => {
    it('totalFor агрегирует basePackageCount из COLLECTION-строки', () => {
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
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
        const total = book.totalFor(1);

        expect(total.basePackageCount).toBe(3);
        expect(total.baseQuantity).toBe(80);
        expect(total.packageCount).toBe(3);
    });
});

// ── N. PAYMENT+ добавление при существующей REORDER-строке → новая PAYMENT-строка ──

describe('N. PAYMENT+ не переиспользует REORDER-строку', () => {
    it('adjust(+5) при наличии REORDER-supplement → новая PAYMENT-строка, REORDER не тронута', () => {
        // Сценарий: юзер на REORDER создал supplement (qty=0, pkg=3), перешёл в PAYMENT.
        // На PAYMENT+ нажимает +5. Ожидаемо: создаётся НОВАЯ orderLine с createdOnStage='PAYMENT',
        // REORDER-строка остаётся как есть.
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 10,
                    baseQuantity: 25,
                    amountDue: 1000,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
                OrderLine.create(
                    makeLineProps({
                        id: 2,
                        userId: 1,
                        quantity: 0,
                        amountDue: 0,
                        packageCount: 3,
                        createdOnStage: 'REORDER',
                        baseQuantity: null,
                        basePackageCount: null,
                    }),
                ),
            ],
        );
        const result = book1.adjust(1, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Создалась НОВАЯ PAYMENT-строка (id=3), REORDER (id=2) не тронута.
        expect(result.book.lines).toHaveLength(3);
        const reorderLine = result.book.lines.find((l) => l.id === 2);
        expect(reorderLine?.quantity).toBe(0);
        expect(reorderLine?.packageCount).toBe(3);
        expect(reorderLine?.createdOnStage).toBe('REORDER');

        const paymentLine = result.book.lines.find((l) => l.createdOnStage === 'PAYMENT');
        expect(paymentLine).toBeDefined();
        expect(paymentLine?.quantity).toBe(5);
        expect(paymentLine?.packageCount).toBe(0);
        expect(paymentLine?.baseQuantity).toBeNull();

        // Эффект — upsert с createdOnStage='PAYMENT', не 'REORDER'.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'PAYMENT',
            quantity: 5,
            amountDue: 500,
        });
    });

    it('повторный adjust(+3) на PAYMENT+ → пишет в ту же PAYMENT-строку', () => {
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 10,
                    baseQuantity: 25,
                    amountDue: 1000,
                }),
                OrderLine.create(
                    makeLineProps({
                        id: 2,
                        userId: 1,
                        quantity: 0,
                        amountDue: 0,
                        packageCount: 3,
                        createdOnStage: 'REORDER',
                    }),
                ),
            ],
        );
        const book2 = applyAdjust(book1, 1, 5); // создаёт PAYMENT-строку
        const result = book2.adjust(1, 3);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Должна быть 1 PAYMENT-строка, обновлённая до 8. REORDER — отдельно.
        const paymentLines = result.book.lines.filter((l) => l.createdOnStage === 'PAYMENT');
        expect(paymentLines).toHaveLength(1);
        expect(paymentLines[0]?.quantity).toBe(8);
    });

    it('totalFor агрегирует COLLECTION+REORDER+PAYMENT = 10+0+5=15 qty, 1+3+0=4 pkg', () => {
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 10,
                    baseQuantity: 25,
                    amountDue: 1000,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
                OrderLine.create(
                    makeLineProps({
                        id: 2,
                        userId: 1,
                        quantity: 0,
                        amountDue: 0,
                        packageCount: 3,
                        createdOnStage: 'REORDER',
                    }),
                ),
            ],
        );
        const book2 = applyAdjust(book1, 1, 5);

        const total = book2.totalFor(1);
        expect(total.quantity).toBe(15);
        expect(total.packageCount).toBe(4);
        expect(total.baseQuantity).toBe(25);
        expect(total.basePackageCount).toBe(1);
        expect(total.amountDue).toBe(1500);
    });

    it('canDecrease=false при currentQuantity === frozenBase (только база, REORDER/PAYMENT=0)', () => {
        // COLLECTION qty=10, frozenBase=25, REORDER qty=0, нет PAYMENT-строки.
        // currentQuantity=10 < frozenBase=25 → убавлять нельзя.
        const book = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 10,
                    baseQuantity: 25,
                    amountDue: 1000,
                }),
                OrderLine.create(
                    makeLineProps({
                        id: 2,
                        userId: 1,
                        quantity: 0,
                        amountDue: 0,
                        packageCount: 3,
                        createdOnStage: 'REORDER',
                    }),
                ),
            ],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(10);
        expect(ctx.canDecrease).toBe(false);
        expect(ctx.minAllowed).toBe(25);
    });

    it('canDecrease=true при currentQuantity > frozenBase (есть PAYMENT-supplement)', () => {
        // COLLECTION qty=30, frozenBase=30 + PAYMENT qty=10 → current=40 > frozenBase=30 → можно убавить.
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 30,
                    baseQuantity: 30,
                    amountDue: 3000,
                }),
            ],
        );
        const book2 = applyAdjust(book1, 1, 10); // PAYMENT-строка qty=10
        const ctx = book2.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(40);
        expect(ctx.canDecrease).toBe(true);
        expect(ctx.minAllowed).toBe(30);
    });

    it('supplementClaimed считает REORDER + PAYMENT (не только PAYMENT)', () => {
        // REORDER qty=10, PAYMENT qty=5 → supplementClaimed=15.
        const book1 = OrderBook.create(
            makePaymentItem({ targetRemainder: 50 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    quantity: 10,
                    baseQuantity: 25,
                    amountDue: 1000,
                }),
                OrderLine.create(
                    makeLineProps({
                        id: 2,
                        userId: 1,
                        quantity: 10,
                        amountDue: 1000,
                        createdOnStage: 'REORDER',
                    }),
                ),
            ],
        );
        const book2 = applyAdjust(book1, 1, 5); // PAYMENT qty=5

        // user2: pool = targetRemainder(50) - supplementClaimed(15) = 35.
        const pool = book2.poolFor(2);
        expect(pool.pool).toBe(35);
        expect(pool.supplementClaimed).toBe(15);
    });
});
