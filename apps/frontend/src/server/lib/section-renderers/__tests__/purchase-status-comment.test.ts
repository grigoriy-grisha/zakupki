import { describe, it, expect } from 'vitest';

import { ALL_PURCHASE_STATUSES } from './test-setup';
import { createMockPurchaseStatusCommentData, renderById } from './test-setup';

describe('PurchaseStatusCommentRenderer', () => {
    it('renders full comment with channelPostMessageId prefix', () => {
        const result = renderById('PURCHASE_STATUS_COMMENT', createMockPurchaseStatusCommentData({ status: 'ACTIVE' }));
        expect(result).toMatchSnapshot();
    });

    it('renders comment without channelPostMessageId prefix', () => {
        const result = renderById(
            'PURCHASE_STATUS_COMMENT',
            createMockPurchaseStatusCommentData({ status: 'ACTIVE', channelPostMessageId: undefined }),
        );
        expect(result).toMatchSnapshot();
    });

    it('handles unknown status', () => {
        const result = renderById(
            'PURCHASE_STATUS_COMMENT',
            createMockPurchaseStatusCommentData({ status: 'BOGUS' }),
        );
        expect(result).toMatchSnapshot();
    });

    describe('all purchase statuses', () => {
        for (const status of ALL_PURCHASE_STATUSES) {
            it(`status=${status} → renders with correct label and hint`, () => {
                const result = renderById(
                    'PURCHASE_STATUS_COMMENT',
                    createMockPurchaseStatusCommentData({ status }),
                );
                expect(result).toMatchSnapshot();
            });
        }
    });
});
