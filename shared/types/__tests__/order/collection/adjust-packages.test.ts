import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjustPackages, makeItem } from '../__helpers__';

// ── E. Упаковки ─────────────────────────────────────────────────────

describe('E. adjustPackages(±1) — упаковки', () => {
    it('юзер без строки добавил +1 упаковку → строка qty=0, packageCount=1', () => {
        const book = makeItem('COLLECTION', { packAmount: 10 });
        const result = OrderBook.create(book).adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const line = result.book.baseLineFor(1);
        expect(line?.quantity).toBe(0);
        expect(line?.packageCount).toBe(1);
        // amountDue = qty*price + pkgCount*packagePrice = 0 + 1*1000 = 1000
        expect(line?.amountDue).toBe(1000);
        expect(line?.createdOnStage).toBe('COLLECTION');
    });

    it('юзер с +1 упаковкой добавил ещё +1 → packageCount=2, qty не меняется', () => {
        const book1 = applyAdjustPackages(
            OrderBook.create(makeItem('COLLECTION', { packAmount: 10 })),
            1,
            1,
        );
        const book2 = applyAdjustPackages(book1, 1, 1);

        const line = book2.baseLineFor(1);
        expect(line?.quantity).toBe(0);
        expect(line?.packageCount).toBe(2);
        expect(line?.amountDue).toBe(2000);
        expect(book2.lines).toHaveLength(1);
    });

    it('юзер с 1 упаковкой убавил -1 → qty=0 и pkg=0 → строка удаляется', () => {
        const book1 = applyAdjustPackages(
            OrderBook.create(makeItem('COLLECTION', { packAmount: 10 })),
            1,
            1,
        );
        const result = book1.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.book.lines).toHaveLength(0);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toEqual({ type: 'delete', lineId: expect.any(Number) });
    });

    it('убавка ниже нуля (было 0, -1) → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { packAmount: 10 }));
        const result = book.adjustPackages(1, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('товар без packAmount → ошибка no_package', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { packAmount: null }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('no_package');
    });
});
