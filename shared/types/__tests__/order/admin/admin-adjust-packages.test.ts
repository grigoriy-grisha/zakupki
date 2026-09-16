import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── adminAdjustPackages: упаковки по всем строкам участника ──

describe('adminAdjustPackages: убавка по всем строкам', () => {
    it('-1 при упаковке на REORDER-строке → строка удалена, base нетронута', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 10,
                    baseQuantity: 10,
                    amountDue: 1000,
                    packageCount: 0,
                    createdOnStage: 'COLLECTION',
                }),
            ),
            OrderLine.create(
                makeLineProps({
                    id: 2,
                    userId: 1,
                    quantity: 0,
                    amountDue: 10_000,
                    packageCount: 1,
                    createdOnStage: 'REORDER',
                }),
            ),
        ]);

        const result = book.adminAdjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)).toBeNull();
        const base = result.book.baseLineFor(1);
        expect(base).not.toBeNull();
        expect(base?.quantity).toBe(10);
        expect(base?.packageCount).toBe(0);
        expect(result.book.activeLines.filter((l) => l.userId === 1)).toHaveLength(1);
    });

    it('убавка больше, чем есть, клипится в ноль без ошибки', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 50,
                    baseQuantity: 50,
                    amountDue: 10_000,
                    packageCount: 1,
                    createdOnStage: 'COLLECTION',
                }),
            ),
            OrderLine.create(
                makeLineProps({
                    id: 2,
                    userId: 1,
                    quantity: 0,
                    amountDue: 10_000,
                    packageCount: 1,
                    createdOnStage: 'REORDER',
                }),
            ),
        ]);

        const result = book.adminAdjustPackages(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)).toBeNull();
        const base = result.book.baseLineFor(1);
        expect(base?.packageCount).toBe(0);
        expect(base?.quantity).toBe(50);
    });

    it('supplement-first: убавка снимает упаковку с REORDER, base не трогает', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 50,
                    baseQuantity: 50,
                    amountDue: 10_000,
                    packageCount: 2,
                    createdOnStage: 'COLLECTION',
                }),
            ),
            OrderLine.create(
                makeLineProps({
                    id: 2,
                    userId: 1,
                    quantity: 0,
                    amountDue: 10_000,
                    packageCount: 1,
                    createdOnStage: 'REORDER',
                }),
            ),
        ]);

        const result = book.adminAdjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)).toBeNull();
        expect(result.book.baseLineFor(1)?.packageCount).toBe(2);
    });

    it('нет упаковок → ok без изменений (не ошибка)', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 10,
                    baseQuantity: 10,
                    amountDue: 1000,
                    createdOnStage: 'COLLECTION',
                }),
            ),
        ]);

        const result = book.adminAdjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.quantity).toBe(10);
    });
});

describe('adminAdjustPackages: добавление', () => {
    it('без base-строки → создаётся COLLECTION с qty=0 и packageCount=delta', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));

        const result = book.adminAdjustPackages(1, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const base = result.book.baseLineFor(1);
        expect(base).not.toBeNull();
        expect(base?.quantity).toBe(0);
        expect(base?.packageCount).toBe(2);
        expect(base?.createdOnStage).toBe('COLLECTION');
    });
});
