import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem, makeLineProps } from '../__helpers__';

// ── N. PAYMENT+ добавление при существующей REORDER-строке → новая PAYMENT-строка ──

describe('N. PAYMENT+ не переиспользует REORDER-строку', () => {
    it('adjust(+5) при наличии REORDER-supplement → новая PAYMENT-строка, REORDER не тронута', () => {
        // Сценарий: юзер на REORDER создал supplement (qty=0, pkg=3), перешёл в PAYMENT.
        // На PAYMENT+ нажимает +5. Ожидаемо: создаётся НОВАЯ orderLine с createdOnStage='PAYMENT',
        // REORDER-строка остаётся как есть.
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
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
        ]);
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
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
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
        ]);
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
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
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
        ]);
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
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
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
        ]);
        const ctx = book.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(10);
        expect(ctx.canDecrease).toBe(false);
        expect(ctx.minAllowed).toBe(25);
    });

    it('canDecrease=true при currentQuantity > frozenBase (есть PAYMENT-supplement)', () => {
        // COLLECTION qty=30, frozenBase=30 + PAYMENT qty=10 → current=40 > frozenBase=30 → можно убавить.
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 30,
                baseQuantity: 30,
                amountDue: 3000,
            }),
        ]);
        const book2 = applyAdjust(book1, 1, 10); // PAYMENT-строка qty=10
        const ctx = book2.displayContextFor(1);
        expect(ctx.currentQuantity).toBe(40);
        expect(ctx.canDecrease).toBe(true);
        expect(ctx.minAllowed).toBe(30);
    });

    it('supplementClaimed считает REORDER + PAYMENT (не только PAYMENT)', () => {
        // REORDER qty=10, PAYMENT qty=5 → supplementClaimed=15.
        const book1 = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
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
        ]);
        const book2 = applyAdjust(book1, 1, 5); // PAYMENT qty=5

        // user2: pool = targetRemainder(50) - supplementClaimed(15) = 35.
        const pool = book2.poolFor(2);
        expect(pool.pool).toBe(35);
        expect(pool.supplementClaimed).toBe(15);
    });
});
