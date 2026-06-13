import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, applyAdjustPackages, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── Q. adjust(+N) на REORDER — заполняет COLLECTION до baseQuantity ───

describe('Q. adjust(+N) на REORDER — заполняет COLLECTION до baseQuantity', () => {
    it('delta=30 при COLLECTION qty=50, baseQty=80 → COLLECTION заполняется до 80, REORDER не создаётся', () => {
        // Юзер убавил COLLECTION на REORDER: qty=50, baseQty=80 (gap=30).
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 50, baseQuantity: 80, amountDue: 5000 }),
        ]);
        const result = book1.adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // COLLECTION заполнилась до 80, REORDER-supplement НЕ создался.
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)).toBeNull();

        // Эффект — один upsert на COLLECTION.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'COLLECTION',
            quantity: 80,
            amountDue: 8000,
        });
    });

    it('delta=50 при COLLECTION qty=50, baseQty=80 → 30 в COLLECTION + 20 в новую REORDER-supplement', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 50, baseQuantity: 80, amountDue: 5000 }),
        ]);
        const result = book1.adjust(1, 50);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // COLLECTION заполнилась до 80, REORDER-supplement получила 20.
        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(20);

        // Два upsert-эффекта: COLLECTION + REORDER.
        expect(result.changes).toHaveLength(2);
        const collectionChange = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'COLLECTION');
        const reorderChange = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'REORDER');
        expect(collectionChange).toMatchObject({ quantity: 80, amountDue: 8000 });
        expect(reorderChange).toMatchObject({ quantity: 20, amountDue: 2000 });
    });

    it('delta=30 при COLLECTION qty=80, baseQty=80 (gap=0) → всё в новую REORDER-supplement', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const result = book1.adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80); // COLLECTION не тронута
        expect(result.book.supplementLineFor(1)?.quantity).toBe(30);

        // Один upsert на REORDER.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 30,
        });
    });

    it('delta=30 при существующей REORDER-supplement=10 → 40, COLLECTION не тронута', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const book2 = applyAdjust(book1, 1, 10); // supplement: 10
        const result = book2.adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.quantity).toBe(80);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(40);

        // Один upsert на REORDER.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 40,
        });
    });
});

// ── R. adjustPackages(+N) на REORDER — заполняет COLLECTION до basePackageCount ─

describe('R. adjustPackages(+N) на REORDER — заполняет COLLECTION до basePackageCount', () => {
    it('delta=1 при COLLECTION pkg=1, basePkg=3 (gap=2) → COLLECTION pkg=2, REORDER не создаётся', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 1,
                basePackageCount: 3,
            }),
        ]);
        const result = book1.adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(1);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(2);
        expect(result.book.supplementLineFor(1)).toBeNull();

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'COLLECTION',
            packageCount: 2,
        });
    });

    it('delta=3 при COLLECTION pkg=1, basePkg=3 → COLLECTION pkg=3, REORDER-pkg=1', () => {
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({
                id: 1,
                quantity: 80,
                baseQuantity: 80,
                amountDue: 8000,
                packageCount: 1,
                basePackageCount: 3,
            }),
        ]);
        const result = book1.adjustPackages(1, 3);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        // REORDER-строка с qty=0, pkg=1.
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(0);

        expect(result.changes).toHaveLength(2);
        const coll = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'COLLECTION');
        const reo = result.changes.find((c) => c.type === 'upsert' && c.createdOnStage === 'REORDER');
        expect(coll).toMatchObject({ packageCount: 3 });
        expect(reo).toMatchObject({ quantity: 0, packageCount: 1 });
    });

    it('delta=1 при COLLECTION pkg=3, basePkg=3 (gap=0) → создаётся REORDER-pkg=1', () => {
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
        const result = book1.adjustPackages(1, 1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            quantity: 0,
            packageCount: 1,
        });
    });

    it('delta=2 при COLLECTION pkg=3, basePkg=3 и существующей REORDER-pkg=1 → REORDER-pkg=3', () => {
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
        const book2 = applyAdjustPackages(book1, 1, 1); // создаёт REORDER-pkg=1
        const result = book2.adjustPackages(1, 2);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.baseLineFor(1)?.packageCount).toBe(3);
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(3);

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'REORDER',
            packageCount: 3,
        });
    });
});
