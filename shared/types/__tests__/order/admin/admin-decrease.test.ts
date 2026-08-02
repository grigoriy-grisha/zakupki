import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdminDecrease, makeItem, makeLineProps } from '../__helpers__';

// ── B. adminDecrease ───────────────────────────────────────────────

describe('B. adminDecrease — убавка в обход canDecrease', () => {
    it('COLLECTION: qty 80 → 50, baseQuantity не меняется', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 })),
        ]);
        const book2 = applyAdminDecrease(book, 1, 30);

        expect(book2.lines).toHaveLength(1);
        const line = book2.lines[0];
        expect(line?.quantity).toBe(50);
        expect(line?.baseQuantity).toBe(80);
        expect(line?.amountDue).toBe(5000);
    });

    it('qty 80 → adminDecrease(80) → hard_delete', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminDecrease(1, 80);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('COLLECTION+PAYMENT (80+20=100) → adminDecrease(30) → PAYMENT=0 (delete), COLLECTION=70', () => {
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
        const result = book.adminDecrease(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // PAYMENT (supplement) удалилась сначала, COLLECTION убавилась на 10
        expect(result.changes).toHaveLength(2);
        expect(result.changes.find((c) => c.type === 'delete')).toBeDefined();
        expect(result.book.lines).toHaveLength(1);
        const remaining = result.book.lines[0];
        expect(remaining?.quantity).toBe(70);
        expect(remaining?.createdOnStage).toBe('COLLECTION');
    });

    it('amount > qty → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminDecrease(1, 100);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('amount <= 0 → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminDecrease(1, 0);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('нет строк у юзера → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adminDecrease(1, 10);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });
});
