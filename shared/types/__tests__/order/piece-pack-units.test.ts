import { describe, expect, it } from 'vitest';

import { buildQuantityDisplay } from '../../src/units/format';
import { isPieceUnit, isWeightUnit } from '../../src/units/normalize';
import { resolveUnit } from '../../src/units/registry';
import { getActiveStep, getOrderQuantityStep } from '../../src/pricing/quantity-rules';
import { OrderBook, OrderLine } from '../../src/order';
import { computeRawPool } from '../../src/order/pool';
import { computeAmountDueWithPackages, computePackagePrice } from '../../src/order/pricing';
import { makeItem, makeLineProps } from './__helpers__';

const NO_AGGREGATION = {
    totalOrderedQuantity: 0,
    supplementClaimed: 0,
    totalBaseQuantity: 0,
    totalOrderedWithPackages: 0,
};

describe('piece_pack в реестре единиц', () => {
    it('WEIGHT-kind: механика граммов, отображение штук', () => {
        expect(isWeightUnit('piece_pack')).toBe(true);
        expect(isPieceUnit('piece_pack')).toBe(false);
    });

    it('resolveUnit("шт") по-прежнему возвращает обычные piece, а не piece_pack', () => {
        expect(resolveUnit('шт')?.code).toBe('piece');
        expect(resolveUnit('piece_pack')?.code).toBe('piece_pack');
    });

    it('pluralForms — «шт» во всех формах', () => {
        expect(resolveUnit('piece_pack')?.pluralForms).toEqual(['шт', 'шт', 'шт']);
    });
});

describe('шаги заказа для piece_pack', () => {
    it('шаг = мин. фасовка (как у gram, не как у piece)', () => {
        expect(getOrderQuantityStep({ unitCode: 'piece_pack', minPackageAmount: 5, multiplicity: 1 })).toBe(5);
    });

    it('без фасовки дефолт 1 (в реестре дефолт только для gram)', () => {
        expect(getOrderQuantityStep({ unitCode: 'piece_pack', minPackageAmount: null, multiplicity: 1 })).toBe(1);
    });

    it('на доборе действует supplementStep (в отличие от piece)', () => {
        const options = { unitCode: 'piece_pack', minPackageAmount: 5, multiplicity: 1 };
        expect(getActiveStep({ fulfillmentStatus: 'REORDER', options, supplementStep: 10 })).toBe(10);
        expect(getActiveStep({ fulfillmentStatus: 'COLLECTION', options, supplementStep: 10 })).toBe(5);
    });
});

describe('отображение количества piece_pack', () => {
    it('россыпь + упаковки: «10 шт + 2 уп», всего 70 шт', () => {
        const display = buildQuantityDisplay({ quantity: 10, packageCount: 2, packSize: 30, unitCode: 'piece_pack' });
        expect(display.main).toBe('10 шт + 2 уп');
        expect(display.total).toBe('всего 70 шт');
    });

    it('без упаковок — просто «7 шт»', () => {
        const display = buildQuantityDisplay({ quantity: 7, packageCount: 0, packSize: 30, unitCode: 'piece_pack' });
        expect(display.main).toBe('7 шт');
        expect(display.total).toBeNull();
    });
});

describe('OrderBook для piece_pack', () => {
    it('adjustPackages разрешён (в отличие от piece/tube)', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', { unitCode: 'piece_pack', packAmount: 30, minPackageAmount: 5 }),
            [],
        );
        expect(book.adjustPackages(1, 1).ok).toBe(true);
    });

    it('adminAdjustPackages разрешён', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', { unitCode: 'piece_pack', packAmount: 30, minPackageAmount: 5 }),
            [],
        );
        expect(book.adminAdjustPackages(1, 1).ok).toBe(true);
    });

    it('display context: паковый блок и подсчёт целых пачек как у gram', () => {
        const book = OrderBook.create(
            makeItem('COLLECTION', {
                unitCode: 'piece_pack',
                packAmount: 30,
                minPackageAmount: 5,
                packDiscountPercent: 10,
            }),
            [OrderLine.create(makeLineProps({ id: 1, userId: 1, quantity: 70, amountDue: 7000 }))],
        );
        const ctx = book.displayContextFor(1);
        expect(ctx.showPackageButtons).toBe(true);
        expect(ctx.fullPacks).toBe(2);
    });
});

describe('цены и скидки для piece_pack', () => {
    it('скидка за целые пачки применяется (weight-kind)', () => {
        const item = makeItem('COLLECTION', {
            unitCode: 'piece_pack',
            packAmount: 30,
            minPackageAmount: 5,
            packDiscountPercent: 10,
        });
        // unitPrice 100 ₽/шт × пачка 30 шт = 3000 ₽, скидка 10% → 2700 ₽
        expect(computePackagePrice(item)).toBe(2700);
    });

    it('amountDue = россыпь × цена/ед + целые пачки × цена пачки со скидкой', () => {
        const item = makeItem('COLLECTION', {
            unitCode: 'piece_pack',
            packAmount: 30,
            minPackageAmount: 5,
            packDiscountPercent: 10,
        });
        // 5 шт россыпью по 100 ₽ + 1 полная пачка (30 шт) со скидкой 10% (3000 − 300)
        expect(computeAmountDueWithPackages(5, 1, item)).toBe(2700 + 500);
    });
});

describe('пул добора для piece_pack', () => {
    it('автопул по пачкам работает (как у gram), а не null (как у piece)', () => {
        // базы 80 шт → ceil(80/30) = 3 пачки = 90 шт; заказано 80 → свободно 10
        expect(
            computeRawPool({
                targetRemainder: null,
                packSize: 30,
                aggregation: { ...NO_AGGREGATION, totalBaseQuantity: 80, totalOrderedQuantity: 80 },
                unitCode: 'piece_pack',
            }),
        ).toBe(10);
    });
});
