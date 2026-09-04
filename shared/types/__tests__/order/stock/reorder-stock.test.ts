import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

function pieceBook(overrides: Record<string, unknown> = {}) {
    return OrderBook.create(
        makeItem('REORDER', {
            unitCode: 'piece',
            packAmount: 1,
            targetRemainder: null,
            orderedQty: 25,
            ...overrides,
        }),
        [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 20, amountDue: 2000, baseQuantity: 20 })],
    );
}

describe('OrderedStock. REORDER: остаток к продаже на доборе', () => {
    it('шт: пул = ordered − собранное (remainder/poolFor)', () => {
        const book = pieceBook();
        expect(book.remainder).toBe(5);
        expect(book.poolFor(2).maxAllowed).toBe(5);
        expect(book.poolFor(2).canAddMore).toBe(5);
    });

    it('шт: добор сверх остатка — stock_exceeded', () => {
        const result = pieceBook().adjust(2, 10);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('stock_exceeded');
        expect(result.error.canAddMore).toBe(5);
    });

    it('шт: добор точно в остаток — OK', () => {
        const book = applyAdjust(pieceBook(), 2, 5);
        expect(book.supplementLineFor(2)?.quantity).toBe(5);
    });

    it('шт: orderedQty жёстче targetRemainder → пул = ordered', () => {
        const book = pieceBook({ targetRemainder: 50, orderedQty: 22 });
        expect(book.remainder).toBe(2);
    });

    it('шт: supplierLimit жёстче orderedQty → poolFor берёт минимум', () => {
        const book = pieceBook({ orderedQty: 25, supplierLimit: 22, supplierLimitUnit: 'шт' });
        expect(book.poolFor(2).canAddMore).toBe(2);
    });

    it('гр: пул по пачкам без orderedQty — как раньше (регресс)', () => {
        const book = OrderBook.create(
            makeItem('REORDER', { packAmount: 100, targetRemainder: null }),
            [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 250, amountDue: 25_000, baseQuantity: 250 })],
        );
        expect(book.remainder).toBe(50);
    });

    it('гр: orderedQty жёстче пачек → пул = ordered', () => {
        const book = OrderBook.create(
            makeItem('REORDER', { packAmount: 100, targetRemainder: null, orderedQty: 270 }),
            [makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 250, amountDue: 25_000, baseQuantity: 250 })],
        );
        expect(book.remainder).toBe(20);
    });

    it('гр: упаковки на доборе тоже упираются в остаток', () => {
        const book = OrderBook.create(
            makeItem('REORDER', { packAmount: 30, targetRemainder: null, orderedQty: 100 }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    userId: 1,
                    quantity: 30,
                    amountDue: 3000,
                    baseQuantity: 30,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
            ],
        );

        const result = book.adjustPackages(1, 2);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('stock_exceeded');
        expect(result.error.canAddMore).toBe(40);
    });
});
