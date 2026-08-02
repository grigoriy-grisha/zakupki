import { describe, it, expect } from 'vitest';

import { ALL_FULFILLMENT_STATUSES } from './test-setup';
import { createMockFulfillmentCommentData, renderById } from './test-setup';

describe('FulfillmentCommentRenderer', () => {
    it('renders full comment with channelPostMessageId prefix', () => {
        const result = renderById('FULFILLMENT_COMMENT', createMockFulfillmentCommentData({ status: 'PAYMENT' }));
        expect(result).toMatchSnapshot();
    });

    it('renders comment without channelPostMessageId prefix (omits "Пост #N" line)', () => {
        const result = renderById(
            'FULFILLMENT_COMMENT',
            createMockFulfillmentCommentData({ status: 'PAYMENT', channelPostMessageId: undefined }),
        );
        expect(result).toMatchSnapshot();
    });

    it('handles unknown status with raw label and no hint', () => {
        const result = renderById(
            'FULFILLMENT_COMMENT',
            createMockFulfillmentCommentData({ status: 'BOGUS_STATUS' }),
        );
        expect(result).toMatchSnapshot();
    });

    describe('all fulfillment statuses', () => {
        for (const status of ALL_FULFILLMENT_STATUSES) {
            it(`status=${status} → renders with correct label and hint`, () => {
                const result = renderById(
                    'FULFILLMENT_COMMENT',
                    createMockFulfillmentCommentData({ status }),
                );
                expect(result).toMatchSnapshot();
            });
        }
    });
});
