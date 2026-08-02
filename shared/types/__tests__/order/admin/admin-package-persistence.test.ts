import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

// ── G. Сохранение упаковок в admin-методах ─────────────────────────

describe('G. Сохранение упаковок в admin-методах', () => {
    it('adminDecrease сохраняет упаковки при убавке qty → 0 (с двумя строками)', () => {
        // COLLECTION-строка: qty=5, packageCount=1, supplement-строка: qty=2, pkgCount=0.
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 5,
                    baseQuantity: 5,
                    amountDue: 500,
                    packageCount: 1,
                    createdOnStage: 'COLLECTION',
                }),
            ),
            OrderLine.create(
                makeLineProps({ id: 2, userId: 1, quantity: 2, amountDue: 200, createdOnStage: 'PAYMENT' }),
            ),
        ]);

        // adminDecrease(7) — сначала supplement (2), потом base (5).
        const result = book.adminDecrease(1, 7);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // supplement (PAYMENT) удалена (qty=0, pkgCount=0).
        expect(result.changes.find((c) => c.type === 'delete' && c.lineId === 2)).toBeDefined();

        // COLLECTION-строка сохранена: qty=0, packageCount=1.
        const remaining = result.book.lines[0];
        expect(remaining).toBeDefined();
        expect(remaining?.quantity).toBe(0);
        expect(remaining?.amountDue).toBe(0);
        expect(remaining?.packageCount).toBe(1);
        expect(remaining?.createdOnStage).toBe('COLLECTION');

        // Эффект — upsert с сохранённым packageCount.
        const upsert = result.changes.find((c) => c.type === 'upsert');
        expect(upsert).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 1,
        });
    });

    it('adminSetQuantity(0) сохраняет упаковки', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 3, amountDue: 300, packageCount: 2 })),
        ]);
        const result = book.adminSetQuantity(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Строка сохранена, упаковки целы.
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(0);
        expect(line?.amountDue).toBe(0);
        expect(line?.packageCount).toBe(2);

        // Эффект — upsert, не delete.
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0]).toMatchObject({
            type: 'upsert',
            quantity: 0,
            amountDue: 0,
            packageCount: 2,
        });
    });

    it('adminSetQuantity(0) → hard_delete когда упаковок нет (старое поведение)', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 80, amountDue: 8000 })),
        ]);
        const result = book.adminSetQuantity(1, 0);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
    });

    it('adminSetQuantity(qty>0) сохраняет суммарный packageCount при схлопывании', () => {
        // COLLECTION-строка: qty=2, packageCount=1; PAYMENT-supplement: qty=1, pkgCount=0.
        // Суммарный packageCount = 1.
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 2,
                    baseQuantity: 2,
                    amountDue: 200,
                    packageCount: 1,
                    createdOnStage: 'COLLECTION',
                }),
            ),
            OrderLine.create(
                makeLineProps({ id: 2, userId: 1, quantity: 1, amountDue: 100, createdOnStage: 'PAYMENT' }),
            ),
        ]);

        const result = book.adminSetQuantity(1, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');

        // Схлопнулось в одну COLLECTION-строку с qty=5 и сохранённым packageCount=1.
        expect(result.book.lines).toHaveLength(1);
        const line = result.book.lines[0];
        expect(line?.quantity).toBe(5);
        expect(line?.packageCount).toBe(1);
        expect(line?.createdOnStage).toBe('COLLECTION');

        // 2 delete + 1 upsert.
        expect(result.changes.filter((c) => c.type === 'delete')).toHaveLength(2);
        expect(result.changes.filter((c) => c.type === 'upsert')).toHaveLength(1);
        expect(result.changes.find((c) => c.type === 'upsert')).toMatchObject({
            quantity: 5,
            packageCount: 1,
            createdOnStage: 'COLLECTION',
        });
    });

    it('regression: adminDelete по-прежнему силовое удаление (даже с упаковками)', () => {
        const book = OrderBook.create(makeItem('COLLECTION'), [
            OrderLine.create(makeLineProps({ id: 1, quantity: 5, amountDue: 500, packageCount: 3 })),
        ]);
        const result = book.adminDelete(1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]?.type).toBe('delete');
        expect(result.book.lines).toHaveLength(0);
        // Упаковки не сохраняются (by design — adminDelete = force-delete).
    });
});
