import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── D. adminSetQuantity ────────────────────────────────────────────

describe('D. adminSetQuantity — установка точного qty', () => {
    it('COLLECTION: qty 80 → 100', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminSetQuantity(1, 100);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines[0]?.quantity).toBe(100);
        expect(result.book.lines[0]?.amountDue).toBe(10000);
    });

    it('COLLECTION: qty 80 → 0 → hard_delete', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminSetQuantity(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // Один delete-эффект
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('COLLECTION+PAYMENT (80+20=100) → adminSetQuantity(50) → схлопывание в COLLECTION=50', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 80,
                    baseQuantity: 80,
                    amountDue: 8000,
                    createdOnStage: 'COLLECTION',
                }),
            ),
            OrderLine.create(
                makeLineProps({ id: 2, userId: 1, quantity: 20, amountDue: 2000, createdOnStage: 'PAYMENT' }),
            ),
        ]);
        const result = book.adminSetQuantity(1, 50);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // 2 delete + 1 upsert
        expect(result.changes).toHaveLength(3);
        expect(result.book.lines).toHaveLength(1);
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(50);
        expect(line?.createdOnStage).toBe('COLLECTION');
    });

    it('qty < 0 → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminSetQuantity(1, -10);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('нет строк, qty > 0 → создаётся COLLECTION-строка', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adminSetQuantity(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.lines[0]?.quantity).toBe(30);
    });

    it('qty === текущему → no-op', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminSetQuantity(1, 80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
    });
});
