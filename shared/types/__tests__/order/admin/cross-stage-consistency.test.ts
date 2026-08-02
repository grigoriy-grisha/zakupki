import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import type { PurchaseItem } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// Все три этапа, на которых admin-методы должны работать одинаково.
const STAGES: PurchaseItem['fulfillmentStatus'][] = ['COLLECTION', 'REORDER', 'PAYMENT'];

// ── E. Кросс-этапная консистентность ───────────────────────────────

describe('E. Admin-методы работают одинаково на всех этапах', () => {
    for (const stage of STAGES) {
        it(`adminDecrease(30) на этапе ${stage} → убавка работает`, () => {
            const createdOnStage = stage === 'COLLECTION' ? 'COLLECTION' : stage;
            const book = OrderBook.create(makeItem(stage), [
                OrderLine.create(
                    makeLineProps({
                        id: 1,
                        quantity: 80,
                        baseQuantity: 80,
                        amountDue: 8000,
                        createdOnStage,
                    }),
                ),
            ]);
            const result = book.adminDecrease(1, 30);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines[0]?.quantity).toBe(50);
        });

        it(`adminAdd(20) на этапе ${stage} → добавка работает`, () => {
            const book = OrderBook.create(makeItem(stage));
            const result = book.adminAdd(1, 20);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines[0]?.quantity).toBe(20);
        });

        it(`adminDelete на этапе ${stage} → удаление работает`, () => {
            const book = OrderBook.create(makeItem(stage), [
                OrderLine.create(makeLineProps({ id: 1, quantity: 50, amountDue: 5000 })),
            ]);
            const result = book.adminDelete(1);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines).toHaveLength(0);
        });

        it(`adminSetQuantity(60) на этапе ${stage} → установка работает`, () => {
            const book = OrderBook.create(makeItem(stage), [
                OrderLine.create(makeLineProps({ id: 1, quantity: 30, amountDue: 3000 })),
            ]);
            const result = book.adminSetQuantity(1, 60);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.book.lines[0]?.quantity).toBe(60);
        });
    }
});
