import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeItem } from '../__helpers__';

// ── B. Добавление количества ────────────────────────────────────────

describe('B. adjust(+delta) — добавление количества', () => {
    it('юзер без строки заказал +10 → появляется строка с qty=10 и amountDue=1000', () => {
        const book = makeItem('COLLECTION', { pricePerUnit: 100 });
        const result = OrderBook.create(book).adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            purchaseItemId: 42,
            userId: 1,
            createdOnStage: 'COLLECTION',
            quantity: 10,
            amountDue: 1000,
        });

        const line = result.book.baseLineFor(1);
        expect(line).not.toBeNull();
        expect(line?.quantity).toBe(10);
        expect(line?.packageCount).toBe(0);
        expect(line?.createdOnStage).toBe('COLLECTION');
        expect(line?.baseQuantity).toBeNull();
    });

    it('тот же юзер добавил ещё +5 → строка обновляется, не дублируется', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 10);
        const book2 = applyAdjust(book1, 1, 5);

        expect(book2.lines).toHaveLength(1);
        expect(book2.baseLineFor(1)?.quantity).toBe(15);
        expect(book2.baseLineFor(1)?.amountDue).toBe(1500);
    });

    it('два разных юзера → две независимые строки', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 10);
        const book2 = applyAdjust(book1, 2, 7);

        expect(book2.lines).toHaveLength(2);
        expect(book2.baseLineFor(1)?.quantity).toBe(10);
        expect(book2.baseLineFor(2)?.quantity).toBe(7);
    });
});

// ── C. Уменьшение количества ────────────────────────────────────────

describe('C. adjust(-delta) — уменьшение количества', () => {
    it('юзер с qty=10 убавил -5 → qty=5, сумма пересчитана', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 10);
        const book2 = applyAdjust(book1, 1, -5);

        expect(book2.baseLineFor(1)?.quantity).toBe(5);
        expect(book2.baseLineFor(1)?.amountDue).toBe(500);
        expect(book2.lines).toHaveLength(1);
    });

    it('юзер с qty=10 убавил -10 → строка удаляется (hard delete)', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('COLLECTION', { pricePerUnit: 100 })), 1, 10);
        const result = book1.adjust(1, -10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
        expect(result.book.baseLineFor(1)).toBeNull();
    });
});

// ── D. Нулевые дельты ───────────────────────────────────────────────

describe('D. Пустые/нулевые дельты', () => {
    it('delta=0 на пустой книге → ok без изменений', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adjust(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
    });

    it('delta<0 при qty=0 → ok без ошибки и без изменений', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
        expect(result.book.lines).toHaveLength(0);
    });
});
