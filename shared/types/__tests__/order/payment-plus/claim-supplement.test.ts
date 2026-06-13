import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── B. Юзер без строки берёт из остатка ───────────────────────────

describe('B. Юзер берёт из остатка', () => {
    it('adjust(+30) на пустой книге → появляется supplement-строка PAYMENT', () => {
        const result = OrderBook.create(makeItem('PAYMENT')).adjust(1, 30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            purchaseItemId: 42,
            userId: 1,
            createdOnStage: 'PAYMENT',
            quantity: 30,
            amountDue: 3000,
        });

        const sup = result.book.supplementLineFor(1);
        expect(sup).not.toBeNull();
        expect(sup?.quantity).toBe(30);
        expect(sup?.createdOnStage).toBe('PAYMENT');
        expect(sup?.baseQuantity).toBeNull();
        expect(sup?.packageCount).toBe(0);
    });

    it('после adjust(+30) remainder стал 20', () => {
        const book = applyAdjust(OrderBook.create(makeItem('PAYMENT')), 1, 30);
        expect(book.remainder).toBe(20);
    });

    it('poolFor после adjust(+30) → pool=20, canAddMore=20, maxAllowed=50', () => {
        const book = applyAdjust(OrderBook.create(makeItem('PAYMENT')), 1, 30);
        const pool = book.poolFor(1);

        expect(pool.pool).toBe(20);
        expect(pool.canAddMore).toBe(20);
        expect(pool.maxAllowed).toBe(50);
        expect(pool.supplementClaimed).toBe(30);
    });
});

// ── C. Увеличение существующей supplement-строки разрешено ─────────

describe('C. Увеличение supplement-строки разрешено', () => {
    it('adjust(+10) к существующей supplement-строке → qty=40', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(40);
        expect(result.book.supplementLineFor(1)?.amountDue).toBe(4000);
    });

    it('после успешного увеличения книга изменилась', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, 10);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.remainder).toBe(10);
    });
});

// ── D. Убавка supplement-строки разрешена ──────────────────────────

describe('D. Убавка supplement-строки разрешена', () => {
    it('adjust(-5) на supplement-строке → qty=25', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.quantity).toBe(25);
        expect(result.book.remainder).toBe(25);
    });

    it('adjust(-30) на supplement-строке qty=30 → строка удаляется', () => {
        const book1 = applyAdjust(OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 })), 1, 30);
        const result = book1.adjust(1, -30);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)).toBeNull();
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.remainder).toBe(50);
    });
});

// ── D2. COLLECTION-строка (замороженная) — НЕЛЬЗЯ менять ───────────

describe('D2. COLLECTION-строка (замороженная) защищена', () => {
    it('adjust(-5) на юзере с COLLECTION-строкой (без supplement) → forbidden', () => {
        // Юзер с замороженной COLLECTION-строкой (qty=80, baseQuantity=80) — нет supplement.
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const result = book.adjust(1, -5);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('forbidden');
    });

    it('adjust(+5) к COLLECTION-строке (без supplement) → идёт в supplement', () => {
        // У юзера замороженная COLLECTION-строка. adjust(+5) должен создать supplement, не увеличивать COLLECTION.
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 50 }), [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
        ]);
        const result = book.adjust(1, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.lines).toHaveLength(2);
        expect(result.book.baseLineFor(1)?.quantity).toBe(80); // COLLECTION не тронута
        expect(result.book.supplementLineFor(1)?.quantity).toBe(5); // supplement создан
    });
});
