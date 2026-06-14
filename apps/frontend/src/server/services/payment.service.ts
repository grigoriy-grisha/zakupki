import type { Prisma } from '@zakupki/database';
import { dbClient } from '@zakupki/database';
import { ForbiddenError, isPurchasePaymentOpen, ValidationError } from '@zakupki/types';
import { uploadPaymentProof } from '@zakupki/storage';

import { storage } from '@/lib/server/storage';

import { OrderRepository } from '../domain/order.repository';
import { PaymentRepository } from '../domain/payment.repository';

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
    fulfillmentStatus: import('@zakupki/types').PurchaseFulfillmentStatus;
};

export class PaymentService {
    constructor(private repo: PaymentRepository) {}

    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return this.repo.create(data);
    }

    async submitPayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofData?: Buffer;
        proofMimeType?: string;
        promoCodeId?: number;
        discountAmount?: number;
    }) {
        if (!data.proofData?.length) {
            throw new ValidationError('Прикрепите подтверждение оплаты (чек)');
        }

        const existingPending = await this.repo.findPendingByUserAndPurchase(data.userId, data.purchaseId);
        if (existingPending) {
            throw new ValidationError('Оплата уже отправлена и ожидает подтверждения администратором');
        }

        // Upload proof to storage before creating the payment record
        let proofObjectKey: string | undefined;
        if (data.proofData) {
            proofObjectKey = await storage.uploadPaymentProof(
                data.userId,
                data.purchaseId,
                data.proofData,
                data.proofMimeType ?? 'image/jpeg',
            );
        }

        return this.repo.submitPayment({
            userId: data.userId,
            purchaseId: data.purchaseId,
            amount: data.amount,
            userComment: data.userComment,
            proofObjectKey,
            promoCodeId: data.promoCodeId,
            discountAmount: data.discountAmount,
        });
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async getByUser(userId: number) {
        return this.repo.getByUser(userId);
    }

    /** Admin: confirm payment */
    async confirm(id: number, adminNote?: string) {
        return this.repo.updateStatus(id, 'CONFIRMED', adminNote);
    }

    /** Admin: reject payment */
    async reject(id: number, adminNote?: string) {
        return this.repo.updateStatus(id, 'REJECTED', adminNote);
    }

    /** User cancels own payment — verifies ownership */
    async cancel(id: number, userId: number) {
        await this.assertOwnership(id, userId);
        return this.repo.updateStatus(id, 'REJECTED');
    }

    /** User updates own payment — verifies ownership */
    async updatePayment(
        id: number,
        userId: number,
        data: { amount?: number; userComment?: string; proofData?: Buffer; proofMimeType?: string },
    ) {
        await this.assertOwnership(id, userId);

        let proofObjectKey: string | undefined;
        if (data.proofData) {
            proofObjectKey = await storage.uploadPaymentProof(
                userId,
                (await this.repo.getById(id))!.purchaseId,
                data.proofData,
                data.proofMimeType ?? 'image/jpeg',
            );
        }

        const updateData: {
            amount?: number;
            userComment?: string;
            proofObjectKey?: string;
            status: string;
            adminNote: null;
        } = {
            status: 'PENDING',
            adminNote: null,
        };
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.userComment !== undefined) updateData.userComment = data.userComment;
        if (proofObjectKey !== undefined) updateData.proofObjectKey = proofObjectKey;
        return this.repo.update(id, updateData);
    }

    private async assertOwnership(id: number, userId: number) {
        const payment = await this.repo.getById(id);
        if (!payment) return; // Will be caught by update/delete
        if (payment.userId !== userId) {
            throw new ForbiddenError('Нельзя изменить чужой платёж');
        }
    }

    // ── Bot-specific methods ──────────────────────────────────────────

    private botOrderRepo = new OrderRepository();

    async getUserPayments(userId: number) {
        const payments = await this.repo.getByUser(userId);

        const lines = payments.map((p) => {
            const childAmount = (p.children ?? []).reduce(
                (s: number, c: { amount: unknown }) => s + Number(c.amount),
                0,
            );
            const total = Number(p.amount) + childAmount;
            const statusCfg: Record<string, { emoji: string; label: string }> = {
                PENDING: { emoji: '⏳', label: 'Ожидает проверки' },
                CONFIRMED: { emoji: '✅', label: 'Подтверждено' },
                REJECTED: { emoji: '❌', label: 'Отклонено' },
            };
            const { emoji = '❓', label = p.status } = statusCfg[p.status] ?? {};
            return (
                `${emoji} ${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
                `   ${label} · ${new Date(p.submittedAt).toLocaleDateString('ru-RU')}`
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
                fulfillmentStatus: purchase.fulfillmentStatus as import('@zakupki/types').PurchaseFulfillmentStatus,
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
        const ALLOWED_PROOF_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
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

        return this.repo.submitPayment({
            userId: data.userId,
            purchaseId: data.purchaseId,
            amount: data.amount,
            userComment: data.userComment,
            proofObjectKey,
        });
    }

    private async buildPaymentMap(userId: number): Promise<Map<number, PurchasePaymentInfo>> {
        const [orders, payments] = await Promise.all([
            this.botOrderRepo.findAllByUserId(userId),
            this.repo.findAllByUserId(userId),
        ]);

        const map = new Map<number, PurchasePaymentInfo>();

        for (const order of orders) {
            const purchaseId = order.purchaseItem?.purchaseId;
            const tag = order.purchaseItem?.purchase?.tag ?? '—';
            if (!purchaseId) continue;

            const existing = map.get(purchaseId) ?? { due: 0, paid: 0, hasPending: false, remaining: 0, tag };
            existing.due += Number(order.amountDue);
            if (tag !== '—') existing.tag = tag;
            map.set(purchaseId, existing);
        }

        for (const payment of payments) {
            const purchaseId = payment.purchaseId;
            const tag = payment.purchase?.tag ?? '—';
            const status = payment.status;
            const childAmount = (payment.children ?? []).reduce(
                (s: number, c: { amount: unknown }) => s + Number(c.amount),
                0,
            );
            const total = Number(payment.amount) + childAmount;

            const existing = map.get(purchaseId) ?? { due: 0, paid: 0, hasPending: false, remaining: 0, tag };
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
