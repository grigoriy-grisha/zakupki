import { describe, expect, it, vi } from 'vitest';

import { PaymentService } from '../payment.service';

type Row = {
    id: number;
    userId: number;
    purchaseId: number;
    amount: number;
    status: string;
    method: string;
    parentId: number | null;
    refundOfId: number | null;
    purchase: { tag: string; deletedAt: Date | null };
};

function makeService(row: Partial<Row>, refunded = 0) {
    const payment: Row = {
        id: 1,
        userId: 2,
        purchaseId: 3,
        amount: 500,
        status: 'PENDING',
        method: 'MANUAL',
        parentId: null,
        refundOfId: null,
        purchase: { tag: '#T', deletedAt: null },
        ...row,
    };
    const repo = {
        findWithPurchase: async () => payment,
        getRefundedTotal: async () => refunded,
        updateStatus: vi.fn(async (_id: number, status: string) => ({ ...payment, status })),
    };
    const notification = { notify: vi.fn(async () => undefined) };
    const service = new PaymentService(repo as never, notification as never, () => ({}) as never);
    return { service, repo, notification };
}

describe('PaymentService: manual confirm / reject', () => {
    it('confirms a pending manual payment and switches a confirmed one to rejected', async () => {
        const pending = makeService({});
        await pending.service.confirm(1);
        expect(pending.repo.updateStatus).toHaveBeenCalledWith(1, 'CONFIRMED', undefined);
        expect(pending.notification.notify).toHaveBeenCalled();

        const confirmed = makeService({ status: 'CONFIRMED' });
        await confirmed.service.reject(1, 'ошибка');
        expect(confirmed.repo.updateStatus).toHaveBeenCalledWith(1, 'REJECTED', 'ошибка');
    });

    it('does not reject a payment that was already refunded', async () => {
        const { service, repo } = makeService({ status: 'CONFIRMED' }, 200);
        await expect(service.reject(1)).rejects.toThrow('уже сделан возврат');
        expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('does not touch online payments, promo or refund rows, or repeat the same status', async () => {
        await expect(makeService({ method: 'TBANK_CARD' }).service.confirm(1)).rejects.toThrow('уведомлению банка');
        await expect(makeService({ parentId: 9 }).service.reject(1)).rejects.toThrow('вместе с основной оплатой');
        await expect(makeService({ refundOfId: 9 }).service.confirm(1)).rejects.toThrow('вместе с основной оплатой');
        await expect(makeService({ status: 'CONFIRMED' }).service.confirm(1)).rejects.toThrow('уже подтверждён');
        await expect(makeService({ status: 'REJECTED' }).service.reject(1)).rejects.toThrow('уже отклонён');
    });

    it('does not confirm a payment for a deleted purchase', async () => {
        const { service } = makeService({ status: 'REJECTED', purchase: { tag: '#T', deletedAt: new Date() } });
        await expect(service.confirm(1)).rejects.toThrow('Закупка удалена');
    });
});
