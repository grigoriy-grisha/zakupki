import type { PurchaseItemRowLike } from '@zakupki/types';
import { mapToPurchaseItem } from '@zakupki/types';
import { describe, expect, it } from 'vitest';

import { buildParticipants,buildParticipantSummary } from '../participants';
import {
    amountSplit,
    priceCells,
    quantitySplit,
    roundMoney,
    roundQty,
    toNumber,
} from '../pricing-cells';
import { tubeFacingLabel } from '../tube-facing';

const PRICING_CONTEXT = {
    orgFeeDefaultPercent: 10,
    deliveryPercent: 5,
    currencyRates: [{ currencyId: 2, rateToRub: 2 }],
};

function makeItem(overrides: Partial<PurchaseItemRowLike> = {}, packDiscountPercent = 3): ReturnType<typeof mapToPurchaseItem> {
    return mapToPurchaseItem(
        {
            id: 1,
            packAmount: 500,
            packUnit: 'гр',
            unitCode: 'gram',
            currencyId: 2,
            pricePerPackCurrency: 50,
            minPackageAmount: 5,
            product: { unitCode: 'gram', multiplicity: 1 },
            purchase: { fulfillmentStatus: 'COLLECTION' },
            ...overrides,
        },
        packDiscountPercent,
        PRICING_CONTEXT,
    );
}

describe('roundMoney / roundQty / toNumber', () => {
    it('strips float noise from decimal sums', () => {
        expect(roundMoney(9005.699999999999)).toBe(9005.7);
        expect(roundMoney(13025.500000000004)).toBe(13025.5);
        expect(roundQty(4.349999999999999)).toBe(4.35);
    });

    it('toNumber falls back to 0 for nullish and invalid values', () => {
        expect(toNumber(null)).toBe(0);
        expect(toNumber(undefined)).toBe(0);
        expect(toNumber('12.5')).toBe(12.5);
        expect(toNumber('abc')).toBe(0);
    });
});

describe('priceCells', () => {
    it('computes pack/facing/unit prices with pack discount', () => {
        expect(priceCells(makeItem())).toEqual({
            packPrice: 111.55,
            facingPrice: 1.15,
            unitPrice: 0.23,
        });
    });

    it('keeps base pack price when discount is zero', () => {
        expect(priceCells(makeItem({}, 0)).packPrice).toBe(115);
    });

    it('prices a 10g facing when min package is 10', () => {
        expect(priceCells(makeItem({ minPackageAmount: 10 })).facingPrice).toBe(2.3);
    });

    it('reports unpriced items', () => {
        expect(priceCells(makeItem({ pricePerPackCurrency: null }))).toEqual({
            packPrice: '',
            facingPrice: '',
            unitPrice: 'Цена уточняется',
        });
    });

    it('leaves facing empty for piece goods', () => {
        const piece = makeItem({
            unitCode: 'piece',
            packAmount: 1,
            packUnit: 'шт',
            minPackageAmount: null,
            pricePerPackCurrency: 60,
            product: { unitCode: 'piece', multiplicity: 1 },
        });
        expect(priceCells(piece)).toEqual({
            packPrice: 138,
            facingPrice: '',
            unitPrice: 138,
        });
    });
});

describe('quantitySplit', () => {
    it('splits loose grams and full packs', () => {
        expect(quantitySplit({ quantity: '15', packageCount: 2 }, 500, true)).toEqual({
            partialQty: 15,
            fullPackCell: '1000 (2 уп)',
            partialGr: 15,
            fullPackGr: 1000,
        });
    });

    it('handles packs-only lines', () => {
        expect(quantitySplit({ quantity: '0', packageCount: 1 }, 500, true)).toEqual({
            partialQty: '',
            fullPackCell: '500 (1 уп)',
            partialGr: 0,
            fullPackGr: 500,
        });
    });

    it('falls back to pack count without pack size', () => {
        expect(quantitySplit({ quantity: '0', packageCount: 2 }, null, true).fullPackCell).toBe('2 уп');
    });

    it('keeps piece quantities out of gram totals', () => {
        const split = quantitySplit({ quantity: '3', packageCount: 0 }, null, false);
        expect(split.partialQty).toBe(3);
        expect(split.partialGr).toBe(0);
        expect(split.fullPackGr).toBe(0);
    });
});

describe('amountSplit', () => {
    it('splits pack cost with discount and loose remainder', () => {
        const item = makeItem();
        expect(amountSplit({ amountDue: '115', packageCount: 1 }, item)).toEqual({
            partial: 3.45,
            fullPack: 111.55,
        });
    });

    it('clamps to amountDue when prices drift', () => {
        expect(amountSplit({ amountDue: '100', packageCount: 1 }, makeItem())).toEqual({
            partial: 0,
            fullPack: 100,
        });
    });

    it('puts everything into partial without packs', () => {
        expect(amountSplit({ amountDue: '99.9', packageCount: 0 }, makeItem())).toEqual({
            partial: 99.9,
            fullPack: 0,
        });
    });
});

