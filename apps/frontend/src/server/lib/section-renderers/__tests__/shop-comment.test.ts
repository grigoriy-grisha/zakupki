import { describe, it, expect } from 'vitest';

import { createMockShopCommentData, renderById } from './test-setup';

describe('ShopCommentRenderer', () => {
    it('renders the standard shop comment text', () => {
        const result = renderById('SHOP_COMMENT', createMockShopCommentData());
        expect(result).toMatchSnapshot();
    });

    it('returns the same text regardless of subtext (currently unused)', () => {
        const result = renderById('SHOP_COMMENT', createMockShopCommentData({ subtext: 'ignored' }));
        expect(result).toMatchSnapshot();
    });
});
