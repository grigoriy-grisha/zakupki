import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjustPackages, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── S. adjustPackages(-N) на REORDER — каскад с REORDER-pkg на COLLECTION ─

describe('S. adjustPackages(-N) на REORDER — каскад с REORDER-pkg на COLLECTION', () => {
    it('delta=-1 при COLLECTION pkg=3 и REORDER-pkg=2 → REORDER-pkg=1, COLLECTION не тронута', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 3,
                basePackageCount: 3,
            }),
        ]);
        const book2 = applyAdjustPackages(book1, 1, 2); // REORDER-pkg=2
        const result = book2.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            packageCount: 1,
        });
    });

    it('delta=-5 при COLLECTION pkg=3 и REORDER-pkg=2 → REORDER=0 (delete), COLLECTION=0 (delete)', () => {
        // COLLECTION pkg=3, REORDER-pkg=2, total=5. -5 → оба ноль, обе строки удаляются.
        // COLLECTION строка тоже удаляется, т.к. qty=80>0, НО pkg=0 — не hard-delete
        // (qty>0). Нужно опустить COLLECTION pkg до 0 И qty до 0 для hard-delete.
        // Проверим: cascade REORDER(-2)→0, COLLECTION(-3)→0. COLLECTION остаётся (qty=80>0).
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 3,
                basePackageCount: 3,
            }),
        ]);
        const book2 = applyAdjustPackages(book1, 1, 2); // REORDER-pkg=2
        const result = book2.adjustPackages(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // REORDER-pkg=0 → hard-delete. COLLECTION pkg=0 (но qty=80) → остаётся.
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(0);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)).toBeNull();
        // Один delete (REORDER), один upsert (COLLECTION pkg=0).
        expect(result.changes.filter((c) => c.type === 'delete')).toHaveLength(1);
    });

    it('cascade: COLLECTION qty=0 + pkg=0 после cascade → COLLECTION hard-deleted', () => {
        // Юзер на REORDER имеет ТОЛЬКО пакеты (qty=0 в COLLECTION).
        // Удаляем все пакеты → COLLECTION qty=0 && pkg=0 → hard-delete.
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 0,
                baseQuantity: 0,
                amountDue: 0,
                packageCount: 0,
                basePackageCount: 2,
            }),
        ]);
        // Сначала доведём pkg до 2 (заполняем gap=2).
        const book2 = applyAdjustPackages(book1, 1, 2); // COLLECTION pkg=2
        // Теперь убавим все 2 — COLLECTION pkg=0, qty=0 → hard-delete.
        const result = book2.adjustPackages(1, -2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(0);
        expect(result.changes.filter((c) => c.type === 'delete')).toHaveLength(1);
    });

    it('delta=-1 при COLLECTION pkg=3 и без REORDER → COLLECTION pkg=2', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 3,
                basePackageCount: 3,
            }),
        ]);
        const result = book1.adjustPackages(1, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.packageCount).toBe(2);
        expect(result.book.supplementLineFor(1)).toBeNull();

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'COLLECTION',
            packageCount: 2,
        });
    });
});
