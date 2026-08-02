import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── E. Упаковки на PAYMENT+ запрещены ──────────────────────────────

describe('E. Упаковки запрещены', () => {
    it('adjustPackages(+1) → ошибка forbidden', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('forbidden');
    });

    it('adjustPackages(-1) на пустой → ошибка forbidden', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('forbidden');
    });

    it('adjustPackages НЕ создаёт COLLECTION-строку', () => {
        const book = OrderBook.create(makeItem('PAYMENT', { supplierPackageAmount: 10 }));
        const result = book.adjustPackages(1, 1);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        // даже при ошибке книга не изменилась
        expect(book.lines).toHaveLength(0);
    });
});
