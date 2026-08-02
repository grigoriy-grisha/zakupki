import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── C. adminAdd ────────────────────────────────────────────────────

describe('C. adminAdd — добавка в обход canIncrease/canAddNew/poolApplies', () => {
    it('COLLECTION: qty 80 → 110', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminAdd(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 110,
            amountDue: 11000,
            createdOnStage: 'COLLECTION',
        });
        expect(result.book.lines[0]?.quantity).toBe(110);
    });

    it('нет строк → создаётся новая COLLECTION-строка', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        const result = book.adminAdd(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(10);
        expect(line?.createdOnStage).toBe('COLLECTION');
        expect(line?.baseQuantity).toBeNull();
    });

    it('PAYMENT+: работает в обход canIncrease=false (и в обход canAddPackages)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 0 }));
        const result = book.adminAdd(1, 50);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines[0]?.quantity).toBe(50);
    });

    it('amount <= 0 → ошибка negative', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminAdd(1, 0);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('negative');
    });

    it('несколько юзеров: adminAdd на user1 не задевает user2', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000 })),
            OrderLine.create(makeLineProps({ id: 2, userId: 2, quantity: 40, amountDue: 4000 })),
        ]);
        const result = book.adminAdd(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines.find((l) => l.userId === 1)?.quantity).toBe(40);
        expect(result.book.lines.find((l) => l.userId === 2)?.quantity).toBe(40);
    });

    it('REORDER: работает на REORDER (как и на COLLECTION)', () => {
        const book = OrderBook.create(makeItem('REORDER'));
        const result = book.adminAdd(1, 25);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines[0]?.quantity).toBe(25);
    });
});
