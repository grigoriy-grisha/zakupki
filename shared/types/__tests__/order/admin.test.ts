import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../src/order';
import type { OrderLineProps, PurchaseItem } from '../../src/order';

// ── Helpers ────────────────────────────────────────────────────────
// Admin-методы (`adminDelete`, `adminDecrease`, `adminAdd`, `adminSetQuantity`)
// работают В ОБХОД правил этапа. Тестируем их на каждом этапе, чтобы убедиться,
// что поведение одинаковое.

function makeItem(
    fulfillmentStatus: PurchaseItem['fulfillmentStatus'],
    overrides: Partial<PurchaseItem> = {},
): PurchaseItem {
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
        minPackageAmount: null,
        minPackageUnit: null,
        supplementStep: null,
        fulfillmentStatus,
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

function applyAdminDelete(book: OrderBook, userId: number): OrderBook {
    const result = book.adminDelete(userId);
    if (!result.ok) throw new Error(`adminDelete неожиданно упал: ${result.error.message}`);
    return result.book;
}

function applyAdminDecrease(book: OrderBook, userId: number, amount: number): OrderBook {
    const result = book.adminDecrease(userId, amount);
    if (!result.ok) throw new Error(`adminDecrease неожиданно упал: ${result.error.message}`);
    return result.book;
}

function applyAdminAdd(book: OrderBook, userId: number, amount: number): OrderBook {
    const result = book.adminAdd(userId, amount);
    if (!result.ok) throw new Error(`adminAdd неожиданно упал: ${result.error.message}`);
    return result.book;
}

function applyAdminSetQuantity(book: OrderBook, userId: number, qty: number): OrderBook {
    const result = book.adminSetQuantity(userId, qty);
    if (!result.ok) throw new Error(`adminSetQuantity неожиданно упал: ${result.error.message}`);
    return result.book;
}

// Все три этапа, на которых admin-методы должны работать одинаково.
const STAGES: PurchaseItem['fulfillmentStatus'][] = ['COLLECTION', 'REORDER', 'PAYMENT'];

// ── A. adminDelete ─────────────────────────────────────────────────

describe('A. adminDelete — удаление всех строк юзера', () => {
    it('COLLECTION+PAYMENT: удаляет обе строки', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, createdOnStage: 'COLLECTION' })),
                OrderLine.create(makeLineProps({ id: 2, userId: 1, quantity: 20, amountDue: 2000, createdOnStage: 'PAYMENT' })),
            ],
        );
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toHaveLength(2);
        expect(result.changes.every((c) => c.type === 'delete')).toBe(true);
        expect(result.book.lines).toHaveLength(0);
    });

    it('только COLLECTION → удаляется одна строка', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('только PAYMENT-supplement → удаляется', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }))],
        );
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(0);
    });

    it('нет строк у юзера → no-op ok, без изменений', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
        expect(result.book.lines).toHaveLength(0);
    });

    it('другой юзер не задет', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' })),
                OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 50, amountDue: 5000, createdOnStage: 'PAYMENT' })),
            ],
        );
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.supplementLineFor(2)?.quantity).toBe(50);
    });

    it('immutable: исходный book не изменился', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }))],
        );
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(book.lines).toHaveLength(1);
        expect(result.book.lines).toHaveLength(0);
        expect(result.book.lines).not.toBe(book.lines);
    });
});

// ── B. adminDecrease ───────────────────────────────────────────────

