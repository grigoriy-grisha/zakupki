import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem, makeLineProps } from '../__helpers__';

function paymentBook(orderedQty: number) {
    return OrderBook.create(
        makeItem('PAYMENT', { unitCode: 'piece', packAmount: 1, targetRemainder: null, orderedQty }),
        [
            makeFrozenCollectionLine({ id: 1, userId: 1, quantity: 80, amountDue: 8000, baseQuantity: 80 }),
            OrderLine.create(
                makeLineProps({ id: 2, userId: 1, quantity: 3, amountDue: 300, createdOnStage: 'PAYMENT' }),
            ),
        ],
    );
}

describe('OrderedStock. PAYMENT+: добор ограничен остатком к продаже', () => {
    it('remainder = ordered − всего заказанного (база + добор)', () => {
        const book = paymentBook(90);
        expect(book.remainder).toBe(7);
        expect(book.poolFor(1).canAddMore).toBe(7);
    });

    it('adjust(+10) при остатке 7 → stock_exceeded canAddMore 7', () => {
        const result = paymentBook(90).adjust(1, 10);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('stock_exceeded');
        expect(result.error.canAddMore).toBe(7);
        expect(result.error.message).toBe('Заказано у поставщика: 90 шт. Доступно: 7 шт');
    });

    it('adjust(+7) — точно в остаток, OK', () => {
        const result = paymentBook(90).adjust(1, 7);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineForStage(1, 'PAYMENT')?.quantity).toBe(10);
    });

    it('уменьшение добора работает при нулевом остатке', () => {
        const result = paymentBook(83).adjust(1, -1);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineForStage(1, 'PAYMENT')?.quantity).toBe(2);
    });
});
