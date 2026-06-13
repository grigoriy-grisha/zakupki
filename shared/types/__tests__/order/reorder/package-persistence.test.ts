import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, applyAdjustPackages, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── P. Сохранение упаковок при qty → 0 (REORDER base-строка) ────────

describe('P. Сохранение упаковок при qty → 0 (REORDER base-строка)', () => {
    it('adjust(-N) на base-строке с packageCount>0 → строка сохраняется, упаковки остаются', () => {
        // Замороженная COLLECTION-строка: qty=3, packageCount=1, baseQuantity=3.
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 3, baseQuantity: 3, amountDue: 300, packageCount: 1 }),
        ]);

        // Убавляем qty до 0.
        const result = book1.adjust(1, -3);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Строка сохранилась: qty=0, amountDue=0, packageCount=1, baseQuantity=3.
        const line = result.book.baseLineFor(1);
        expect(line).not.toBeNull();
        expect(line?.quantity).toBe(0);
        expect(line?.amountDue).toBe(0);
        expect(line?.packageCount).toBe(1);
        expect(line?.baseQuantity).toBe(3); // заморозка не сбрасывается
        expect(result.book.lines).toHaveLength(1);

        // Эффект — upsert, не delete.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 1,
            createdOnStage: 'COLLECTION',
        });
    });

    it('regression: qty → 0 на base-строке БЕЗ упаковок → hard_delete (старое поведение)', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, packageCount: 0 }),
        ]);
        const result = book1.adjust(1, -80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('regression: qty → 0 на supplement-строке → hard_delete (supplement без упаковок)', () => {
        // COLLECTION-строка: qty=80, packageCount=0 (защищена заморозкой), supplement: qty=20, pkgCount=0.
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 20); // supplement: qty=20

        // Убавляем supplement до 0.
        const result = book2.adjust(1, -20);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.supplementLineFor(1)).toBeNull();
        // base-строка не тронута
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
    });

    it('adjustPackages(-1) после zeroing qty → оба ноль → строка hard-deleted', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 3, baseQuantity: 3, amountDue: 300, packageCount: 2 }),
        ]);

        // zero qty → строка выживает с pkgCount=2.
        const afterQtyZero = applyAdjust(book1, 1, -3);
        expect(afterQtyZero.baseLineFor(1)?.quantity).toBe(0);
        expect(afterQtyZero.baseLineFor(1)?.packageCount).toBe(2);

        // -1 упаковки → строка ещё жива (qty=0, pkg=1).
        const afterMinus1 = applyAdjustPackages(afterQtyZero, 1, -1);
        expect(afterMinus1.baseLineFor(1)?.quantity).toBe(0);
        expect(afterMinus1.baseLineFor(1)?.packageCount).toBe(1);

        // -1 упаковки (последняя) → оба ноль → удаляется.
        const result = afterMinus1.adjustPackages(1, -1);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.changes[0]?.type).toBe('delete');
    });
});
