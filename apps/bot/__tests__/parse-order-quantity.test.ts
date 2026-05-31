import { describe, expect, it } from 'vitest';

import { parseOrderQuantity } from '../src/lib/parse-order-quantity';

describe('parseOrderQuantity', () => {
    it('returns null for empty or non-numeric input', () => {
        expect(parseOrderQuantity('')).toBeNull();
        expect(parseOrderQuantity('   ')).toBeNull();
        expect(parseOrderQuantity('hello')).toBeNull();
        expect(parseOrderQuantity('abc123')).toBeNull();
    });

    it('parses positive integers as add', () => {
        expect(parseOrderQuantity('10')).toEqual({ kind: 'add', amount: 10 });
        expect(parseOrderQuantity('+10')).toEqual({ kind: 'add', amount: 10 });
        expect(parseOrderQuantity('5')).toEqual({ kind: 'add', amount: 5 });
        expect(parseOrderQuantity('100')).toEqual({ kind: 'add', amount: 100 });
    });

    it('parses negative integers as subtract', () => {
        expect(parseOrderQuantity('-10')).toEqual({ kind: 'subtract', amount: 10 });
        expect(parseOrderQuantity('-5')).toEqual({ kind: 'subtract', amount: 5 });
    });

    it('parses decimal numbers', () => {
        expect(parseOrderQuantity('10.5')).toEqual({ kind: 'add', amount: 10.5 });
        expect(parseOrderQuantity('-15.3')).toEqual({ kind: 'subtract', amount: 15.3 });
    });

    it('parses comma as decimal separator', () => {
        expect(parseOrderQuantity('10,5')).toEqual({ kind: 'add', amount: 10.5 });
        expect(parseOrderQuantity('-3,75')).toEqual({ kind: 'subtract', amount: 3.75 });
    });

    it('ignores text after number', () => {
        expect(parseOrderQuantity('10 гр')).toEqual({ kind: 'add', amount: 10 });
        expect(parseOrderQuantity('+10 гр')).toEqual({ kind: 'add', amount: 10 });
        expect(parseOrderQuantity('-5 шт')).toEqual({ kind: 'subtract', amount: 5 });
        expect(parseOrderQuantity('10.5 кг')).toEqual({ kind: 'add', amount: 10.5 });
    });

    it('returns null for zero', () => {
        expect(parseOrderQuantity('0')).toBeNull();
        expect(parseOrderQuantity('-0')).toBeNull();
    });

    it('handles whitespace', () => {
        expect(parseOrderQuantity('  10  ')).toEqual({ kind: 'add', amount: 10 });
        expect(parseOrderQuantity('  -5  ')).toEqual({ kind: 'subtract', amount: 5 });
    });
});
