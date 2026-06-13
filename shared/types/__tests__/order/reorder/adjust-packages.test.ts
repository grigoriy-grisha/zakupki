import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── I. Упаковки на REORDER ─────────────────────────────────────────

describe('I. Упаковки на REORDER', () => {
    it('adjustPackages(+1) → создаётся COLLECTION-строка qty=0, packageCount=1', () => {
        const result = OrderBook.create(makeItem('REORDER')).adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const base = result.book.baseLineFor(1);
        expect(base).not.toBeNull();
        expect(base?.quantity).toBe(0);
        expect(base?.packageCount).toBe(1);
        expect(base?.createdOnStage).toBe('COLLECTION');
    });

    it('+1 на существующей COLLECTION-строке с basePkg=0 → идёт в REORDER-pkg', () => {
        // На REORDER: COLLECTION заморожена с basePackageCount=0, gap=0,
        // новая упаковка идёт в REORDER-строку, а не в COLLECTION.
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 0,
            }),
        ]);
        const result = book1.adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.packageCount).toBe(0);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
    });

    it('-1 упаковки → packageCount=0, строка остаётся', () => {
        // COLLECTION: pkg=1, basePkg=1 (на frozen). -1 → pkg=0, строка остаётся (qty>0).
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 1,
                basePackageCount: 1,
            }),
        ]);
        const result = book1.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.packageCount).toBe(0);
        expect(result.book.baseLineFor(1)).not.toBeNull();
    });

    it('убавка упаковок ниже нуля → ошибка negative', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adjustPackages(1, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('товар без supplierPackageAmount → ошибка no_package', () => {
        const book = OrderBook.create(makeItem('REORDER', { supplierPackageAmount: null }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('no_package');
    });
});
