import { describe, expect, it } from 'vitest';

import {
    SUPPLEMENT_MIN_ORDER_QTY,
    formatSupplementPhotoRemainderBadge,
    formatSupplementCardPreviewHint,
    formatSupplementMinOrderPreviewHint,
    getSupplementEffectiveMinQty,
    getSupplementMinOrderQty,
    getSupplementOrderQuantityValidationError,
    isSupplementOnlyPacksOrder,
    isSupplementPacksAllowed,
    getSupplementUiOrderStep,
    shouldDecrementSupplementStock,
    snapSupplementOrderQuantity,
} from '../src/supplement-order';
import { isSupplementRemainderOnlyPhase } from '../src/index';

const minPack10 = {
    minPackageAmount: 10,
    minPackageUnit: 'гр',
    unitShort: 'гр',
};

describe('formatSupplementPhotoRemainderBadge', () => {
    it('shows remainder on thumbnail', () => {
        expect(
            formatSupplementPhotoRemainderBadge(
                { availableQty: 40, currentQuantity: 0, supplierPackageAmount: 45 },
                { minPackageUnit: 'гр', unitShort: 'гр' },
            ),
        ).toBe('остаток 40 гр');
    });

    it('zero remainder on PAYMENT phase', () => {
        expect(
            formatSupplementPhotoRemainderBadge(
                { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 45, remainderOnly: true },
                { unitShort: 'гр' },
            ),
        ).toBe('остаток 0');
    });
});

