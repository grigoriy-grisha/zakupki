import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { applyAdjust, makeItem } from '../__helpers__';

// ── Глобальный лимит поставщика (supplierLimit) на COLLECTION ──────
//
// Семантика: supplierLimit — глобальный лимит остатка у поставщика.
// Суммарно все пользователи не могут заказать больше этого лимита
// ни на одном этапе. Если не задан — без ограничений.

describe('Limit. COLLECTION: глобальный лимит поставщика', () => {
    it('adjust(+200) при limit=150 → ошибка limit_exceeded', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150, supplierLimitUnit: 'гр' }));
        const result = book.adjust(1, 200);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(150);
    });

    it('adjust(+150) при limit=150 → OK (точно в лимит)', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const result = book.adjust(1, 150);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.baseLineFor(1)?.quantity).toBe(150);
    });

    it('adjust(+151) при limit=150 → ошибка limit_exceeded canAddMore=150', () => {
        const book = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const result = book.adjust(1, 151);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(150);
    });

    it('adjust(-100) при limit=150 → OK (уменьшение не проверяется)', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const book2 = applyAdjust(book1, 1, 100);
        const result = book2.adjust(1, -100);

        expect(result.ok).toBe(true);
    });

    it('без supplierLimit — без ограничений', () => {
        const book = OrderBook.create(makeItem('COLLECTION')); // supplierLimit=null
        const result = book.adjust(1, 100_000);

        expect(result.ok).toBe(true);
    });

    it('после ошибки книга не изменилась (immutable)', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 100 }));
        const result = book1.adjust(1, 200);
        expect(result.ok).toBe(false);

        // Книга не изменилась
        expect(book1.baseLineFor(1)).toBeNull();
        expect(book1.lines.length).toBe(0);
    });

    it('multi-user: user1 взял 80, user2 не может взять 80 при limit=150', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const book2 = applyAdjust(book1, 1, 80);

        // user2 может взять максимум 70 (150 - 80 = 70)
        const result = book2.adjust(2, 80);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(70);

        // user2 может взять 70 — точно в лимит
        const book3 = applyAdjust(book2, 2, 70);
        expect(book3.totalFor(2).quantity).toBe(70);
    });

    it('multi-user: user1 взял 80, user2 берёт 70 → user3 не может ничего', () => {
        const book1 = OrderBook.create(makeItem('COLLECTION', { supplierLimit: 150 }));
        const book2 = applyAdjust(book1, 1, 80);
        const book3 = applyAdjust(book2, 2, 70);
        const result = book3.adjust(3, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(0);
    });
});
