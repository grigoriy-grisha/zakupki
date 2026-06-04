import { dbClient } from '@zakupki/database';
import { uploadPaymentProof } from '@zakupki/storage';
import { isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { OrderRepository } from '../domain/repositories/order.repository';
import { PaymentRepository } from '../domain/repositories/payment.repository';
import { PAYMENT_STATUS } from '../domain/constants';

export type PurchasePaymentInfo = {
    due: number;
    paid: number;
    hasPending: boolean;
    remaining: number;
    tag: string;
};

export type PayablePurchase = {
    purchaseId: number;
    tag: string;
    remaining: number;
    fulfillmentStatus: PurchaseFulfillmentStatus;
};

const ALLOWED_PROOF_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

export class PaymentService {
    private paymentRepo = new PaymentRepository();
    private orderRepo = new OrderRepository();

    async getUserPayments(userId: number) {
        const payments = await this.paymentRepo.findByUserId(userId);

        const lines = payments.map((p) => {
            const childAmount = (p.children ?? []).reduce((s, c) => s + Number(c.amount), 0);
            const total = Number(p.amount) + childAmount;
            const { emoji = '❓', label = p.status } = PAYMENT_STATUS[p.status] ?? {};
            return (
                `${emoji} ${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
                `   ${label} · ${new Date(p.paidAt).toLocaleDateString('ru-RU')}`
            );
        });

        return { payments, lines };
    }

    async getPayablePurchases(userId: number): Promise<PayablePurchase[]> {
        const map = await this.buildPaymentMap(userId);
        const result: PayablePurchase[] = [];

        const purchaseIds = [...map.keys()];
        const purchases =
            purchaseIds.length > 0
                ? await dbClient.purchase.findMany({
                      where: { id: { in: purchaseIds } },
                      select: { id: true, fulfillmentStatus: true },
                  })
                : [];
        const purchaseById = new Map(purchases.map((p) => [p.id, p]));

        map.forEach((info, purchaseId) => {
            const purchase = purchaseById.get(purchaseId);
            if (
                !purchase ||
                info.remaining <= 0 ||
                info.hasPending ||
                !isPurchasePaymentOpen(purchase.fulfillmentStatus)
            ) {
                return;
            }
            result.push({
                purchaseId,
                tag: info.tag,
                remaining: info.remaining,
                fulfillmentStatus: purchase.fulfillmentStatus,
            });
        });

        return result.sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
    }

    async getPurchasePaymentInfo(userId: number, purchaseId: number): Promise<PurchasePaymentInfo | null> {
        const map = await this.buildPaymentMap(userId);
        return map.get(purchaseId) ?? null;
    }

    async submitPaymentWithProof(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofData: Buffer;
        proofMimeType: string;
    }) {
        if (!ALLOWED_PROOF_MIME.has(data.proofMimeType)) {
            throw new Error('Допустимы только изображения и PDF');
        }

        const purchase = await dbClient.purchase.findUnique({
            where: { id: data.purchaseId },
            select: { fulfillmentStatus: true },
        });
        if (!isPurchasePaymentOpen(purchase?.fulfillmentStatus)) {
            throw new Error('Оплата ещё не открыта. Ждём начала оплаты.');
        }

        const info = await this.getPurchasePaymentInfo(data.userId, data.purchaseId);
        if (!info) {
            throw new Error('Закупка не найдена');
        }
        if (info.hasPending) {
            throw new Error('Уже есть оплата на проверке. Дождитесь подтверждения.');
        }
        if (info.remaining <= 0) {
            throw new Error('По этой закупке нечего оплачивать');
        }
        if (data.amount <= 0 || data.amount > info.remaining) {
            throw new Error(`Сумма должна быть от 1 до ${info.remaining.toLocaleString('ru-RU')} ₽`);
        }

        const proofObjectKey = await uploadPaymentProof(
            data.userId,
            data.purchaseId,
            data.proofData,
            data.proofMimeType,
        );

        return this.paymentRepo.submitPayment({
            userId: data.userId,
            purchaseId: data.purchaseId,
            amount: data.amount,
            userComment: data.userComment,
            proofObjectKey,
            proofMimeType: data.proofMimeType,
        });
    }

    private async buildPaymentMap(userId: number): Promise<Map<number, PurchasePaymentInfo>> {
        const [orders, payments] = await Promise.all([
            this.orderRepo.findAllByUserId(userId),
            this.paymentRepo.findAllByUserId(userId),
        ]);

        const map = new Map<number, PurchasePaymentInfo>();

        for (const order of orders) {
            const purchaseId = order.purchaseItem?.purchaseId;
            const tag = order.purchaseItem?.purchase?.tag ?? '—';
            if (!purchaseId) continue;

            const existing = map.get(purchaseId) ?? {
                due: 0,
                paid: 0,
                hasPending: false,
                remaining: 0,
                tag,
            };
            existing.due += Number(order.amountDue);
            if (tag !== '—') existing.tag = tag;
            map.set(purchaseId, existing);
        }

        for (const payment of payments) {
            const purchaseId = payment.purchaseId;
            const tag = payment.purchase?.tag ?? '—';
            const status = payment.status;
            const childAmount = (payment.children ?? []).reduce((s, c) => s + Number(c.amount), 0);
            const total = Number(payment.amount) + childAmount;

            const existing = map.get(purchaseId) ?? {
                due: 0,
                paid: 0,
                hasPending: false,
                remaining: 0,
                tag,
            };
            if (status === 'CONFIRMED') {
                existing.paid += total;
            }
            if (status === 'PENDING') {
                existing.hasPending = true;
            }
            if (tag !== '—') existing.tag = tag;
            map.set(purchaseId, existing);
        }

        map.forEach((val) => {
            val.remaining = Math.max(0, val.due - val.paid);
        });

        return map;
    }
}
