import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { applyAdminDecrease, makeItem, makeLineProps } from '../__helpers__';

// ── F. Admin в обход ограничений pool/user-методов ──────────────────

describe('F. Admin в обход запретов user-методов', () => {
    it('adminDecrease на PAYMENT+ убавляет (admin идёт в обход pool и stage rules)', () => {
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }),
            ),
        ]);

        // user ТОЖЕ может убавить (остатки можно убавлять на PAYMENT+)
        const userResult = book.adjust(1, -10);
        expect(userResult.ok).toBe(true);
        if (!userResult.ok) return;
        expect(userResult.book.lines[0]?.quantity).toBe(20);

        // admin может убавить (с базы 30 сразу)
        const adminResult = book.adminDecrease(1, 10);
        expect(adminResult.ok).toBe(true);
        if (!adminResult.ok) return;
        expect(adminResult.book.lines[0]?.quantity).toBe(20);
    });

    it('adminAdd на PAYMENT+ добавляет (admin идёт в обход pool)', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { targetRemainder: 5 }), [
            OrderLine.create(
                makeLineProps({ id: 1, userId: 1, quantity: 30, amountDue: 3000, createdOnStage: 'PAYMENT' }),
            ),
        ]);

        // user не может увеличить сверх пула
        const userResult = book.adjust(1, 10);
        expect(userResult.ok).toBe(false);
        if (userResult.ok) return;
        expect(userResult.error.code).toBe('pool_exceeded');

        // admin может (в обход pool)
        const adminResult = book.adminAdd(1, 10);
        expect(adminResult.ok).toBe(true);
        if (!adminResult.ok) return;
        expect(adminResult.book.lines[0]?.quantity).toBe(40);
    });

    it('displayContextFor остаётся корректным после admin-операции', () => {
        // adminDecrease не меняет правила этапа: на PAYMENT+ canDecrease зависит
        // от currentQuantity vs frozenBase. У чистого supplement frozenBase=0,
        // поэтому canDecrease=true пока currentQuantity>0.
        const book = OrderBook.create(makeItem('PAYMENT'), [
            OrderLine.create(
                makeLineProps({
                    id: 1,
                    userId: 1,
                    quantity: 100,
                    amountDue: 10000,
                    createdOnStage: 'PAYMENT',
                }),
            ),
        ]);
        const book2 = applyAdminDecrease(book, 1, 50);

        const ctx = book2.displayContextFor(1);
        // currentQuantity=50, frozenBase=0 → canDecrease=true (формально можно убавить)
        expect(ctx.currentQuantity).toBe(50);
        expect(ctx.canDecrease).toBe(true);
        // user-adjust(-X) РАЗРЕШЁН на PAYMENT+ для supplement-строки (остатки можно убавлять).
        const userResult = book2.adjust(1, -10);
        expect(userResult.ok).toBe(true);
        if (!userResult.ok) return;
        expect(userResult.book.supplementLineFor(1)?.quantity).toBe(40);
    });
});
