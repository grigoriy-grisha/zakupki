import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeItem } from '../__helpers__';

// ── L. createdOnStage consistency на PAYMENT+ past PAYMENT ────────────

describe('L. createdOnStage consistency на PAYMENT+ past PAYMENT', () => {
    it('adjust(+30) на SUPPLIER_ASSEMBLY → supplement-строка createdOnStage=SUPPLIER_ASSEMBLY', () => {
        const item = makeItem('SUPPLIER_ASSEMBLY', { targetRemainder: 50 });
        const result = OrderBook.create(item).adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            createdOnStage: 'SUPPLIER_ASSEMBLY',
            quantity: 30,
        });

        const sup = result.book.supplementLineFor(1);
        expect(sup).not.toBeNull();
        expect(sup?.createdOnStage).toBe('SUPPLIER_ASSEMBLY');
    });

    it('displayContextFor находит supplement-строку через supplementLineFor', () => {
        const item = makeItem('SUPPLIER_ASSEMBLY', { targetRemainder: 50 });
        const book = applyAdjust(OrderBook.create(item), 1, 30);
        const ctx = book.displayContextFor(1);

        expect(ctx.isSupplement).toBe(true);
        expect(ctx.currentQuantity).toBe(30);
    });

    it('повторный adjust(+10) идёт в ту же supplement-строку (не создаёт новую)', () => {
        const item = makeItem('SUPPLIER_ASSEMBLY', { targetRemainder: 50 });
        const book1 = applyAdjust(OrderBook.create(item), 1, 30);
        const result = book1.adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.book.lines).toHaveLength(1);
        expect(result.book.supplementLineFor(1)?.quantity).toBe(40);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            createdOnStage: 'SUPPLIER_ASSEMBLY',
            quantity: 40,
        });
    });
});