describe('B. adminDecrease — убавка в обход canDecrease', () => {
    it('COLLECTION: qty 80 → 50, baseQuantity не меняется', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }))],
        );
        const book2 = applyAdminDecrease(book, 1, 30);

        expect(book2.lines).toHaveLength(1);
        const line = book2.lines[0];
        expect(line?.quantity).toBe(50);
        expect(line?.baseQuantity).toBe(80);
        expect(line?.amountDue).toBe(5000);
    });

    it('qty 80 → adminDecrease(80) → hard_delete', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminDecrease(1, 80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('COLLECTION+PAYMENT (80+20=100) → adminDecrease(30) → PAYMENT=0 (delete), COLLECTION=70', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, createdOnStage: 'COLLECTION' })),
                OrderLine.create(makeLineProps({ id: 2, userId: 1, quantity: 20, amountDue: 2000, createdOnStage: 'PAYMENT' })),
            ],
        );
        const result = book.adminDecrease(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // PAYMENT (supplement) удалилась сначала, COLLECTION убавилась на 10
        expect(result.changes).toHaveLength(2);
        expect(result.changes.find((c) => c.type === 'delete')).toBeDefined();
        expect(result.book.lines).toHaveLength(1);
        const remaining = result.book.lines[0];
        expect(remaining?.quantity).toBe(70);
        expect(remaining?.createdOnStage).toBe('COLLECTION');
    });

    it('amount > qty → ошибка negative', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminDecrease(1, 100);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('amount <= 0 → ошибка negative', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminDecrease(1, 0);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('нет строк у юзера → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adminDecrease(1, 10);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });
});

// ── C. adminAdd ────────────────────────────────────────────────────

describe('C. adminAdd — добавка в обход canIncrease/canAddNew/poolApplies', () => {
    it('COLLECTION: qty 80 → 110', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminAdd(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 110,
            amountDue: 11000,
            createdOnStage: 'COLLECTION',
        });
        expect(result.book.lines[0]?.quantity).toBe(110);
    });

    it('нет строк → создаётся новая COLLECTION-строка', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adminAdd(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(10);
        expect(line?.createdOnStage).toBe('COLLECTION');
        expect(line?.baseQuantity).toBeNull();
    });

    it('PAYMENT+: работает в обход canIncrease=false (и в обход canAddPackages)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 0 }));
        const result = book.adminAdd(1, 50);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines[0]?.quantity).toBe(50);
    });

    it('amount <= 0 → ошибка negative', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminAdd(1, 0);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('несколько юзеров: adminAdd на user1 не задевает user2', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000 })),
                OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 40, amountDue: 4000 })),
            ],
        );
        const result = book.adminAdd(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines.find((l) => l.userId === 1)?.quantity).toBe(40);
        expect(result.book.lines.find((l) => l.userId === 2)?.quantity).toBe(40);
    });

    it('REORDER: работает на REORDER (как и на COLLECTION)', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adminAdd(1, 25);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines[0]?.quantity).toBe(25);
    });
});

// ── D. adminSetQuantity ────────────────────────────────────────────

describe('D. adminSetQuantity — установка точного qty', () => {
    it('COLLECTION: qty 80 → 100', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminSetQuantity(1, 100);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines[0]?.quantity).toBe(100);
        expect(result.book.lines[0]?.amountDue).toBe(10000);
    });

    it('COLLECTION: qty 80 → 0 → hard_delete', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminSetQuantity(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // Один delete-эффект
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('COLLECTION+PAYMENT (80+20=100) → adminSetQuantity(50) → схлопывание в COLLECTION=50', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, createdOnStage: 'COLLECTION' })),
                OrderLine.create(makeLineProps({ id: 2, userId: 1, quantity: 20, amountDue: 2000, createdOnStage: 'PAYMENT' })),
            ],
        );
        const result = book.adminSetQuantity(1, 50);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // 2 delete + 1 upsert
        expect(result.changes).toHaveLength(3);
        expect(result.book.lines).toHaveLength(1);
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(50);
        expect(line?.createdOnStage).toBe('COLLECTION');
    });

    it('qty < 0 → ошибка negative', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminSetQuantity(1, -10);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('нет строк, qty > 0 → создаётся COLLECTION-строка', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adminSetQuantity(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.lines[0]?.quantity).toBe(30);
    });

    it('qty === текущему → no-op', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminSetQuantity(1, 80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
    });
});

