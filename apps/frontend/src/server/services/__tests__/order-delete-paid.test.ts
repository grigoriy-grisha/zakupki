import { describe, expect, it, vi } from 'vitest';

import { OrderService } from '../order.service';

function makeService(opts: { paid: boolean; siblings?: number }) {
    const repo = {
        findById: vi.fn(async (id: number) => ({ id, userId: 2, purchaseItemId: 10, purchaseItem: { purchaseId: 3 } })),
        hasPaymentsInPurchase: vi.fn(async () => opts.paid),
        countActiveLinesByUserAndItem: vi.fn(async () => opts.siblings ?? 1),
        deleteOrderLineById: vi.fn(async () => undefined),
        softDeleteLines: vi.fn(async () => undefined),
        findPurchaseItemIdsByUserAndPurchase: vi.fn(async () => [10, 11]),
        findActiveLineIdsByUserAndPurchase: vi.fn(async () => [5, 6]),
        deleteAllByUserAndPurchase: vi.fn(async () => ({ count: 2 })),
        deletePurchaseOrder: vi.fn(async () => undefined),
    };
    const service = new OrderService(
        repo as never,
        {} as never,
        {} as never,
        { emitPurchaseItemChanged: async () => {} } as never,
        {} as never,
    );
    // Уведомления к проверке не относятся.
    const s = service as unknown as Record<string, unknown>;
    s.notifyOrderLineDeleted = async () => {};
    s.notifyOrderCleared = async () => {};
    return { service, repo };
}

describe('OrderService: удаление позиций у участника с оплатой', () => {
    it('delete: без оплат лишняя строка товара стирается', async () => {
        const { service, repo } = makeService({ paid: false, siblings: 2 });
        await service.delete(7);
        expect(repo.deleteOrderLineById).toHaveBeenCalledWith(7);
        expect(repo.softDeleteLines).not.toHaveBeenCalled();
    });

    it('delete: при оплате строка отменяется, а не стирается', async () => {
        const { service, repo } = makeService({ paid: true, siblings: 2 });
        await service.delete(7);
        expect(repo.softDeleteLines).toHaveBeenCalledWith([7]);
        expect(repo.deleteOrderLineById).not.toHaveBeenCalled();
    });

    it('removeAll: без оплат заказ удаляется целиком', async () => {
        const { service, repo } = makeService({ paid: false });
        await service.removeAllByUserFromPurchase(2, 3);
        expect(repo.deleteAllByUserAndPurchase).toHaveBeenCalledWith(2, 3);
        expect(repo.deletePurchaseOrder).toHaveBeenCalledWith(2, 3);
    });

    it('removeAll: при оплате позиции отменяются, заказ остаётся', async () => {
        const { service, repo } = makeService({ paid: true });
        const result = await service.removeAllByUserFromPurchase(2, 3);
        expect(repo.softDeleteLines).toHaveBeenCalledWith([5, 6]);
        expect(repo.deleteAllByUserAndPurchase).not.toHaveBeenCalled();
        expect(repo.deletePurchaseOrder).not.toHaveBeenCalled();
        expect(result).toEqual({ count: 2 });
    });
});
