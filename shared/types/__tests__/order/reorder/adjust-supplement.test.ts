import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── B. Юзер без строки добирает из остатка ─────────────────────────

describe('B. Юзер без строки добирает из остатка', () => {
    it('adjust(+30) на пустой книге → появляется supplement-строка', () => {
        const result = OrderBook.create(makeItem('REORDER')).adjust(1, 30);

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
        const book = applyAdjust(OrderBook.create(makeItem('REORDER')), 1, 30);
        expect(book.remainder).toBe(20);
    });

    it('poolFor после adjust(+30) → pool=20, canAddMore=20', () => {
        const book = applyAdjust(OrderBook.create(makeItem('REORDER')), 1, 30);
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
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ quantity: 80, amountDue: 8000, baseQuantity: 80 }),
        ]);
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
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20);

        const total = book2.totalFor(1);
        expect(total.quantity).toBe(100);
        expect(total.packageCount).toBe(0);
    });

    it('после добора remainder=0', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 20 }), [
            makeFrozenCollectionLine({ quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20);
        expect(book2.remainder).toBe(0);
    });
});