describe('buildParticipants / buildParticipantSummary', () => {
    it('includes bare participants from purchase orders', () => {
        const participants = buildParticipants([], [{ id: 373, userId: 7, user: { firstName: 'Анна' } }]);
        expect(participants).toEqual([
            {
                userId: 7,
                purchaseOrderId: 373,
                name: 'Анна',
                phone: '',
                tgUsername: '',
                telegramId: '',
                vkId: '',
            },
        ]);
    });

    it('sums due/paid/pending and detects overpayment', () => {
        const participants = buildParticipants(
            [{ id: 1, userId: 7, quantity: 5, amountDue: '100' }],
            [],
        );
        const summary = buildParticipantSummary(participants, [{ id: 1, userId: 7, quantity: 5, amountDue: '100' }], [
            { id: 10, userId: 7, amount: '50', status: 'PENDING', submittedAt: '2026-01-01' },
            { id: 11, userId: 7, amount: '120', status: 'CONFIRMED', submittedAt: '2026-01-01' },
        ]);
        expect(summary).toEqual([
            { userId: 7, due: 100, paid: 120, pending: 50, status: 'overpaid' },
        ]);
    });

    it('ignores rejected payments', () => {
        const orders = [{ id: 1, userId: 7, quantity: 5, amountDue: '100' }];
        const summary = buildParticipantSummary(buildParticipants(orders), orders, [
            { id: 11, userId: 7, amount: '120', status: 'REJECTED', submittedAt: '2026-01-01' },
        ]);
        expect(summary[0]).toMatchObject({ paid: 0, pending: 0, status: 'unpaid' });
    });
});

describe('tubeFacingLabel', () => {
    const weightChar = (value: string) => ({
        value,
        characteristic: { name: 'Вес', position: 1 },
    });

    it('reads grams from the Вес characteristic', () => {
        expect(tubeFacingLabel({ characteristicValues: [weightChar('~ 7,2гр')] })).toBe('туба 7,2 гр');
        expect(tubeFacingLabel({ characteristicValues: [weightChar('~7,2 гр')] })).toBe('туба 7,2 гр');
        expect(tubeFacingLabel({ characteristicValues: [weightChar('~ 24гр')] })).toBe('туба 24 гр');
        expect(tubeFacingLabel({ characteristicValues: [weightChar('8,5')] })).toBe('туба 8,5 гр');
    });

    it('falls back to grams in the description', () => {
        expect(tubeFacingLabel({ description: 'Минимальная фасовка: 1 туба - 170,54 руб (~ 10 гр)' })).toBe(
            'туба 10 гр',
        );
        expect(tubeFacingLabel({ description: 'ФАСОВКА ПОСТАВЩИКА: 1 туба - 273,6 руб (~ 24гр)' })).toBe(
            'туба 24 гр',
        );
        expect(tubeFacingLabel({ description: '1 туба - 290,7 руб (~8,2гр.)' })).toBe('туба 8,2 гр');
    });

    it('strips html entities from descriptions', () => {
        expect(tubeFacingLabel({ description: '<p>1&nbsp;туба&amp;детали</p><p>(~ 8,2 гр)</p>' })).toBe(
            'туба 8,2 гр',
        );
    });

    it('prefers the characteristic over the description', () => {
        expect(
            tubeFacingLabel({
                characteristicValues: [weightChar('~ 8 гр')],
                description: '1 туба - 100 руб (~ 10 гр)',
            }),
        ).toBe('туба 8 гр');
    });

    it('returns plain туба when grams are missing or empty', () => {
        expect(tubeFacingLabel({ description: 'Минимальная фасовка - 1 туба - 85,5 руб' })).toBe('туба');
        expect(tubeFacingLabel({ description: 'Минимальная фасовка - 1 туба (~ гр)' })).toBe('туба');
        expect(tubeFacingLabel({})).toBe('туба');
    });

    it('ignores non-weight characteristics and delica sizes', () => {
        expect(
            tubeFacingLabel({
                characteristicValues: [
                    { value: 'Стекло', characteristic: { name: 'Материал', position: 1 } },
                    { value: '11/0', characteristic: { name: 'Размер', position: 2 } },
                ],
                description: 'Miyuki Delica 11/0 DB0678 1 туба - 85,5 руб',
            }),
        ).toBe('туба');
    });
});
