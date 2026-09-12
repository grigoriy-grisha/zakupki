import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

function unpricedItem(stage: Parameters<typeof makeItem>[0] = 'COLLECTION') {
    return makeItem(stage, { currencyRates: [] });
}

describe('unpriced', () => {
    it('adjust(+delta) отклоняется с кодом unpriced', () => {
        const result = OrderBook.create(unpricedItem()).adjust(1, 10);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('unpriced');
        expect(result.error.message).toContain('не рассчитана');
    });

    it('adjustPackages(+1) отклоняется с кодом unpriced', () => {
        const result = OrderBook.create(unpricedItem()).adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('unpriced');
    });

    it('adminAdd отклоняется с кодом unpriced', () => {
        const result = OrderBook.create(unpricedItem()).adminAdd(1, 10);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('unpriced');
    });

    it('adminAdjustPackages(+1) отклоняется, (−1) — разрешён', () => {
        const item = unpricedItem();
        const withLine = OrderBook.create(item, [
            makeLineProps({ packageCount: 2, quantity: 0 }),
        ]);

        const added = withLine.adminAdjustPackages(1, 1);
        expect(added.ok).toBe(false);
        if (!added.ok) expect(added.error.code).toBe('unpriced');

        const removed = withLine.adminAdjustPackages(1, -1);
        expect(removed.ok).toBe(true);
    });

    it('уменьшение существующего заказа не блокируется', () => {
        const withLine = OrderBook.create(unpricedItem(), [
            makeLineProps({ quantity: 10, amountDue: 800 }),
        ]);
        const result = withLine.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const line = result.book.baseLineFor(1);
        expect(line?.quantity).toBe(5);
    });

    it('adminSetQuantity выше текущего отклоняется, до нуля — разрешён', () => {
        const withLine = OrderBook.create(unpricedItem(), [
            makeLineProps({ quantity: 10 }),
        ]);

        const up = withLine.adminSetQuantity(1, 20);
        expect(up.ok).toBe(false);
        if (!up.ok) expect(up.error.code).toBe('unpriced');

        const toZero = withLine.adminSetQuantity(1, 0);
        expect(toZero.ok).toBe(true);
    });

    it('после появления курса заказ проходит', () => {
        const result = OrderBook.create(makeItem('COLLECTION')).adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]).toMatchObject({ quantity: 10, amountDue: 1000 });
    });
});
