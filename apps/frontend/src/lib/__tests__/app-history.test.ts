import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    hasInAppBack,
    markPopNavigation,
    markReplaceNavigation,
    recordAppNavigation,
    resetAppHistory,
} from '../app-history';

/** Минимальный стаб sessionStorage. */
function stubSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
    });
    return store;
}

describe('app-history', () => {
    beforeEach(() => {
        vi.stubGlobal('window', { location: { pathname: '', search: '' } });
        stubSessionStorage();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('fresh history has no in-app back', () => {
        resetAppHistory('/tg/shop');
        expect(hasInAppBack()).toBe(false);
    });

    it('push navigation grows the stack', () => {
        resetAppHistory('/tg/shop');
        recordAppNavigation('/tg/shop/purchase/1');
        expect(hasInAppBack()).toBe(true);
    });

    it('replace navigation swaps the top instead of pushing (deep-link entry)', () => {
        resetAppHistory('/tg/shop?tgWebAppStartParam=p1i2');
        markReplaceNavigation();
        recordAppNavigation('/tg/shop/purchase/1/item/2');
        expect(hasInAppBack()).toBe(false);

        recordAppNavigation('/tg/shop/purchase/1/item/2/buy');
        expect(hasInAppBack()).toBe(true);
    });

    it('replace on empty stack falls back to push', () => {
        markReplaceNavigation();
        recordAppNavigation('/tg/shop/purchase/1');
        expect(hasInAppBack()).toBe(false);
        recordAppNavigation('/tg/shop/orders');
        expect(hasInAppBack()).toBe(true);
    });

    it('stale replace flag (query-only replace, TTL expired) does not swallow the next push', () => {
        resetAppHistory('/tg/shop');
        markReplaceNavigation();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
        recordAppNavigation('/tg/shop/purchase/1');
        expect(hasInAppBack()).toBe(true);
    });

    it('replace flag is consumed once', () => {
        resetAppHistory('/tg/shop');
        markReplaceNavigation();
        recordAppNavigation('/tg/shop/purchase/1');
        recordAppNavigation('/tg/shop/orders');
        expect(hasInAppBack()).toBe(true);
    });

    it('pop navigation truncates the stack back to the URL', () => {
        resetAppHistory('/tg/shop');
        recordAppNavigation('/tg/shop/purchase/1');
        recordAppNavigation('/tg/shop/purchase/1/item/2');
        markPopNavigation();
        recordAppNavigation('/tg/shop/purchase/1');
        expect(hasInAppBack()).toBe(true);
        markPopNavigation();
        recordAppNavigation('/tg/shop');
        expect(hasInAppBack()).toBe(false);
    });

    it('pop flag wins over replace flag', () => {
        resetAppHistory('/tg/shop');
        recordAppNavigation('/tg/shop/purchase/1');
        markReplaceNavigation();
        markPopNavigation();
        recordAppNavigation('/tg/shop');
        expect(hasInAppBack()).toBe(false);
    });
});
