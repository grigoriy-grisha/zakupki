import { createLogger } from '@zakupki/logger';
import { ForbiddenError, ValidationError } from '@zakupki/types';

import type { PaymentRepository } from '../domain/payment.repository';
import type { NotificationService } from './notification.service';
import type { OnlinePaymentService } from './online-payment.service';

const log = createLogger('payment-service');

export class PaymentService {
    constructor(
        private repo: PaymentRepository,
        private notification: NotificationService,
        /** Ленивая ссылка: OnlinePaymentService создаётся в контейнере после PaymentService. */
        private onlinePayment: () => OnlinePaymentService,
    ) {}

    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return this.repo.create(data);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async getByUser(userId: number) {
        return this.repo.getByUser(userId);
    }

    /** Онлайн-оплаты меняют статус только по уведомлениям банка — ручное решение их бы рассинхронизировало. */
    private async assertManual(id: number): Promise<void> {
        const payment = await this.repo.findWithPurchase(id);
        if (payment && payment.method !== 'MANUAL') {
            throw new ValidationError('Статус онлайн-оплаты меняется автоматически по уведомлению банка');
        }
    }

    async confirm(id: number, adminNote?: string) {
        await this.assertManual(id);
        const result = await this.repo.updateStatus(id, 'CONFIRMED', adminNote);
        await this.notifyPayment(id, 'PAYMENT_CONFIRMED', adminNote);
        return result;
    }

    async reject(id: number, adminNote?: string) {
        await this.assertManual(id);
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
        // Строки скидки по промокоду и возвраты отменяются только вместе с основной оплатой.
        if (payment.parentId != null || payment.refundOfId != null) {
            throw new ValidationError('Эту оплату нельзя отменить');
        }
        if (payment.status === 'AWAITING') {
            await this.onlinePayment().cancelByUser(userId, id);
            return this.repo.getById(id);
        }
        if (payment.status !== 'PENDING') {
            throw new ValidationError('Отменить можно только оплату, которая ещё ожидает подтверждения');
        }
        return this.repo.updateStatus(id, 'REJECTED', 'Отменено участником');
    }
}
