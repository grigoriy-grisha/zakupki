import { describe, expect, it } from 'vitest';

import {
    getSupplementOrderQuantityValidationError,
    shouldDecrementSupplementStock,
    snapSupplementOrderQuantity,
} from '../src/supplement-order';

const minPack10 = {
    minPackageAmount: 10,
    minPackageUnit: 'гр',
    unitShort: 'гр',
};

describe('supplement order quantity', () => {
    const bounds40 = { availableQty: 40, currentQuantity: 0, supplierPackageAmount: 10 };
    const bounds45 = { availableQty: 45, currentQuantity: 0, supplierPackageAmount: 10 };

    it('allows up to remainder for partial order', () => {
        expect(getSupplementOrderQuantityValidationError(40, minPack10, bounds40)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(30, minPack10, bounds40)).toBeNull();
    });

    it('rejects over remainder when not a single pack', () => {
        expect(getSupplementOrderQuantityValidationError(45, minPack10, bounds40)).toMatch(
            /На добор можно заказать не более 40/,
        );
        expect(getSupplementOrderQuantityValidationError(60, minPack10, bounds45)).toMatch(
            /На добор можно заказать не более 45/,
        );
        expect(getSupplementOrderQuantityValidationError(50, minPack10, bounds40)).toMatch(
            /На добор можно заказать не более 40/,
        );
    });

    it('allows exactly one pack size even above remainder', () => {
        expect(getSupplementOrderQuantityValidationError(10, minPack10, bounds40)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack10, bounds45)).toBeNull();
    });

    it('allows partial from remainder in multiples of min step', () => {
        expect(getSupplementOrderQuantityValidationError(20, minPack10, bounds40)).toBeNull();
    });

    it('when remainder is less than pack: up to remainder or exactly one pack (шт/гр)', () => {
        const bounds11pack12 = { availableQty: 11, currentQuantity: 0, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(11, minPack1, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack1, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(13, minPack1, bounds11pack12)).toMatch(
            /новый остаток|не более 11/,
        );

        expect(getSupplementOrderQuantityValidationError(12, minPack10g, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(11, minPack10g, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(13, minPack10g, bounds11pack12)).toMatch(
            /новый остаток|не более 11/,
        );
    });

    it('when remainder < pack and user already has partial: allows up to max', () => {
        // Пользователь уже заказал 5, остаток 11 при пачке 12.
        // max = 5 + 11 = 16. Можно: до 16 (max) или ровно 12 (пачка).
        // Нельзя: 17 (между max и пачкой).
        const bounds = { availableQty: 11, currentQuantity: 5, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(16, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(11, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(13, minPack1, bounds)).toBeNull();
        // 17 > max (16) и не равно пачке (12)
        expect(getSupplementOrderQuantityValidationError(17, minPack1, bounds)).toMatch(/новый остаток|не более/);
    });

    it('stock 20 pack 50: rejects 30 (intermediate between stock and pack)', () => {
        const bounds20pack50 = { availableQty: 20, currentQuantity: 0, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        // Можно: ≤ 20 (остаток) или 50 (пачка)
        expect(getSupplementOrderQuantityValidationError(10, minPack10g, bounds20pack50)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(20, minPack10g, bounds20pack50)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(50, minPack10g, bounds20pack50)).toBeNull();

        // Нельзя: 30 (между остатком и пачкой)
        expect(getSupplementOrderQuantityValidationError(30, minPack10g, bounds20pack50)).toMatch(
            /новый остаток/,
        );
        expect(getSupplementOrderQuantityValidationError(40, minPack10g, bounds20pack50)).toMatch(
            /новый остаток/,
        );
    });

    it('stock 20 pack 50 with existing order: allows up to max, rejects between max and pack', () => {
        // Уже заказано 10, остаток 20, пачка 50.
        // max = 10 + 20 = 30. Можно: ≤ 30 или ровно 50. Нельзя: 31–49.
        const bounds = { availableQty: 20, currentQuantity: 10, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(getSupplementOrderQuantityValidationError(30, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(20, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(50, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(40, minPack10g, bounds)).toMatch(/новый остаток/);
    });

    it('when remainder is zero only exactly one pack', () => {
        const depleted = { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 10 };
        expect(getSupplementOrderQuantityValidationError(15, minPack10, depleted)).toMatch(/только одну пачку/);
        expect(getSupplementOrderQuantityValidationError(20, minPack10, depleted)).toMatch(/только одну пачку/);
        expect(getSupplementOrderQuantityValidationError(10, minPack10, depleted)).toBeNull();
    });

    it('does not decrement stock for exact one-pack order', () => {
        expect(shouldDecrementSupplementStock(10, 10, 45, 10)).toBe(false);
        expect(shouldDecrementSupplementStock(25, 25, 40, 10)).toBe(true);
    });

    it('snaps to remainder cap', () => {
        expect(snapSupplementOrderQuantity(45, minPack10, bounds40)).toBe(40);
        expect(snapSupplementOrderQuantity(60, minPack10, bounds45)).toBe(45);
        expect(snapSupplementOrderQuantity(10, minPack10, bounds45)).toBe(10);
    });

    it('snaps intermediate quantity down to remainder when stock < pack', () => {
        // Остаток 20, пачка 50. 30 → snap до 20 (остаток), не 30.
        const bounds = { availableQty: 20, currentQuantity: 0, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(snapSupplementOrderQuantity(30, minPack10g, bounds)).toBe(20);
        expect(snapSupplementOrderQuantity(50, minPack10g, bounds)).toBe(50);
        expect(snapSupplementOrderQuantity(20, minPack10g, bounds)).toBe(20);
    });

    it('snaps to max (= current + stock) with existing order', () => {
        // Уже 10, остаток 20, пачка 50. max = 30. Попытка 40 → snap до 30.
        const bounds = { availableQty: 20, currentQuantity: 10, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(snapSupplementOrderQuantity(30, minPack10g, bounds)).toBe(30);
        expect(snapSupplementOrderQuantity(40, minPack10g, bounds)).toBe(30);
        expect(snapSupplementOrderQuantity(50, minPack10g, bounds)).toBe(50);
    });

    it('allows reducing existing order when stock is zero', () => {
        // Уже заказано 5, остаток 0, пачка 12. Можно уменьшить до 1–5.
        const bounds = { availableQty: 0, currentQuantity: 5, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(3, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(1, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(5, minPack1, bounds)).toBeNull();
        // Увеличение без остатка — только пачка
        expect(getSupplementOrderQuantityValidationError(7, minPack1, bounds)).toMatch(/только одну пачку/);
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
    });

    it('snaps to valid step when reducing order with zero stock', () => {
        // Уже 5, остаток 0, пачка 12, шаг 1.
        const bounds = { availableQty: 0, currentQuantity: 5, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(snapSupplementOrderQuantity(3, minPack1, bounds)).toBe(3);
        expect(snapSupplementOrderQuantity(5, minPack1, bounds)).toBe(5);
        // Попытка увеличить без остатка → snap к пачке
        expect(snapSupplementOrderQuantity(7, minPack1, bounds)).toBe(12);
        expect(snapSupplementOrderQuantity(12, minPack1, bounds)).toBe(12);
    });

    it('treats null availableQty as zero stock: only pack or reduce', () => {
        // availableQty=null (не установлен) → treated as 0
        const bounds = { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(3, minPack1, bounds)).toMatch(/только одну пачку/);
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
    });

    it('stock 5 pack 12 existing order 2: allows up to max (7) or pack (12)', () => {
        // Остаток 5, уже заказано 2, пачка 12.
        // max = 2 + 5 = 7. Можно: ≤ 7 или ровно 12. Нельзя: 8–11, 10.
        const bounds = { availableQty: 5, currentQuantity: 2, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(7, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(5, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack1, bounds)).toMatch(/новый остаток|не более/);
        expect(getSupplementOrderQuantityValidationError(8, minPack1, bounds)).toMatch(/новый остаток|не более/);
    });
});
