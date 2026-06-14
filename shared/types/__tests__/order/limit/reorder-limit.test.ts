import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem, makeLineProps } from '../__helpers__';

// ── Глобальный лимит поставщика (supplierLimit) на REORDER ────────
//
// Пример из задачи: пачка 100 гр, limit=150 гр, заказал 120 гр,
// остаток = 30 гр.

describe('Limit. REORDER: глобальный лимит поставщика', () => {
    it('adjust(+30) при base=80, limit=150 → userNew=110, OK', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const book2 = applyAdjust(book1, 1, 30);

        expect(book2.totalFor(1).quantity).toBe(110);
    });

    it('adjust(+80) при base=80, limit=150 → userNew=160 → ошибка', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book1.adjust(1, 80);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(70); // 150 - 80
    });

    it('пример из задачи: pack=100, limit=150, взял 120, остаток=30', () => {
        // frozen base=120, limit=150
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                supplierPackageAmount: 100,
                supplierPackageUnit: 'гр',
                supplierLimit: 150,
                supplierLimitUnit: 'гр',
            }),
            [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 120, baseQuantity: 120, amountDue: 12000 })],
        );

        // user1 может добрать максимум 30 (150 - 120)
        const result = book1.adjust(1, 31);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(30);

        // 30 — OK
        const book2 = applyAdjust(book1, 1, 30);
        expect(book2.totalFor(1).quantity).toBe(150);
    });

    it('limit взаимодействует с pool: жёстче из двух', () => {
        // targetRemainder=200 (большой пул), supplierLimit=150 (жёстче)
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 200, supplierLimit: 150 }), [
            makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 100, baseQuantity: 100, amountDue: 10000 }),
        ]);

        // user1 может добрать максимум 50 (limit=150, осталось 50)
        const result = book1.adjust(1, 51);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        // pool=200, userCurrent=100, userNew=151 → maxAllowed (pool)=300, 151 < 300 → OK pool
        // supplierPool=50, maxAllowed (limit)=150, 151 > 150 → limit_exceeded
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(50);

        // Обратная ситуация: targetRemainder=100 (жёстче), supplierLimit=200
        const book2 = OrderBook.create(makeItem('REORDER', { targetRemainder: 100, supplierLimit: 200 }), [
            makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        // base=80, targetRemainder=100 → maxAllowed (pool) = 180, limit = 280
        // delta=101 → userNew=181 > 180 → pool_exceeded
        const result2 = book2.adjust(1, 101);
        expect(result2.ok).toBe(false);
        if (result2.ok) return;
        expect(result2.error.code).toBe('pool_exceeded');
    });

    it('adjust(-N) при наличии limit → OK (уменьшение не проверяется)', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 120, baseQuantity: 100, amountDue: 12000 }))],
        );
        // base=100, supp=20, total=120
        const result = book1.adjust(1, -50);
        expect(result.ok).toBe(true);
    });

    it('multi-user: user1 взял 120, user2 на REORDER может добрать 30', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [
                makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
                makeFrozenCollectionLine({ id: 2, userId: 2, quantity: 40, baseQuantity: 40, amountDue: 4000 }),
            ],
        );
        // user1 хочет добрать 50 (его base=80, итого 130, лимит 150, можно)
        // user2 хочет добрать 31 (его base=40, итого 71, общий = 130+71 = 201 > 150)
        const result = book1.adjust(2, 31);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(30); // 150 - 80 - 40 = 30
    });

    it('после ошибки книга не изменилась (immutable)', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 100,
            }),
            [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })],
        );
        const result = book1.adjust(1, 50); // userNew=130 > 100
        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(book1.baseLineFor(1)?.quantity).toBe(80);
        expect(book1.supplementLineFor(1)).toBeNull();
    });
});
