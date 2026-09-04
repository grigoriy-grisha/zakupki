import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, applyAdjustPackages, makeItem } from '../__helpers__';

describe('OrderedStock. COLLECTION: orderedQty как кап', () => {
    it('шт: adjust до orderedQty — OK, сверх — stock_exceeded', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { unitCode: 'piece', orderedQty: 25 }));
        const book2 = applyAdjust(book1, 1, 25);
        expect(book2.baseLineFor(1)?.quantity).toBe(25);

        const result = book2.adjust(1, 1);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('stock_exceeded');
        expect(result.error.message).toBe('Заказано у поставщика: 25 шт. Доступно: 0 шт');
    });

    it('шт: два пользователя делят один остаток', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { unitCode: 'piece', orderedQty: 30 }));
        const book2 = applyAdjust(book1, 1, 20);

        const result = book2.adjust(2, 15);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.canAddMore).toBe(10);
    });

    it('уменьшение не блокируется остатком', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { unitCode: 'piece', orderedQty: 10 }));
        const book2 = applyAdjust(book1, 1, 10);
        expect(book2.adjust(1, -5).ok).toBe(true);
    });

    it('без orderedQty — безлимит (регресс)', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { unitCode: 'piece' }));
        expect(book.adjust(1, 100_000).ok).toBe(true);
    });

    it('гр: упаковки съедают остаток', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { packAmount: 30, orderedQty: 100 }));
        const book2 = applyAdjustPackages(book1, 1, 2);

        const result = book2.adjustPackages(1, 2);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('stock_exceeded');
        expect(result.error.canAddMore).toBe(40);
    });

    it('гр: рассыпное + упаковки вместе не превышают остаток', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { packAmount: 30, orderedQty: 100 }));
        const book2 = applyAdjustPackages(book1, 1, 2);

        const result = book2.adjust(1, 50);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.canAddMore).toBe(40);
    });

    it('при одновременном превышении показывается stock_exceeded, не limit_exceeded', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', {
                unitCode: 'piece',
                orderedQty: 30,
                supplierLimit: 50,
                supplierLimitUnit: 'шт',
            }),
        );

        const result = book.adjust(1, 40);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('stock_exceeded');
    });
});
