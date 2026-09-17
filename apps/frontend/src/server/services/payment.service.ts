import { createLogger } from '@zakupki/logger';
import { ForbiddenError, ValidationError } from '@zakupki/types';

import { storage } from '@/lib/server/storage';

import type { PaymentRepository } from '../domain/payment.repository';
import type { BotPaymentService } from './bot-payment.service';
import type { NotificationService } from './notification.service';
import type { PromoCodeService } from './promo-code.service';

const log = createLogger('payment-service');

export class PaymentService {
    constructor(
        private repo: PaymentRepository,
        private notification: NotificationService,
        private paymentInfo: BotPaymentService,
        private promoCode: PromoCodeService,
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
        promoCode?: string;
    }) {
        if (!data.proofData?.length) {
            throw new ValidationError('Прикрепите подтверждение оплаты (чек)');
        }

        const info = await this.paymentInfo.getPurchasePaymentInfo(data.userId, data.purchaseId);
        if (!info) {
            throw new ValidationError('Закупка не найдена');
        }
        if (data.amount <= 0 || data.amount > info.available) {
            throw new ValidationError(`Сумма должна быть от 1 до ${info.available.toLocaleString('ru-RU')} ₽`);
        }

        const promo = await this.promoCode.resolveForSubmit({
            userId: data.userId,
            purchaseId: data.purchaseId,
            code: data.promoCode,
            amount: data.amount,
            due: info.due,
        });
        const discountAmount = promo?.discountAmount ?? 0;

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
            amount: data.amount - discountAmount,
            userComment: data.userComment,
            proofObjectKey,
            promoCodeId: promo?.promoCodeId,
            discountAmount: discountAmount || undefined,
        });
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async getByUser(userId: number) {
        return this.repo.getByUser(userId);
    }

    async confirm(id: number, adminNote?: string) {
        const result = await this.repo.updateStatus(id, 'CONFIRMED', adminNote);
        await this.notifyPayment(id, 'PAYMENT_CONFIRMED', adminNote);
        return result;
    }

    async reject(id: number, adminNote?: string) {
        const result = await this.repo.updateStatus(id, 'REJECTED', adminNote);
        await this.notifyPayment(id, 'PAYMENT_REJECTED', adminNote);
        return result;
    }

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

    async cancel(id: number, userId: number) {
        const payment = await this.repo.getById(id);
        if (!payment || payment.userId !== userId) {
            throw new ForbiddenError('Нельзя изменить чужой платёж');
        }
        if (payment.status !== 'PENDING') {
            throw new ValidationError('Отменить можно только оплату, которая ещё ожидает подтверждения');
        }
        return this.repo.updateStatus(id, 'REJECTED', 'Отменено участником');
    }

    async updatePayment(
        id: number,
        userId: number,
        data: { amount?: number; userComment?: string; proofData?: Buffer; proofMimeType?: string },
    ) {
        await this.assertOwnership(id, userId);
        if (data.amount !== undefined) {
            const payment = await this.repo.getById(id);
            if (payment) {
                const freed = (payment.children ?? []).reduce((s, c) => s + Number(c.amount), Number(payment.amount));
                await this.assertWithinRemaining(userId, payment.purchaseId, data.amount, freed);
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

    private async assertWithinRemaining(
        userId: number,
        purchaseId: number,
        amount: number,
        allowance = 0,
    ): Promise<void> {
        const info = await this.paymentInfo.getPurchasePaymentInfo(userId, purchaseId);
        if (!info) {
            throw new ValidationError('Закупка не найдена');
        }
        const cap = Math.round((info.available + allowance) * 100) / 100;
        if (amount <= 0 || amount > cap) {
            throw new ValidationError(`Сумма должна быть от 1 до ${cap.toLocaleString('ru-RU')} ₽`);
        }
    }

    private async assertOwnership(id: number, userId: number) {
        const payment = await this.repo.getById(id);
        if (!payment) return;
        if (payment.userId !== userId) {
            throw new ForbiddenError('Нельзя изменить чужой платёж');
        }
    }
}
