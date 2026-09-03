import { describe, expect, it } from 'vitest';

import { getOrderQuantityHint } from '../order-hints';

describe('getOrderQuantityHint', () => {
    it('returns general hint on collection stage', () => {
        const hint = getOrderQuantityHint('COLLECTION');
        expect(hint).toContain('Напишите количество числом');
        expect(hint).toContain('+2п');
    });

    it('returns dobor hint on reorder stage', () => {
        const hint = getOrderQuantityHint('REORDER');
        expect(hint).toContain('На этапе «Добор»');
        expect(hint).toContain('1п = 1 целая пачка поставщика');
    });

    it('returns payment hint on payment stage', () => {
        const hint = getOrderQuantityHint('PAYMENT');
        expect(hint).toContain('🧵Пора оплачивать заказ🧵');
        expect(hint).toContain('5 = 5 гр');
        expect(hint).not.toContain('«п»');
    });

    it('returns payment hint on later stages', () => {
        expect(getOrderQuantityHint('SUPPLIER_ASSEMBLY')).toContain('Пора оплачивать заказ');
        expect(getOrderQuantityHint('PACKAGING')).toContain('Пора оплачивать заказ');
    });

    it('falls back to general hint without stage', () => {
        expect(getOrderQuantityHint(null)).toContain('Напишите количество числом');
        expect(getOrderQuantityHint(undefined)).toContain('Напишите количество числом');
    });
});
