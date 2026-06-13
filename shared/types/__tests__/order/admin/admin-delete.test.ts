import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── A. adminDelete ─────────────────────────────────────────────────

describe('A. adminDelete — удаление всех строк юзера', () => {
    it('COLLECTION+PAYMENT: удаляет обе строки', () => {
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
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toHaveLength(2);
        expect(result.changes.every((c) => c.type === 'delete')).toBe(true);
        expect(result.book.lines).toHaveLength(0);
    });

    it('только COLLECTION → удаляется одна строка', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('только PAYMENT-supplement → удаляется', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' })),
        ]);
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(0);
    });

    it('нет строк у юзера → no-op ok, без изменений', () => {
        const book = OrderBook.create(makeItem('PAYMENT'));
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes).toEqual([]);
        expect(result.book.lines).toHaveLength(0);
    });

    it('другой юзер не задет', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }),
            ),
            OrderLine.create(
                makeLineProps({ id: 2, userId: 2, quantity: 50, amountDue: 5000, createdOnStage: 'PAYMENT' }),
            ),
        ]);
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(1);
        expect(result.book.supplementLineFor(2)?.quantity).toBe(50);
    });

    it('immutable: исходный book не изменился', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' })),
        ]);
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(book.lines).toHaveLength(1);
        expect(result.book.lines).toHaveLength(0);
        expect(result.book.lines).not.toBe(book.lines);
    });
});