// ── E. Кросс-этапная консистентность ───────────────────────────────

describe('E. Admin-методы работают одинаково на всех этапах', () => {
    for (const stage of STAGES) {
        it(`adminDecrease(30) на этапе ${stage} → убавка работает`, () => {
            const createdOnStage = stage === 'COLLECTION' ? 'COLLECTION' : stage;
            const book = OrderBook.create(
                makeItem(stage),
                [OrderLine.create(makeLineProps({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, createdOnStage }))],
            );
            const result = book.adminDecrease(1, 30);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines[0]?.quantity).toBe(50);
        });

        it(`adminAdd(20) на этапе ${stage} → добавка работает`, () => {
            const book = OrderBook.create(makeItem(stage));
            const result = book.adminAdd(1, 20);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines[0]?.quantity).toBe(20);
        });

        it(`adminDelete на этапе ${stage} → удаление работает`, () => {
            const book = OrderBook.create(
                makeItem(stage),
                [OrderLine.create(makeLineProps({ id: 1, quantity: 50, amountDue: 5000 }))],
            );
            const result = book.adminDelete(1);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines).toHaveLength(0);
        });

        it(`adminSetQuantity(60) на этапе ${stage} → установка работает`, () => {
            const book = OrderBook.create(
                makeItem(stage),
                [OrderLine.create(makeLineProps({ id: 1, quantity: 30, amountDue: 3000 }))],
            );
            const result = book.adminSetQuantity(1, 60);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines[0]?.quantity).toBe(60);
        });
    }
});

// ── F. Admin в обход ограничений pool/user-методов ──────────────────

describe('F. Admin в обход запретов user-методов', () => {
    it('adminDecrease на PAYMENT+ убавляет (admin идёт в обход pool и stage rules)', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }))],
        );

        // user ТОЖЕ может убавить (остатки можно убавлять на PAYMENT+)
        const userResult = book.adjust(1, -10);
        expect(userResult.ok).toBe(true);
        if (!userResult.ok) return;
        expect(userResult.book.lines[0]?.quantity).toBe(20);

        // admin может убавить (с базы 30 сразу)
        const adminResult = book.adminDecrease(1, 10);
        expect(adminResult.ok).toBe(true);
        if (!adminResult.ok) return;
        expect(adminResult.book.lines[0]?.quantity).toBe(20);
    });

    it('adminAdd на PAYMENT+ добавляет (admin идёт в обход pool)', () => {
        const book = OrderBook.create(
            makeItem('PAYMENT', { targetRemainder: 5 }),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }))],
        );

        // user не может увеличить сверх пула
        const userResult = book.adjust(1, 10);
        expect(userResult.ok).toBe(false);
        if (userResult.ok) return;
        expect(userResult.error.code).toBe('pool_exceeded');

        // admin может (в обход pool)
        const adminResult = book.adminAdd(1, 10);
        expect(adminResult.ok).toBe(true);
        if (!adminResult.ok) return;
        expect(adminResult.book.lines[0]?.quantity).toBe(40);
    });

    it('displayContextFor остаётся корректным после admin-операции', () => {
        // adminDecrease не меняет правила этапа: на PAYMENT+ canDecrease зависит
        // от currentQuantity vs frozenBase. У чистого supplement frozenBase=0,
        // поэтому canDecrease=true пока currentQuantity>0.
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 100, amountDue: 10000, createdOnStage: 'PAYMENT' }))],
        );
        const book2 = applyAdminDecrease(book, 1, 50);

        const ctx = book2.displayContextFor(1);
        // currentQuantity=50, frozenBase=0 → canDecrease=true (формально можно убавить)
        expect(ctx.currentQuantity).toBe(50);
        expect(ctx.canDecrease).toBe(true);
        // user-adjust(-X) РАЗРЕШЁН на PAYMENT+ для supplement-строки (остатки можно убавлять).
        const userResult = book2.adjust(1, -10);
        expect(userResult.ok).toBe(true);
        if (!userResult.ok) return;
        expect(userResult.book.supplementLineFor(1)?.quantity).toBe(40);
    });
});

