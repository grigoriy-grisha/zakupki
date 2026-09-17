import { describe, expect, it } from 'vitest';

import { parseTelegramStartParam, shopPathForStartTarget } from '../telegram-start-param';

describe('parseTelegramStartParam', () => {
    it('parses a purchase target', () => {
        expect(parseTelegramStartParam('p5')).toEqual({ purchaseId: 5 });
    });

    it('parses a purchase item target', () => {
        expect(parseTelegramStartParam('p5i123')).toEqual({ purchaseId: 5, itemId: 123 });
    });

    it('trims surrounding whitespace', () => {
        expect(parseTelegramStartParam('  p5i123 ')).toEqual({ purchaseId: 5, itemId: 123 });
    });

    it('returns null for empty or whitespace-only values', () => {
        expect(parseTelegramStartParam(null)).toBeNull();
        expect(parseTelegramStartParam(undefined)).toBeNull();
        expect(parseTelegramStartParam('')).toBeNull();
        expect(parseTelegramStartParam('   ')).toBeNull();
    });

    it('returns null for malformed values', () => {
        expect(parseTelegramStartParam('5')).toBeNull();
        expect(parseTelegramStartParam('i123')).toBeNull();
        expect(parseTelegramStartParam('p')).toBeNull();
        expect(parseTelegramStartParam('p5x')).toBeNull();
        expect(parseTelegramStartParam('p5ii')).toBeNull();
        expect(parseTelegramStartParam('p-5')).toBeNull();
    });

    it('returns null for zero ids', () => {
        expect(parseTelegramStartParam('p0')).toBeNull();
        expect(parseTelegramStartParam('p5i0')).toBeNull();
    });
});

describe('shopPathForStartTarget', () => {
    it('builds the purchase path', () => {
        expect(shopPathForStartTarget({ purchaseId: 5 })).toBe('/shop/purchase/5');
    });

    it('builds the item path', () => {
        expect(shopPathForStartTarget({ purchaseId: 5, itemId: 123 })).toBe('/shop/purchase/5/item/123');
    });
});
