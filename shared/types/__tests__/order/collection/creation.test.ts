import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── A. Создание книги ───────────────────────────────────────────────

describe('A. Создание книги', () => {
    it('пустая книга → нет строк', () => {
        const book = OrderBook.create(makeItem('COLLECTION'));
        expect(book.lines).toHaveLength(0);
        expect(book.activeLines).toHaveLength(0);
    });
});
