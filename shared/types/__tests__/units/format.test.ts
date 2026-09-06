import { describe, expect, it } from 'vitest';

import {
    buildQuantityDisplay,
    formatUnitQty,
    getUnitPrepositional,
    getUnitWord,
} from '../../src/units/format';

describe('formatUnitQty', () => {
    it('pluralizes tube forms', () => {
        expect(formatUnitQty(1, 'tube')).toBe('1 туба');
        expect(formatUnitQty(2, 'tube')).toBe('2 тубы');
        expect(formatUnitQty(5, 'tube')).toBe('5 туб');
        expect(formatUnitQty(11, 'tube')).toBe('11 туб');
        expect(formatUnitQty(21, 'tube')).toBe('21 туба');
    });

    it('keeps gram and piece invariant', () => {
        expect(formatUnitQty(3, 'gram')).toBe('3 гр');
        expect(formatUnitQty(7, 'piece')).toBe('7 шт');
    });

    it('formats fractional quantities', () => {
        expect(formatUnitQty(2.5, 'gram')).toBe('2.5 гр');
        expect(formatUnitQty(0.125, 'gram')).toBe('0.125 гр');
    });

    it('falls back to ед. for unknown or missing unit', () => {
        expect(formatUnitQty(4, 'litre')).toBe('4 ед.');
        expect(formatUnitQty(4, null)).toBe('4 ед.');
        expect(formatUnitQty(4, undefined)).toBe('4 ед.');
    });
});

describe('getUnitWord', () => {
    it('returns the pluralized word only', () => {
        expect(getUnitWord(1, 'tube')).toBe('туба');
        expect(getUnitWord(2, 'tube')).toBe('тубы');
        expect(getUnitWord(5, 'tube')).toBe('туб');
        expect(getUnitWord(3, 'gram')).toBe('гр');
    });

    it('falls back to ед.', () => {
        expect(getUnitWord(3, 'litre')).toBe('ед.');
        expect(getUnitWord(3, null)).toBe('ед.');
    });
});

describe('getUnitPrepositional', () => {
    it('returns prepositional forms for known units', () => {
        expect(getUnitPrepositional('gram')).toBe('граммах');
        expect(getUnitPrepositional('piece')).toBe('штуках');
        expect(getUnitPrepositional('tube')).toBe('тубах');
    });

    it('returns null for unknown units', () => {
        expect(getUnitPrepositional('litre')).toBeNull();
        expect(getUnitPrepositional(null)).toBeNull();
    });
});

describe('buildQuantityDisplay', () => {
    it('piece units show a single effective value without packages', () => {
        expect(buildQuantityDisplay({ quantity: 2, packageCount: 0, packSize: 1, unitCode: 'tube' }))
            .toEqual({ main: '2 тубы', total: null });
        expect(buildQuantityDisplay({ quantity: 5, packageCount: 0, packSize: 1, unitCode: 'piece' }))
            .toEqual({ main: '5 шт', total: null });
    });

    it('weight loose quantity stays in grams', () => {
        expect(buildQuantityDisplay({ quantity: 50, packageCount: 0, packSize: 50, unitCode: 'gram' }))
            .toEqual({ main: '50 гр', total: null });
    });

    it('degenerate packSize=1 shows grams, not invented packs', () => {
        expect(buildQuantityDisplay({ quantity: 1, packageCount: 0, packSize: 1, unitCode: 'gram' }))
            .toEqual({ main: '1 гр', total: null });
        expect(buildQuantityDisplay({ quantity: 2, packageCount: 0, packSize: 1, unitCode: 'gram' }))
            .toEqual({ main: '2 гр', total: null });
    });

    it('packages only', () => {
        expect(buildQuantityDisplay({ quantity: 0, packageCount: 2, packSize: 50, unitCode: 'gram' }))
            .toEqual({ main: '2 уп', total: null });
    });

    it('loose + packages with total line', () => {
        expect(buildQuantityDisplay({ quantity: 20, packageCount: 2, packSize: 50, unitCode: 'gram' }))
            .toEqual({ main: '20 гр + 2 уп', total: 'всего 120 гр' });
    });

    it('zero quantity renders zero value', () => {
        expect(buildQuantityDisplay({ quantity: 0, packageCount: 0, packSize: 50, unitCode: 'gram' }))
            .toEqual({ main: '0 гр', total: null });
    });

    it('unknown unit treated as weight with ед.', () => {
        expect(buildQuantityDisplay({ quantity: 20, packageCount: 1, packSize: 50, unitCode: 'litre' }))
            .toEqual({ main: '20 ед. + 1 уп', total: 'всего 70 ед.' });
    });

    it('fractional loose quantity is preserved', () => {
        expect(buildQuantityDisplay({ quantity: 12.5, packageCount: 1, packSize: 100, unitCode: 'gram' }))
            .toEqual({ main: '12.5 гр + 1 уп', total: 'всего 112.5 гр' });
    });
});
