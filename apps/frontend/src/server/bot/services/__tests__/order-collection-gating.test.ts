import { describe, expect, it } from 'vitest';

import { OrderCollectionService } from '../order-collection.service';
import type { PurchaseItemResolver } from '../purchase-item-resolver';

function stubResolver(item: unknown): PurchaseItemResolver {
    return {
        resolvePurchaseItem: async () => item,
    } as unknown as PurchaseItemResolver;
}

function resolvedItem() {
    return {
        id: 1,
        product: { id: 10, name: 'Бисер', unitCode: 'gram', multiplicity: 1 },
        hidden: false,
        unitCode: 'gram',
        purchase: { deletedAt: null, fulfillmentStatus: 'COLLECTION', tag: 'P1' },
    };
}

const baseParams = {
    chatId: -100123,
    text: '',
    telegramId: '42',
    userInfo: { firstName: 'Ivan' },
} as const;

describe('order collection gating on resolved purchase item', () => {
    it('getQuantityHint returns null when no purchase item resolves', async () => {
        const service = new OrderCollectionService(stubResolver(null));
        const hint = await service.getQuantityHint({ chatId: -100123 });
        expect(hint).toBeNull();
    });

    it('getQuantityHint returns stage hint when the reply points at a post', async () => {
        const service = new OrderCollectionService(stubResolver(resolvedItem()));
        const hint = await service.getQuantityHint({ chatId: -100123 });
        expect(hint).toContain('Напишите количество числом');
    });

    it('collectFromReply reports product_not_found for chat replies without a post', async () => {
        const service = new OrderCollectionService(stubResolver(null));
        const result = await service.collectFromReply({ ...baseParams, text: '+10' });
        expect(result).toMatchObject({ ok: false, reason: 'product_not_found' });
    });

    it('collectFromReply returns invalid_quantity with hint when item resolved but text is unparseable', async () => {
        const service = new OrderCollectionService(stubResolver(resolvedItem()));
        const result = await service.collectFromReply({ ...baseParams, text: '0' });
        expect(result).toMatchObject({ ok: false, reason: 'invalid_quantity' });
        if (!result.ok) {
            expect(result.message).toContain('Напишите количество числом');
        }
    });

    it('getQuantityHint swallows resolver errors and stays silent', async () => {
        const failing = {
            resolvePurchaseItem: async () => {
                throw new Error('redis down');
            },
        } as unknown as PurchaseItemResolver;
        const service = new OrderCollectionService(failing);
        expect(await service.getQuantityHint({ chatId: -100123 })).toBeNull();
    });
});
