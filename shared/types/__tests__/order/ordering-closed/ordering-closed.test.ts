import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeItem, makeLineProps } from '../__helpers__';

const PACKAGING_ITEM = {
    packAmount: 10,
    minPackageAmount: 1,
    targetRemainder: 50,
};

function packagingBookWithLine() {
    const item = makeItem('PACKAGING', PACKAGING_ITEM);
    const line = makeLineProps({
        purchaseItemId: item.purchaseItemId,
        userId: 1,
        quantity: 30,
        amountDue: 3000,
        createdOnStage: 'PACKAGING',
    });
    return OrderBook.create(item, [line]);
}

describe('Приём заказов закрыт на PACKAGING и READY_FOR_PICKUP', () => {
    it('PACKAGING: adjust(+) → ошибка «Приём заказов завершён»', () => {
        const result = OrderBook.create(makeItem('PACKAGING', PACKAGING_ITEM)).adjust(1, 30);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toBe('Приём заказов завершён');
    });

    it('READY_FOR_PICKUP: adjust(+) → ошибка', () => {
        const result = OrderBook.create(
            makeItem('READY_FOR_PICKUP', PACKAGING_ITEM),
        ).adjust(1, 30);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toBe('Приём заказов завершён');
    });

    it('PACKAGING: убавка своей supplement-строки разрешена', () => {
        const result = packagingBookWithLine().adjust(1, -10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changes[0]).toMatchObject({ createdOnStage: 'PACKAGING', quantity: 20 });
    });

    it('PACKAGING: displayContext → canAdd=false, canDecrease=true', () => {
        const ctx = packagingBookWithLine().displayContextFor(1);

        expect(ctx.canAdd).toBe(false);
        expect(ctx.canDecrease).toBe(true);
    });

    it('IN_TRANSIT_TO_ORGANIZER: adjust(+) по-прежнему разрешён', () => {
        const result = OrderBook.create(
            makeItem('IN_TRANSIT_TO_ORGANIZER', { packAmount: 10, minPackageAmount: 1, targetRemainder: 50 }),
        ).adjust(1, 30);

        expect(result.ok).toBe(true);
    });

    it('adminAdd на PACKAGING работает (в обход этапа)', () => {
        const result = OrderBook.create(makeItem('PACKAGING', PACKAGING_ITEM)).adminAdd(1, 30);

        expect(result.ok).toBe(true);
    });
});