describe('formatSupplementCardPreviewHint', () => {
    it('combines remainder and min order in one line', () => {
        expect(
            formatSupplementCardPreviewHint(
                { availableQty: 40, currentQuantity: 0, supplierPackageAmount: 45 },
                { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' },
            ),
        ).toBe('Добор · остаток 40 гр · от 10 гр');
    });

    it('when remainder is zero: only packs, not «от …»', () => {
        expect(
            formatSupplementCardPreviewHint(
                { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 45 },
                { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' },
                { soldOut: true },
            ),
        ).toBe('Добор · только пачками');
    });

    it('when remainder is zero on PAYMENT phase: no packs hint', () => {
        expect(
            formatSupplementCardPreviewHint(
                {
                    availableQty: 0,
                    currentQuantity: 0,
                    supplierPackageAmount: 45,
                    remainderOnly: true,
                },
                { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' },
            ),
        ).toBe('Добор · остаток закончился');
    });

    it('low remainder: only packs without «от …»', () => {
        expect(
            formatSupplementCardPreviewHint(
                { availableQty: 3, currentQuantity: 0, supplierPackageAmount: 45 },
                { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' },
            ),
        ).toBe('Добор · остаток 3 гр · только пачками');
    });

    it('shows unlimited stock', () => {
        expect(
            formatSupplementCardPreviewHint(
                { availableQty: null, currentQuantity: 0, supplierPackageAmount: null },
                { unitShort: 'гр' },
            ),
        ).toBe('Добор · от 10 гр');
    });

    it('piece product: от 1 шт', () => {
        expect(
            formatSupplementCardPreviewHint(
                { availableQty: 5, currentQuantity: 0, supplierPackageAmount: 12 },
                { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' },
            ),
        ).toBe('Добор · остаток 5 шт · от 1 шт');
    });
});

describe('supplement UI step and min', () => {
    const optsGr = { minPackageAmount: 5, minPackageUnit: 'гр', unitShort: 'гр' };
    const optsSht = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

    it('raises catalog step 5 to 10 on доборе (гр)', () => {
        expect(getSupplementUiOrderStep(5, optsGr)).toBe(SUPPLEMENT_MIN_ORDER_QTY);
        expect(getSupplementEffectiveMinQty(5, optsGr)).toBe(SUPPLEMENT_MIN_ORDER_QTY);
    });

    it('piece product: min 1 шт on доборе', () => {
        expect(getSupplementMinOrderQty(optsSht)).toBe(1);
        expect(getSupplementUiOrderStep(1, optsSht)).toBe(1);
        expect(getSupplementEffectiveMinQty(1, optsSht)).toBe(1);
    });

    it('keeps step when already >= supplement min', () => {
        expect(getSupplementUiOrderStep(10, optsGr)).toBe(10);
        expect(getSupplementEffectiveMinQty(12, optsGr)).toBe(12);
    });
});

describe('isSupplementRemainderOnlyPhase', () => {
    it('true from PAYMENT until before PACKAGING', () => {
        expect(isSupplementRemainderOnlyPhase('PAYMENT')).toBe(true);
        expect(isSupplementRemainderOnlyPhase('IN_TRANSIT_TO_ORGANIZER')).toBe(true);
        expect(isSupplementRemainderOnlyPhase('PACKAGING')).toBe(false);
        expect(isSupplementRemainderOnlyPhase('REORDER')).toBe(false);
        expect(isSupplementRemainderOnlyPhase('COLLECTION')).toBe(false);
    });
});

describe('remainder-only supplement (PAYMENT…before PACKAGING)', () => {
    const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };
    const bounds20pack50 = {
        availableQty: 20,
        currentQuantity: 0,
        supplierPackageAmount: 50,
        remainderOnly: true,
    };

    it('rejects whole pack on increase', () => {
        expect(getSupplementOrderQuantityValidationError(50, minPack10g, bounds20pack50)).toMatch(
            /только из свободного остатка/,
        );
        expect(getSupplementOrderQuantityValidationError(20, minPack10g, bounds20pack50)).toBeNull();
    });

    it('packs not allowed in UI flag', () => {
        expect(isSupplementPacksAllowed(bounds20pack50)).toBe(false);
    });

    it('snap does not jump to pack size', () => {
        expect(snapSupplementOrderQuantity(50, minPack10g, bounds20pack50)).toBe(20);
    });
});

describe('isSupplementOnlyPacksOrder', () => {
    const optsGr = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

    it('true when remainder is zero', () => {
        expect(
            isSupplementOnlyPacksOrder(
                { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 45 },
                optsGr,
            ),
        ).toBe(true);
    });

    it('true when remainder below supplement min', () => {
        expect(
            isSupplementOnlyPacksOrder(
                { availableQty: 8, currentQuantity: 0, supplierPackageAmount: 45 },
                optsGr,
            ),
        ).toBe(true);
    });

    it('false when unlimited stock', () => {
        expect(
            isSupplementOnlyPacksOrder(
                { availableQty: null, currentQuantity: 0, supplierPackageAmount: 45 },
                optsGr,
            ),
        ).toBe(false);
    });

    it('false when enough remainder for partial order', () => {
        expect(
            isSupplementOnlyPacksOrder(
                { availableQty: 40, currentQuantity: 0, supplierPackageAmount: 45 },
                optsGr,
            ),
        ).toBe(false);
    });
});

describe('supplement order quantity', () => {
    const bounds40 = { availableQty: 40, currentQuantity: 0, supplierPackageAmount: 10 };
    const bounds45 = { availableQty: 45, currentQuantity: 0, supplierPackageAmount: 10 };

    it('allows up to remainder for partial order', () => {
        expect(getSupplementOrderQuantityValidationError(40, minPack10, bounds40)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(30, minPack10, bounds40)).toBeNull();
    });

    it('rejects over remainder when not whole packs', () => {
        expect(getSupplementOrderQuantityValidationError(45, minPack10, bounds40)).toMatch(
            /На добор можно заказать не более 40/,
        );
        // 60 при packSize=10 — 6 пачок, кратно → разрешено
        expect(getSupplementOrderQuantityValidationError(60, minPack10, bounds45)).toBeNull();
        // 50 при packSize=10 — 5 пачок, кратно → разрешено
        expect(getSupplementOrderQuantityValidationError(50, minPack10, bounds40)).toBeNull();
    });

    it('allows any whole pack multiple', () => {
        // pack size = 10
        expect(getSupplementOrderQuantityValidationError(10, minPack10, bounds40)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(20, minPack10, bounds40)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(30, minPack10, bounds40)).toBeNull();
    });

    it('allows partial from remainder in multiples of min step', () => {
        expect(getSupplementOrderQuantityValidationError(20, minPack10, bounds40)).toBeNull();
    });

    it('when remainder is less than pack: up to remainder or whole packs', () => {
        const bounds11pack12 = { availableQty: 11, currentQuantity: 0, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(11, minPack1, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack1, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(13, minPack1, bounds11pack12)).toMatch(
            /не более 11|целыми пачками/,
        );
        // 24 = 2 пачки — кратно, разрешено
        expect(getSupplementOrderQuantityValidationError(24, minPack1, bounds11pack12)).toBeNull();

        expect(getSupplementOrderQuantityValidationError(12, minPack10g, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(11, minPack10g, bounds11pack12)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(13, minPack10g, bounds11pack12)).toMatch(
            /не более 11|целыми пачками/,
        );
    });

    it('when remainder < pack and user already has partial: min 1 шт on delta for pieces, allows packs', () => {
        const bounds = { availableQty: 11, currentQuantity: 5, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(16, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(11, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(13, minPack1, bounds)).toBeNull();
        // 17 = 5 + 12: добавляется ровно одна пачка — разрешено
        expect(getSupplementOrderQuantityValidationError(17, minPack1, bounds)).toBeNull();
        // 29 = 5 + 24: добавляется 2 пачки — разрешено
        expect(getSupplementOrderQuantityValidationError(29, minPack1, bounds)).toBeNull();
        // 18: добавка 13, не кратно пачке, и итог > max
        expect(getSupplementOrderQuantityValidationError(18, minPack1, bounds)).toMatch(/не более|целыми пачками/);
    });

    it('stock 20 pack 50: rejects 30 (intermediate between stock and pack)', () => {
        const bounds20pack50 = { availableQty: 20, currentQuantity: 0, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(getSupplementOrderQuantityValidationError(10, minPack10g, bounds20pack50)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(20, minPack10g, bounds20pack50)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(50, minPack10g, bounds20pack50)).toBeNull();
        // 100 = 2 пачки — кратно, разрешено
        expect(getSupplementOrderQuantityValidationError(100, minPack10g, bounds20pack50)).toBeNull();

        expect(getSupplementOrderQuantityValidationError(30, minPack10g, bounds20pack50)).toMatch(
            /не более 20|целыми пачками/,
        );
        expect(getSupplementOrderQuantityValidationError(40, minPack10g, bounds20pack50)).toMatch(
            /не более 20|целыми пачками/,
        );
    });

    it('stock 20 pack 50 with existing order: allows up to max, rejects between max and pack', () => {
        const bounds = { availableQty: 20, currentQuantity: 10, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(getSupplementOrderQuantityValidationError(30, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(20, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(50, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack10g, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(40, minPack10g, bounds)).toMatch(/не более|целыми пачками/);
    });

    it('when remainder is zero: only whole pack multiples', () => {
        const depleted = { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 10 };
        expect(getSupplementOrderQuantityValidationError(15, minPack10, depleted)).toMatch(/целыми пачками/);
        expect(getSupplementOrderQuantityValidationError(25, minPack10, depleted)).toMatch(/целыми пачками/);
        // 10, 20, 30 — целые пачки
        expect(getSupplementOrderQuantityValidationError(10, minPack10, depleted)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(20, minPack10, depleted)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(30, minPack10, depleted)).toBeNull();
    });

    it('does not decrement stock for whole pack orders', () => {
        expect(shouldDecrementSupplementStock(10, 10, 45, 10)).toBe(false);
        expect(shouldDecrementSupplementStock(20, 20, 45, 10)).toBe(false);
        expect(shouldDecrementSupplementStock(25, 25, 40, 10)).toBe(true);
    });

    it('snaps to remainder cap or keeps whole pack multiples', () => {
        expect(snapSupplementOrderQuantity(45, minPack10, bounds40)).toBe(40);
        // 60 при packSize=10 — 6 пачок, кратно → оставляем как есть
        expect(snapSupplementOrderQuantity(60, minPack10, bounds45)).toBe(60);
        expect(snapSupplementOrderQuantity(10, minPack10, bounds45)).toBe(10);
    });

    it('snaps intermediate quantity down to remainder when stock < pack', () => {
        const bounds = { availableQty: 20, currentQuantity: 0, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(snapSupplementOrderQuantity(30, minPack10g, bounds)).toBe(20);
        expect(snapSupplementOrderQuantity(50, minPack10g, bounds)).toBe(50);
        expect(snapSupplementOrderQuantity(20, minPack10g, bounds)).toBe(20);
        // 100 = 2 пачки — кратно
        expect(snapSupplementOrderQuantity(100, minPack10g, bounds)).toBe(100);
    });

    it('snaps to max (= current + stock) with existing order', () => {
        const bounds = { availableQty: 20, currentQuantity: 10, supplierPackageAmount: 50 };
        const minPack10g = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };

        expect(snapSupplementOrderQuantity(30, minPack10g, bounds)).toBe(30);
        expect(snapSupplementOrderQuantity(40, minPack10g, bounds)).toBe(30);
        expect(snapSupplementOrderQuantity(50, minPack10g, bounds)).toBe(50);
    });

    it('allows reducing existing order when stock is zero', () => {
        const bounds = { availableQty: 0, currentQuantity: 5, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(3, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(1, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(5, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(7, minPack1, bounds)).toMatch(/целыми пачками/);
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
        // 24 = 2 пачки — тоже разрешено
        expect(getSupplementOrderQuantityValidationError(24, minPack1, bounds)).toBeNull();
    });

    it('snaps to valid step when reducing order with zero stock', () => {
        const bounds = { availableQty: 0, currentQuantity: 5, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(snapSupplementOrderQuantity(3, minPack1, bounds)).toBe(3);
        expect(snapSupplementOrderQuantity(5, minPack1, bounds)).toBe(5);
        expect(snapSupplementOrderQuantity(7, minPack1, bounds)).toBe(12);
        expect(snapSupplementOrderQuantity(12, minPack1, bounds)).toBe(12);
    });

    it('treats null availableQty as zero stock: only pack multiples or reduce', () => {
        const bounds = { availableQty: 0, currentQuantity: 0, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(3, minPack1, bounds)).toMatch(/целыми пачками/);
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(24, minPack1, bounds)).toBeNull();
    });

    it('stock 5 pack 12 existing order 2 шт: partial from remainder allowed (min 1 шт)', () => {
        const bounds = { availableQty: 5, currentQuantity: 2, supplierPackageAmount: 12 };
        const minPack1 = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

        expect(getSupplementOrderQuantityValidationError(7, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(12, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(2, minPack1, bounds)).toBeNull();
        expect(getSupplementOrderQuantityValidationError(10, minPack1, bounds)).toMatch(/целыми пачками/);
        expect(getSupplementOrderQuantityValidationError(8, minPack1, bounds)).toMatch(/целыми пачками/);
        // 24 = 2 пачки — кратно, разрешено
        expect(getSupplementOrderQuantityValidationError(24, minPack1, bounds)).toBeNull();
    });
});
