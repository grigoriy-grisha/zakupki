import { describe, expect, it } from 'vitest';

import {
    SUPPLEMENT_MIN_ORDER_QTY,
    formatSupplementCardPreviewHint,
    formatSupplementPhotoRemainderBadge,
    getDisplayedSupplementRemainder,
    getSupplementEffectiveMinQty,
    getSupplementMaxPacks,
    getSupplementMinOrderQty,
    getSupplementOrderValidationError,
    getSupplementUiOrderStep,
    isSupplementPacksAllowed,
    isSupplementRemainderOnlyPhase,
    isValidSupplementOrder,
    snapSupplementOrder,
    type SupplementLineState,
} from '../src/supplement';

const gramsOptions = { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' };
const piecesOptions = { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' };

const stateRem40Pack200 = (): SupplementLineState => ({
    supplementPacks: 0,
    supplementRemainder: 0,
    packSize: 200,
    maxRemainder: 40,
});

describe('isSupplementRemainderOnlyPhase', () => {
    it('true from PAYMENT until before PACKAGING', () => {
        expect(isSupplementRemainderOnlyPhase('PAYMENT')).toBe(true);
        expect(isSupplementRemainderOnlyPhase('IN_TRANSIT_TO_ORGANIZER')).toBe(true);
        expect(isSupplementRemainderOnlyPhase('PACKAGING')).toBe(false);
        expect(isSupplementRemainderOnlyPhase('REORDER')).toBe(false);
        expect(isSupplementRemainderOnlyPhase('COLLECTION')).toBe(false);
    });

    it('null/undefined treated as COLLECTION (returns false)', () => {
        expect(isSupplementRemainderOnlyPhase(null)).toBe(false);
        expect(isSupplementRemainderOnlyPhase(undefined)).toBe(false);
    });
});

describe('getSupplementMinOrderQty / UiOrderStep / EffectiveMinQty', () => {
    it('grams: 10', () => {
        expect(getSupplementMinOrderQty(gramsOptions)).toBe(SUPPLEMENT_MIN_ORDER_QTY);
        expect(getSupplementUiOrderStep(5, gramsOptions)).toBe(SUPPLEMENT_MIN_ORDER_QTY);
        expect(getSupplementEffectiveMinQty(5, gramsOptions)).toBe(SUPPLEMENT_MIN_ORDER_QTY);
    });

    it('pieces: 1', () => {
        expect(getSupplementMinOrderQty(piecesOptions)).toBe(1);
        expect(getSupplementUiOrderStep(1, piecesOptions)).toBe(1);
        expect(getSupplementEffectiveMinQty(1, piecesOptions)).toBe(1);
    });

    it('keeps larger catalog step/min', () => {
        expect(getSupplementUiOrderStep(20, gramsOptions)).toBe(20);
        expect(getSupplementEffectiveMinQty(12, gramsOptions)).toBe(12);
    });
});

describe('getSupplementOrderValidationError', () => {
    it('rejects negative packs', () => {
        expect(getSupplementOrderValidationError(-1, 0, gramsOptions, stateRem40Pack200(), 'REORDER')).toMatch(
            /пачек/,
        );
    });

    it('allows negative remainder on REORDER (user reduced below base)', () => {
        // В REORDER пользователь может уменьшить ниже базы — remainder уходит в минус.
        expect(getSupplementOrderValidationError(0, -5, gramsOptions, stateRem40Pack200(), 'REORDER')).toBeNull();
    });

    it('rejects negative remainder on PAYMENT+ phase', () => {
        // На PAYMENT+ нельзя уменьшать ниже базы.
        expect(getSupplementOrderValidationError(0, -5, gramsOptions, stateRem40Pack200(), 'PAYMENT')).toMatch(
            /уменьшить ниже базового/,
        );
    });

    it('rejects fractional packs', () => {
        expect(getSupplementOrderValidationError(1.5, 0, gramsOptions, stateRem40Pack200(), 'REORDER')).toMatch(
            /целым/,
        );
    });

    it('allows zero on all fields', () => {
        expect(getSupplementOrderValidationError(0, 0, gramsOptions, stateRem40Pack200(), 'REORDER')).toBeNull();
    });

    it('rejects remainder > maxRemainder', () => {
        expect(
            getSupplementOrderValidationError(0, 50, gramsOptions, stateRem40Pack200(), 'REORDER'),
        ).toMatch(/не более 40/);
    });

    it('allows remainder within bounds', () => {
        expect(getSupplementOrderValidationError(0, 30, gramsOptions, stateRem40Pack200(), 'REORDER')).toBeNull();
        expect(getSupplementOrderValidationError(0, 40, gramsOptions, stateRem40Pack200(), 'REORDER')).toBeNull();
    });

    it('rejects remainder < supplementMin when > 0', () => {
        expect(getSupplementOrderValidationError(0, 5, gramsOptions, stateRem40Pack200(), 'REORDER')).toMatch(
            /Минимальный заказ/,
        );
    });

    it('rejects packs on PAYMENT phase', () => {
        expect(
            getSupplementOrderValidationError(1, 0, gramsOptions, stateRem40Pack200(), 'PAYMENT'),
        ).toMatch(/свободного остатка/);
        expect(
            getSupplementOrderValidationError(1, 0, gramsOptions, stateRem40Pack200(), 'IN_TRANSIT_TO_ORGANIZER'),
        ).toMatch(/свободного остатка/);
    });

    it('allows packs on REORDER', () => {
        expect(
            getSupplementOrderValidationError(5, 30, gramsOptions, stateRem40Pack200(), 'REORDER'),
        ).toBeNull();
    });

    it('rejects non-finite values', () => {
        expect(
            getSupplementOrderValidationError(NaN, 0, gramsOptions, stateRem40Pack200(), 'REORDER'),
        ).toMatch(/Некорректные/);
        expect(
            getSupplementOrderValidationError(0, Infinity, gramsOptions, stateRem40Pack200(), 'REORDER'),
        ).toMatch(/Некорректные/);
    });

    it('pieces: min 1 шт', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 12, maxRemainder: 5 };
        expect(getSupplementOrderValidationError(0, 1, piecesOptions, state, 'REORDER')).toBeNull();
        expect(getSupplementOrderValidationError(0, 5, piecesOptions, state, 'REORDER')).toBeNull();
    });
});

