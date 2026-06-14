import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeItem, makeLineProps } from '../__helpers__';

// ── Глобальный лимит поставщика (supplierLimit) на PAYMENT+ ────────
//
// На PAYMENT+ frozen base не меняется, но supplement (top-up) тоже
// не должен выводить totalOrdered за supplierLimit.

describe('Limit. PAYMENT+: глобальный лимит поставщика', () => {
    it('adjust(+30) при frozen base=80, supp=10, limit=150 → supp=40, total=120, OK', () => {
        // COLLECTION→PAYMENT: замороженная base-строка + supplement на PAYMENT
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [
                // frozen COLLECTION base
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
                // supplement на PAYMENT
                OrderLine.create(
                    makeLineProps({ id: 2, userId: 1, quantity: 10, amountDue: 1000, createdOnStage: 'PAYMENT' }),
                ),
            ],
        );

        const book2 = applyAdjust(book1, 1, 30); // supp: 10 → 40
        expect(book2.totalFor(1).quantity).toBe(120);
    });

    it('adjust(+60) при frozen base=80, supp=10, limit=150 → supp=70, total=150, OK', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
                OrderLine.create(
                    makeLineProps({ id: 2, userId: 1, quantity: 10, amountDue: 1000, createdOnStage: 'PAYMENT' }),
                ),
            ],
        );

        const book2 = applyAdjust(book1, 1, 60);
        expect(book2.totalFor(1).quantity).toBe(150);
    });

    it('adjust(+61) при frozen base=80, supp=10, limit=150 → ошибка', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
                OrderLine.create(
                    makeLineProps({ id: 2, userId: 1, quantity: 10, amountDue: 1000, createdOnStage: 'PAYMENT' }),
                ),
            ],
        );

        const result = book1.adjust(1, 61);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(60); // 150 - 80 - 10 = 60
    });

    it('пример из задачи: pack=100, limit=150, base=120, supp=20 → остаток=10', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                supplierPackageAmount: 100,
                supplierPackageUnit: 'гр',
                supplierLimit: 150,
                supplierLimitUnit: 'гр',
            }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 120,
                        baseQuantity: 120,
                        amountDue: 12000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
                OrderLine.create(
                    makeLineProps({ id: 2, userId: 1, quantity: 20, amountDue: 2000, createdOnStage: 'PAYMENT' }),
                ),
            ],
        );
        // user1 уже 140, может добрать 10
        const result = book1.adjust(1, 11);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(10);

        // 10 — OK
        const book2 = applyAdjust(book1, 1, 10);
        expect(book2.totalFor(1).quantity).toBe(150);
    });

    it('без limit — supplement можно поднять до бесконечности (в пределах targetRemainder)', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: 100,
                supplierPackageAmount: null, // supplierLimit=null
            }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
            ],
        );
        // supplement = 100, total = 180 (но pool targetRemainder=100)
        const book2 = applyAdjust(book1, 1, 100);
        expect(book2.totalFor(1).quantity).toBe(180);
    });

    it('после ошибки книга не изменилась (immutable)', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 100,
            }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
                OrderLine.create(
                    makeLineProps({ id: 2, userId: 1, quantity: 10, amountDue: 1000, createdOnStage: 'PAYMENT' }),
                ),
            ],
        );
        const result = book1.adjust(1, 20); // userNew supp=30, total=120 > 100
        expect(result.ok).toBe(false);

        // supplement не изменился
        expect(book1.supplementLineForStage(1, 'PAYMENT')?.quantity).toBe(10);
    });

    it('multi-user: user1 base=80 supp=10 (total 90), user2 base=40 supp=0 → user2 может добрать 20', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                supplierPackageAmount: null,
                supplierLimit: 150,
            }),
            [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        userId: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
                OrderLine.create(
                    makeLineProps({ id: 2, userId: 1, quantity: 10, amountDue: 1000, createdOnStage: 'PAYMENT' }),
                ),
                OrderLine.create(
                    makeLineProps({
                        id: 3,
                        userId: 2,
                        quantity: 40,
                        baseQuantity: 40,
                        amountDue: 4000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
            ],
        );

        // user2: 40 + 0 = 40; общий = 130; доступно = 20
        const book2 = applyAdjust(book1, 2, 20);
        expect(book2.totalFor(2).quantity).toBe(60);

        // user2 пытается добрать ещё 1 → общий = 151 > 150
        const result = book2.adjust(2, 1);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
    });
});
