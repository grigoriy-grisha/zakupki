import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, applyAdjustPackages, makeFrozenCollectionLine, makeItem, makeLineProps } from '../__helpers__';

// ── T. Сосуществование qty и pkg на REORDER-линии ────────────────────

describe('T. Сосуществование qty и pkg на REORDER-линии', () => {
    function setupBook(): OrderBook {
        return OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 3,
                basePackageCount: 3,
            }),
            OrderLine.create(
                makeLineProps({
                    id: 2,
                    userId: 1,
                    quantity: 10,
                    amountDue: 1000,
                    packageCount: 0,
                    createdOnStage: 'REORDER',
                    baseQuantity: null,
                    basePackageCount: null,
                }),
            ),
        ]);
    }

    it('adjust(+20) на REORDER с qty+pkg → REORDER qty=30, pkg=0', () => {
        const book = setupBook();
        const result = book.adjust(1, 20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(30);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(0);
        // Один upsert на REORDER (COLLECTION не тронута).
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 30,
            packageCount: 0,
        });
    });

    it('adjustPackages(+2) на REORDER с qty+pkg → REORDER pkg=2, qty=10 не меняется', () => {
        const book = setupBook();
        const result = book.adjustPackages(1, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(10);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(2);
        // Один upsert на REORDER.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 10,
            packageCount: 2,
        });
    });

    it('adjustPackages(-1) на REORDER с qty+pkg → REORDER pkg=1, qty=10', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 1); // REORDER pkg=1
        const result = book2.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(10);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(0);
    });

    it('adjust(-25) на REORDER с qty+pkg → REORDER qty=5, pkg не меняется', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 2); // REORDER qty=10, pkg=2
        const result = book2.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(5);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(2);
    });

    it('adjust(-50) убавляет REORDER qty до 0, но pkg>0 → строка сохраняется', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 2); // REORDER qty=10, pkg=2
        const result = book2.adjust(1, -10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // REORDER строка: qty=0, pkg=2 — НЕ удаляется (pkg>0).
        expect(result.book.supplementLineFor(1)?.quantity).toBe(0);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(2);
    });

    it('totalFor суммирует packageCount из COLLECTION + REORDER-pkg', () => {
        const book = setupBook();
        const book2 = applyAdjustPackages(book, 1, 2); // REORDER qty=10, pkg=2
        const total = book2.totalFor(1);

        // packageCount = COLLECTION(3) + REORDER(2) = 5
        expect(total.packageCount).toBe(5);
    });
});