describe('isValidSupplementOrder', () => {
    it('inverts validation', () => {
        expect(isValidSupplementOrder(0, 30, gramsOptions, stateRem40Pack200(), 'REORDER')).toBe(true);
        expect(isValidSupplementOrder(0, 50, gramsOptions, stateRem40Pack200(), 'REORDER')).toBe(false);
    });
});

describe('snapSupplementOrder', () => {
    it('clamps remainder to maxRemainder', () => {
        expect(snapSupplementOrder(0, 50, gramsOptions, stateRem40Pack200())).toEqual({
            packs: 0,
            remainder: 40,
        });
    });

    it('rounds packs to integer', () => {
        expect(snapSupplementOrder(2.7, 0, gramsOptions, stateRem40Pack200())).toEqual({
            packs: 3,
            remainder: 0,
        });
    });

    it('clamps negative packs to 0', () => {
        expect(snapSupplementOrder(-1, 0, gramsOptions, stateRem40Pack200())).toEqual({
            packs: 0,
            remainder: 0,
        });
    });

    it('zeroes remainder if < supplementMin and > 0', () => {
        expect(snapSupplementOrder(0, 5, gramsOptions, stateRem40Pack200())).toEqual({
            packs: 0,
            remainder: 0,
        });
    });

    it('preserves exact valid values', () => {
        expect(snapSupplementOrder(2, 30, gramsOptions, stateRem40Pack200())).toEqual({
            packs: 2,
            remainder: 30,
        });
    });

    it('pieces: 1 шт works', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 12, maxRemainder: 5 };
        expect(snapSupplementOrder(0, 1, piecesOptions, state)).toEqual({ packs: 0, remainder: 1 });
        expect(snapSupplementOrder(0, 0, piecesOptions, state)).toEqual({ packs: 0, remainder: 0 });
    });
});

