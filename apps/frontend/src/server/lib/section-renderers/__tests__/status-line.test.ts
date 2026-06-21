import { describe, it, expect } from 'vitest';

import { ALL_FULFILLMENT_STATUSES } from './test-setup';
import { createMockStatusLineData, renderById } from './test-setup';

describe('StatusLineRenderer', () => {
    it('renders full block: status + supplier limit + target remainder + free', () => {
        const result = renderById('STATUS_LINE', createMockStatusLineData());
        expect(result).toMatchSnapshot();
    });

    it('renders status-only when unit is missing (supplierLimit set, unit null)', () => {
        const result = renderById(
            'STATUS_LINE',
            createMockStatusLineData({
                item: { supplierLimit: 500, supplierLimitUnit: null, targetRemainder: 50 },
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('renders status-only when all item fields are null', () => {
        const result = renderById(
            'STATUS_LINE',
            createMockStatusLineData({
                item: { supplierLimit: null, supplierLimitUnit: null, targetRemainder: null },
                orderLinesSum: 0,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('free-to-order clamps negative result to 0 (oversubscribed)', () => {
        const result = renderById(
            'STATUS_LINE',
            createMockStatusLineData({
                item: { supplierLimit: 100, supplierLimitUnit: 'кг', targetRemainder: 50 },
                orderLinesSum: 200,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('formats large numbers with ru-RU separators (1 234 567)', () => {
        const result = renderById(
            'STATUS_LINE',
            createMockStatusLineData({
                item: { supplierLimit: 1234567, supplierLimitUnit: 'кг', targetRemainder: 0 },
                orderLinesSum: 0,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    it('escapes HTML in unit name (safety)', () => {
        const result = renderById(
            'STATUS_LINE',
            createMockStatusLineData({
                item: { supplierLimit: 10, supplierLimitUnit: '<script>', targetRemainder: null },
                orderLinesSum: 0,
            }),
        );
        expect(result).toMatchSnapshot();
    });

    describe('all fulfillment statuses', () => {
        for (const status of ALL_FULFILLMENT_STATUSES) {
            it(`status=${status} → renders 🔄 with correct Russian label`, () => {
                const result = renderById(
                    'STATUS_LINE',
                    createMockStatusLineData({
                        purchase: { fulfillmentStatus: status },
                        item: { supplierLimit: null, supplierLimitUnit: null, targetRemainder: null },
                    }),
                );
                expect(result).toMatchSnapshot();
            });
        }
    });
});
