import { describe, expect, it } from 'vitest';

import type { BotPurchaseOrderDetail } from '@/server/bot/services/bot/bot-order.service';
import type { PurchasePaymentInfo } from '@/server/services/bot-payment.service';

import { formatPurchaseDetail } from '../orders.callback';

function makeLine(id: number, overrides: Partial<BotPurchaseOrderDetail['lines'][number]> = {}) {
    return {
        id,
        quantity: 10,
        packageCount: 0,
        amountDue: 500,
        status: 'ACTIVE',
        purchaseItem: {
            id,
            unitCode: 'gram',
            packAmount: null,
            product: { name: `Товар номер ${id} для проверки упаковки строк`, articleNumber: `ART-${id}`, unitCode: 'gram' },
            purchase: { fulfillmentStatus: 'REORDER' },
        },
        priceInfo: null,
        ...overrides,
    } as BotPurchaseOrderDetail['lines'][number];
}

function makeDetail(lineCount: number): BotPurchaseOrderDetail {
    return {
        purchaseOrderId: 42,
        tag: 'СЗ10_ТЕСТ',
        totalDue: lineCount * 500,
        lines: Array.from({ length: lineCount }, (_, i) => makeLine(i + 1)),
    };
}

const payment: PurchasePaymentInfo = {
    due: 1000,
    paid: 400,
    pending: 0,
    hasPending: false,
    available: 600,
    tag: 'СЗ10_ТЕСТ',
    breakdown: null,
};

describe('formatPurchaseDetail', () => {
    const normalize = (s: string) => s.replace(/\u00a0/g, ' ');

    it('renders all lines when the order fits the limit', () => {
        const text = formatPurchaseDetail(makeDetail(3), 5, null, 'REORDER');
        for (let i = 1; i <= 3; i++) expect(text).toContain(`ART-${i}`);
        expect(normalize(text)).toContain('Итого: 1 500 ₽');
        expect(text).not.toContain('и ещё');
    });

    it('packs overflowing orders into the tail summary and stays under the Telegram limit', () => {
        const text = formatPurchaseDetail(makeDetail(120), 5, payment, 'PAYMENT');

        expect(text).toContain('и ещё');
        expect(text).toContain('полный список в приложении');
        expect(normalize(text)).toContain('Итого: 60 000 ₽');
        expect(normalize(text)).toContain('К оплате: 600 ₽');
        expect(text.length).toBeLessThanOrEqual(4096);
    });

    it('always keeps header, total and payment block even when almost nothing fits', () => {
        const text = formatPurchaseDetail(makeDetail(120), 5, payment, 'REORDER');

        expect(text).toContain('Заказ №42');
        expect(text).toContain('СЗ10_ТЕСТ');
        expect(text).toContain('Статус:');
        expect(text.indexOf('Статус:')).toBeLessThan(text.indexOf('Итого:'));
    });

    it('shows the skipped amount matching the omitted lines', () => {
        const detail = makeDetail(120);
        const text = formatPurchaseDetail(detail, 5, null, 'REORDER');

        const match = /и ещё (\d+) поз\. на ([\d\s\u00a0]+) ₽/.exec(text);
        expect(match).not.toBeNull();
        const skippedCount = Number(match![1]!.replace(/\D/g, ''));
        const skippedAmount = Number(match![2]!.replace(/[\s\u00a0]/g, ''));
        const shownCount = 120 - skippedCount;

        expect(skippedCount).toBeGreaterThan(0);
        expect(skippedCount + shownCount).toBe(120);
        expect(skippedAmount).toBe(skippedCount * 500);
    });
});