describe('getSupplementMaxPacks / isSupplementPacksAllowed', () => {
    it('maxPacks is Infinity', () => {
        expect(getSupplementMaxPacks()).toBe(Number.POSITIVE_INFINITY);
    });

    it('packs allowed on REORDER and COLLECTION, blocked on PAYMENT…PACKAGING', () => {
        expect(isSupplementPacksAllowed('REORDER')).toBe(true);
        expect(isSupplementPacksAllowed('COLLECTION')).toBe(true);
        expect(isSupplementPacksAllowed('PAYMENT')).toBe(false);
        expect(isSupplementPacksAllowed('PACKAGING')).toBe(true);
    });
});

describe('formatSupplementPhotoRemainderBadge', () => {
    it('shows remainder when available', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 45, maxRemainder: 40 };
        expect(formatSupplementPhotoRemainderBadge(state, { unitShort: 'гр' })).toBe('остаток 40 гр');
    });

    it('shows "остаток 0" on PAYMENT phase', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 45, maxRemainder: 0 };
        expect(formatSupplementPhotoRemainderBadge(state, { unitShort: 'гр' }, 'PAYMENT')).toBe('остаток 0');
    });

    it('shows "остаток 0 · пачки" on REORDER phase', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 45, maxRemainder: 0 };
        expect(formatSupplementPhotoRemainderBadge(state, { unitShort: 'гр' }, 'REORDER')).toBe(
            'остаток 0 · пачки',
        );
    });
});

describe('formatSupplementCardPreviewHint', () => {
    it('combines remainder and min order in one line', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 45, maxRemainder: 40 };
        expect(
            formatSupplementCardPreviewHint(state, { minPackageAmount: 10, minPackageUnit: 'гр', unitShort: 'гр' }),
        ).toBe('Добор · остаток 40 гр · от 10 гр');
    });

    it('zero remainder: only packs', () => {
        const state = { supplementPacks: 0, supplementRemainder: 0, packSize: 45, maxRemainder: 0 };
        expect(
            formatSupplementCardPreviewHint(
                state,
                { minPackageAmount: 1, minPackageUnit: 'шт', unitShort: 'шт' },
                { soldOut: true },
            ),
        ).toBe('Добор · разобрано');
    });
});

describe('getDisplayedSupplementRemainder', () => {
    // Сценарий из задачи: пачка 50, заказали 280 → 6 пачек = 300, остаток 20.
    it('auto-calc: pack=50, ordered=280 → 20', () => {
        expect(
            getDisplayedSupplementRemainder({
                availableQty: null,
                totalOrderedQuantity: 280,
                totalReservedRemainder: 0,
                packSize: 50,
            }),
        ).toBe(20);
    });

    it('auto-calc: ordered exactly a multiple of pack → 0', () => {
        expect(
            getDisplayedSupplementRemainder({
                availableQty: null,
                totalOrderedQuantity: 300,
                totalReservedRemainder: 0,
                packSize: 50,
            }),
        ).toBe(0);
    });

    it('auto-calc: ordered more than a multiple → space left in next pack', () => {
        // 320 заказано при пачке 50 → нужно 7 пачек (350), остаток = 30.
        expect(
            getDisplayedSupplementRemainder({
                availableQty: null,
                totalOrderedQuantity: 320,
                totalReservedRemainder: 0,
                packSize: 50,
            }),
        ).toBe(30);
    });

    it('admin manual: availableQty takes precedence over auto-calc', () => {
        // С auto-calc было бы 20, но админ выставил 100, и никто ещё не зарезервировал.
        expect(
            getDisplayedSupplementRemainder({
                availableQty: 100,
                totalOrderedQuantity: 280,
                totalReservedRemainder: 0,
                packSize: 50,
            }),
        ).toBe(100);
    });

    it('admin manual: subtract already reserved remainder', () => {
        // Админ выставил 100, юзеры уже зарезервировали 30.
        expect(
            getDisplayedSupplementRemainder({
                availableQty: 100,
                totalOrderedQuantity: 280,
                totalReservedRemainder: 30,
                packSize: 50,
            }),
        ).toBe(70);
    });

    it('returns null only when no availableQty AND no packSize', () => {
        expect(
            getDisplayedSupplementRemainder({
                availableQty: null,
                totalOrderedQuantity: 0,
                totalReservedRemainder: 0,
                packSize: null,
            }),
        ).toBeNull();
    });
});
