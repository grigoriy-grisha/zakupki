import { describe, expect, it } from 'vitest';

import { buildMiniAppTargetUrl } from '../webapp-url';

describe('buildMiniAppTargetUrl', () => {
    it('encodes the purchase into startapp for t.me mini app links', () => {
        expect(buildMiniAppTargetUrl('https://t.me/bot/biser_app', 5)).toBe('https://t.me/bot/biser_app?startapp=p5');
    });

    it('encodes purchase + item into startapp for t.me mini app links', () => {
        expect(buildMiniAppTargetUrl('https://t.me/bot/biser_app', 5, 123)).toBe(
            'https://t.me/bot/biser_app?startapp=p5i123',
        );
    });

    it('reuses an existing query string on the t.me link', () => {
        expect(buildMiniAppTargetUrl('https://t.me/bot/biser_app?startapp=x', 5)).toBe(
            'https://t.me/bot/biser_app?startapp=x&startapp=p5',
        );
    });

    it('builds the direct item path for https domains', () => {
        expect(buildMiniAppTargetUrl('https://scheglove.ru', 5, 123)).toBe(
            'https://scheglove.ru/tg/shop/purchase/5/item/123',
        );
    });

    it('builds the purchase path for https domains without an item', () => {
        expect(buildMiniAppTargetUrl('https://scheglove.ru/', 5)).toBe('https://scheglove.ru/tg/shop/purchase/5');
    });
});