// ── G. Сохранение упаковок в admin-методах ─────────────────────────

describe('G. Сохранение упаковок в admin-методах', () => {
    it('adminDecrease сохраняет упаковки при убавке qty → 0 (с двумя строками)', () => {
        // COLLECTION-строка: qty=5, packageCount=1, supplement-строка: qty=2, pkgCount=0.
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 5, baseQuantity: 5, amountDue: 500, packageCount: 1, createdOnStage: 'COLLECTION' })),
                OrderLine.create(makeLineProps({ id: 2, userId: 1, quantity: 2, amountDue: 200, createdOnStage: 'PAYMENT' })),
            ],
        );

        // adminDecrease(7) — сначала supplement (2), потом base (5).
        const result = book.adminDecrease(1, 7);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // supplement (PAYMENT) удалена (qty=0, pkgCount=0).
        expect(result.changes.find((c) => c.type === 'delete' && c.lineId === 2)).toBeDefined();

        // COLLECTION-строка сохранена: qty=0, packageCount=1.
        const remaining = result.book.lines[0];
        expect(remaining).toBeDefined();
        expect(remaining?.quantity).toBe(0);
        expect(remaining?.amountDue).toBe(0);
        expect(remaining?.packageCount).toBe(1);
        expect(remaining?.createdOnStage).toBe('COLLECTION');

        // Эффект — upsert с сохранённым packageCount.
        const upsert = result.changes.find((c) => c.type === 'upsert');
        expect(upsert).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 1,
        });
    });

    it('adminSetQuantity(0) сохраняет упаковки', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 3, amountDue: 300, packageCount: 2 }))],
        );
        const result = book.adminSetQuantity(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Строка сохранена, упаковки целы.
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(0);
        expect(line?.amountDue).toBe(0);
        expect(line?.packageCount).toBe(2);

        // Эффект — upsert, не delete.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 2,
        });
    });

    it('adminSetQuantity(0) → hard_delete когда упаковок нет (старое поведение)', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 }))],
        );
        const result = book.adminSetQuantity(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('adminSetQuantity(qty>0) сохраняет суммарный packageCount при схлопывании', () => {
        // COLLECTION-строка: qty=2, packageCount=1; PAYMENT-supplement: qty=1, pkgCount=0.
        // Суммарный packageCount = 1.
        const book = OrderBook.create(
            makeItem('PAYMENT'),
            [
                OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 2, baseQuantity: 2, amountDue: 200, packageCount: 1, createdOnStage: 'COLLECTION' })),
                OrderLine.create(makeLineProps({ id: 2, userId: 1, quantity: 1, amountDue: 100, createdOnStage: 'PAYMENT' })),
            ],
        );

        const result = book.adminSetQuantity(1, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Схлопнулось в одну COLLECTION-строку с qty=5 и сохранённым packageCount=1.
        expect(result.book.lines).toHaveLength(1);
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(5);
        expect(line?.packageCount).toBe(1);
        expect(line?.createdOnStage).toBe('COLLECTION');

        // 2 delete + 1 upsert.
        expect(result.changes.filter((c) => c.type === 'delete')).toHaveLength(2);
        expect(result.changes.filter((c) => c.type === 'upsert')).toHaveLength(1);
        expect(result.changes.find((c) => c.type === 'upsert')).toMatchObject({
            quantity: 5,
            packageCount: 1,
            createdOnStage: 'COLLECTION',
        });
    });

    it('regression: adminDelete по-прежнему силовое удаление (даже с упаковками)', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION'),
            [OrderLine.create(makeLineProps({ id: 1, quantity: 5, amountDue: 500, packageCount: 3 }))],
        );
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
        // Упаковки не сохраняются (by design — adminDelete = force-delete).
    });
});
