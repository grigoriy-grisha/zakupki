import { createLogger } from '@zakupki/logger';
import { ForbiddenError, ValidationError } from '@zakupki/types';

import { storage } from '@/lib/server/storage';

import type { PaymentRepository } from '../domain/payment.repository';
import type { BotPaymentService } from './bot-payment.service';
import type { NotificationService } from './notification.service';

const log = createLogger('payment-service');

export class PaymentService {
    constructor(
        private repo: PaymentRepository,
        private notification: NotificationService,
        private paymentInfo: BotPaymentService,
    ) {}

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

        await this.assertWithinRemaining(data.userId, data.purchaseId, data.amount);

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
        const result = await this.repo.updateStatus(id, 'CONFIRMED', adminNote);
        await this.notifyPayment(id, 'PAYMENT_CONFIRMED', adminNote);
        return result;
    }

    /** Admin: reject payment */
    async reject(id: number, adminNote?: string) {
        const result = await this.repo.updateStatus(id, 'REJECTED', adminNote);
        await this.notifyPayment(id, 'PAYMENT_REJECTED', adminNote);
        return result;
    }

    /**
     * Push a payment notification to the owning user. Best-effort — a failure
     * here is logged but never rethrown, since the status transition already
     * succeeded and the admin flow must not break on notification delivery.
     */
    private async notifyPayment(
        id: number,
        type: 'PAYMENT_CONFIRMED' | 'PAYMENT_REJECTED',
        adminNote?: string,
    ): Promise<void> {
        try {
            const payment = await this.repo.findWithPurchase(id);
            if (!payment) return;
            await this.notification.notify({
                userId: payment.userId,
                type,
                payload: {
                    purchaseId: payment.purchaseId,
                    purchaseTag: payment.purchase.tag,
                    amount: Number(payment.amount),
                    adminNote: adminNote ?? null,
                },
            });
        } catch (err) {
            log.warn({ paymentId: id, type, err }, 'failed to notify about payment');
        }
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
        if (data.amount !== undefined) {
            const payment = await this.repo.getById(id);
            if (payment) {
                await this.assertWithinRemaining(userId, payment.purchaseId, data.amount);
            }
        }

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

    private async assertWithinRemaining(userId: number, purchaseId: number, amount: number): Promise<void> {
        const info = await this.paymentInfo.getPurchasePaymentInfo(userId, purchaseId);
        if (!info) {
            throw new ValidationError('Закупка не найдена');
        }
        if (amount <= 0 || amount > info.remaining) {
            throw new ValidationError(`Сумма должна быть от 1 до ${info.remaining.toLocaleString('ru-RU')} ₽`);
        }
    }

    private async assertOwnership(id: number, userId: number) {
        const payment = await this.repo.getById(id);
        if (!payment) return; // Will be caught by update/delete
        if (payment.userId !== userId) {
            throw new ForbiddenError('Нельзя изменить чужой платёж');
        }
    }
}
