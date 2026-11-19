import { describe, expect, it } from 'vitest';

import { buildPaymentBreakdown, type PaymentBreakdownLine } from '../payment-breakdown';

const LINES: PaymentBreakdownLine[] = [
    { name: 'Miyuki DB-0031 — 25 гр', amountDue: 120, base: 100, delivery: 8, org: 12 },
    { name: 'Preciosa Хрусталь — 10 шт', amountDue: 86, base: 70, delivery: 6.4, org: 9.6 },
    { name: 'Отменённая позиция', amountDue: 0, base: 0, delivery: 0, org: 0 },
];

const sum = (xs: { amount: number }[]) => Math.round(xs.reduce((s, x) => s + x.amount, 0) * 100) / 100;

describe('buildPaymentBreakdown', () => {
    it('full payment: each product, delivery, org fee and bank fee as separate items', () => {
        const b = buildPaymentBreakdown({ tag: '#С310', lines: LINES, due: 206, amount: 206, discount: 0, fee: 4.12 });
        expect(b.items.map((i) => [i.kind, i.name, i.amount])).toEqual([
            ['goods', 'Miyuki DB-0031 — 25 гр', 100],
            ['goods', 'Preciosa Хрусталь — 10 шт', 70],
            ['delivery', 'Доставка от поставщика', 14.4],
            ['org', 'Организационный сбор', 21.6],
            ['fee', 'Комиссия банка за онлайн-оплату', 4.12],
        ]);
        expect(b.partial).toBe(false);
        expect(sum(b.items)).toBe(210.12);
        expect(b.description).toBe(
            'Оплата заказа #С310: товары (2 поз.) 170 руб., доставка 14,40 руб., оргсбор 21,60 руб., комиссия банка 4,12 руб.',
        );
    });

    it('partial payment scales items so they add up to the paid amount exactly', () => {
        const b = buildPaymentBreakdown({ tag: '#С310', lines: LINES, due: 206, amount: 100, discount: 0, fee: 0 });
        expect(b.partial).toBe(true);
        expect(sum(b.items)).toBe(100);
        expect(b.description.startsWith('Частичная оплата заказа #С310 (заказ на 206 руб.)')).toBe(true);
        expect(b.description.length).toBeLessThanOrEqual(140);
    });

    it('promo discount reduces items and is named in the description', () => {
        const b = buildPaymentBreakdown({ tag: '#С310', lines: LINES, due: 206, amount: 206, discount: 20.6, fee: 0 });
        expect(sum(b.items)).toBe(185.4);
        expect(b.description).toContain('скидка 20,60 руб.');
    });

    it('lines without price breakdown go as goods for the full amount', () => {
        const b = buildPaymentBreakdown({
            tag: '#С1',
            lines: [{ name: 'Товар — 1 шт', amountDue: 50, base: null, delivery: 0, org: 0 }],
            due: 50,
            amount: 50,
            discount: 0,
            fee: 0,
        });
        expect(b.items).toEqual([{ kind: 'goods', name: 'Товар — 1 шт', amount: 50 }]);
    });

    it('no lines falls back to a single order item', () => {
        const b = buildPaymentBreakdown({ tag: '#С1', lines: [], due: 50, amount: 50, discount: 0, fee: 1 });
        expect(b.items.map((i) => i.kind)).toEqual(['goods', 'fee']);
        expect(sum(b.items)).toBe(51);
    });

    it('many products are capped and the tail is merged', () => {
        const lines = Array.from({ length: 150 }, (_, i) => ({
            name: `Товар ${i}`,
            amountDue: 1.1,
            base: 1,
            delivery: 0.05,
            org: 0.05,
        }));
        const b = buildPaymentBreakdown({ tag: '#С1', lines, due: 165, amount: 165, discount: 0, fee: 0 });
        expect(b.items.filter((i) => i.kind === 'goods')).toHaveLength(90);
        expect(sum(b.items)).toBe(165);
    });

    it('negative delivery or org part moves into the largest item, receipt sum stays equal to the payment', () => {
        // Цена за грамм округлена до копеек: клиент платит 130, а база с оргсбором — 133,68.
        const lines: PaymentBreakdownLine[] = [
            { name: 'Бисер — 1000 гр', amountDue: 130, base: 121.53, delivery: -3.68, org: 12.15 },
        ];
        const full = buildPaymentBreakdown({ tag: '#С1', lines, due: 130, amount: 130, discount: 0, fee: 3.9 });
        expect(full.items.every((i) => i.amount > 0)).toBe(true);
        expect(sum(full.items)).toBe(133.9);
        expect(full.items.find((i) => i.kind === 'delivery')).toBeUndefined();

        const part = buildPaymentBreakdown({ tag: '#С1', lines, due: 130, amount: 50, discount: 5, fee: 0 });
        expect(part.items.every((i) => i.amount > 0)).toBe(true);
        expect(sum(part.items)).toBe(45);
    });
});
