import { ForbiddenError, ValidationError } from '@zakupki/types';

import { storage } from '@/lib/server/storage';

import { PaymentRepository } from '../domain/payment.repository';

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
}
