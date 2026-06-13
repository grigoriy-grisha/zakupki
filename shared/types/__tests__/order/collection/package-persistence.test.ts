import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, applyAdjustPackages, makeItem, makeLineProps } from '../__helpers__';

// ── J. Сохранение упаковок при qty → 0 (COLLECTION) ─────────────────

describe('J. Сохранение упаковок при qty → 0 (COLLECTION)', () => {
    it('qty → 0 при наличии упаковок → строка сохраняется, упаковки остаются', () => {
        // Создаём строку: qty=2, packageCount=1 (например, добавили 1 упаковку поверх 2 единиц).
        const book1 = OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100, supplierPackageAmount: 10 }), [
            OrderLine.create(makeLineProps({ quantity: 2, amountDue: 200, packageCount: 1 })),
        ]);

        // Убавляем qty до 0.
        const result = book1.adjust(1, -2);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Строка сохранилась.
        const line = result.book.baseLineFor(1);
        expect(line).not.toBeNull();
        expect(line?.quantity).toBe(0);
        expect(line?.amountDue).toBe(0);
        expect(line?.packageCount).toBe(1); // упаковки целы
        expect(result.book.lines).toHaveLength(1);

        // Эффект — upsert (не delete), с сохранённым packageCount.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 1,
        });
    });

    it('adjustPackages(-1) после zeroing qty → строка hard-deleted', () => {
        // Строка: qty=2, packageCount=2.
        const book1 = OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100, supplierPackageAmount: 10 }), [
            OrderLine.create(makeLineProps({ quantity: 2, amountDue: 200, packageCount: 2 })),
        ]);

        // Убавляем qty до 0 — строка выживает с pkgCount=2.
        const afterQtyZero = applyAdjust(book1, 1, -2);
        expect(afterQtyZero.baseLineFor(1)?.quantity).toBe(0);
        expect(afterQtyZero.baseLineFor(1)?.packageCount).toBe(2);

        // Убираем обе упаковки — после первой строка жива (qty=0, pkg=1).
        const afterPkgMinus1 = applyAdjustPackages(afterQtyZero, 1, -1);
        expect(afterPkgMinus1.baseLineFor(1)?.quantity).toBe(0);
        expect(afterPkgMinus1.baseLineFor(1)?.packageCount).toBe(1);

        // Убираем последнюю упаковку — оба ноль, строка удаляется.
        const result = afterPkgMinus1.adjustPackages(1, -1);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.book.baseLineFor(1)).toBeNull();
        expect(result.book.lines).toHaveLength(0);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.type).toBe('delete');
    });

    it('regression: qty → 0 без упаковок → hard_delete (старое поведение)', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 5);
        const result = book1.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('убавка qty до 0 с упаковками НЕ сбрасывает baseQuantity=null', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100, supplierPackageAmount: 10 }), [
            OrderLine.create(makeLineProps({ quantity: 3, amountDue: 300, packageCount: 2, baseQuantity: null })),
        ]);

        const result = book1.adjust(1, -3);
        if (!result.ok) throw new Error('expected ok');

        const line = result.book.baseLineFor(1);
        expect(line?.baseQuantity).toBeNull(); // не трогаем
        expect(line?.packageCount).toBe(2);
    });
});
