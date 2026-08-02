import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdjust, makeFrozenCollectionLine, makeItem, makeLineProps } from '../__helpers__';

// ── Multi-user: глобальный supplierLimit делится между всеми ──────

describe('Limit. Multi-user: глобальный пул делится между всеми', () => {
    it('user1 берёт 80, user2 берёт 70 при limit=150 → оба успевают', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const book2 = applyAdjust(book1, 1, 80);
        const book3 = applyAdjust(book2, 2, 70);

        expect(book3.totalFor(1).quantity).toBe(80);
        expect(book3.totalFor(2).quantity).toBe(70);
    });

    it('user1 берёт 100, user2 берёт 60 при limit=150 → user2 может только 50', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const book2 = applyAdjust(book1, 1, 100);
        const result = book2.adjust(2, 60);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(50);

        // user2 берёт 50
        const book3 = applyAdjust(book2, 2, 50);
        expect(book3.totalFor(2).quantity).toBe(50);
    });

    it('REORDER: user1 base=80, user2 base=40 при limit=150 → user1 может добрать 30', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                packAmount: null,
                supplierLimit: 150,
            }),
            [
                makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, baseQuantity: 80, amountDue: 8000 }),
                makeFrozenCollectionLine({ id: 2, userId: 2, quantity: 40, baseQuantity: 40, amountDue: 4000 }),
            ],
        );

        // user1 хочет добрать 30 → total=110 (80+40+30=150 — в лимит)
        const book2 = applyAdjust(book1, 1, 30);
        expect(book2.totalFor(1).quantity).toBe(110);

        // user1 хочет ещё 1 → total=111 > 150 (80+40+31=151)
        const result = book2.adjust(1, 1);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
    });

    it('PAYMENT: user1 total=90, user2 total=40 при limit=150 → user2 может добрать 20', () => {
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: null,
                packAmount: null,
                supplierLimit: 150,
            }),
            [
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
                    makeLineProps({ id: 2, userId: 1, quantity: 10, amountDue: 1000, createdOnStage: 'PAYMENT' }),
                ),
                OrderLine.create(
                    makeLineProps({
                        id: 3,
                        userId: 2,
                        quantity: 40,
                        baseQuantity: 40,
                        amountDue: 4000,
                        createdOnStage: 'COLLECTION',
                    }),
                ),
            ],
        );

        // user1 уже 90, user2 40; общий 130; доступно 20
        const book2 = applyAdjust(book1, 2, 20);
        expect(book2.totalFor(2).quantity).toBe(60);

        // user2 пытается добрать ещё 1
        const result = book2.adjust(2, 1);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
    });

    it('limit действует на каждого юзера одинаково: user1 уже взял 150 → user2 не может ничего', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const book2 = applyAdjust(book1, 1, 150);

        // user1 уже на лимите
        const result1 = book2.adjust(1, 1);
        expect(result1.ok).toBe(false);
        if (result1.ok) return;
        expect(result1.error.code).toBe('limit_exceeded');
        expect(result1.error.canAddMore).toBe(0);

        // user2 не может ничего
        const result2 = book2.adjust(2, 1);
        expect(result2.ok).toBe(false);
        if (result2.ok) return;
        expect(result2.error.code).toBe('limit_exceeded');
        expect(result2.error.canAddMore).toBe(0);
    });
});
