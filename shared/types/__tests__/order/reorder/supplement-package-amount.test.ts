import { describe, expect, it } from 'vitest';

import { computeAmountDueWithPackages, OrderBook } from '../../../src/order';
import { applyAdjust, applyAdjustPackages, makeFrozenCollectionLine, makeItem } from '../__helpers__';

// У добавки (REORDER-строки) бывают упаковки. Раньше при смене количества её сумма
// считалась без них, а общий пересчёт закупки — с ними: сумма прыгала туда-обратно.
describe('Сумма добавки с упаковками не теряет их стоимость', () => {
    const item = makeItem('REORDER', { targetRemainder: 50 });
    const withPackage = () => {
        const book = OrderBook.create(item, [
            makeFrozenCollectionLine({ id: 1, quantity: 80, baseQuantity: 80, amountDue: 8000, packageCount: 0 }),
        ]);
        return applyAdjustPackages(book, 1, 1); // упаковка уходит в добавку
    };

    it('adjust(+N) и adjust(-N) на добавке считают упаковку', () => {
        const more = applyAdjust(withPackage(), 1, 5);
        const supp = more.supplementLineFor(1);
        expect(supp?.packageCount).toBe(1);
        expect(supp?.quantity).toBe(5);
        expect(supp?.amountDue).toBe(computeAmountDueWithPackages(5, 1, item));
        expect(supp?.amountDue).toBeGreaterThan(computeAmountDueWithPackages(5, 0, item));

        const less = applyAdjust(more, 1, -2);
        expect(less.supplementLineFor(1)?.amountDue).toBe(computeAmountDueWithPackages(3, 1, item));
    });

    it('админ убавляет добавку — упаковка остаётся в сумме', () => {
        const book = applyAdjust(withPackage(), 1, 5);
        const result = book.adminDecrease(1, 1);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.amountDue).toBe(computeAmountDueWithPackages(4, 1, item));
    });
});
