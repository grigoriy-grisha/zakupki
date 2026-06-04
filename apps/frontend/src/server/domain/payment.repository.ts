import { dbClient } from '@zakupki/database';
import { NotFoundError, ValidationError } from '@zakupki/types';

export class PaymentRepository {
    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return dbClient.payment.create({ data });
    }

    async submitPayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofObjectKey?: string;
        proofMimeType?: string;
        promoCodeId?: number;
        discountAmount?: number;
    }) {
        return dbClient.$transaction(async (tx) => {
            if (data.promoCodeId && data.discountAmount) {
                const promoCheck = await tx.$queryRaw<Array<{ id: number; maxUses: number | null; usedCount: number }>>`
                    SELECT id, "maxUses", "usedCount"
                    FROM "PromoCode"
                    WHERE id = ${data.promoCodeId}
                    FOR UPDATE
                `;

                const promo = promoCheck[0];
                if (!promo) {
                    throw new NotFoundError('Промокод', data.promoCodeId);
                }
                if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
                    throw new ValidationError('Промокод исчерпан');
                }
            }

            const parent = await tx.payment.create({
                data: {
                    userId: data.userId,
                    purchaseId: data.purchaseId,
                    amount: data.amount,
                    userComment: data.userComment,
                    proofObjectKey: data.proofObjectKey,
                    proofMimeType: data.proofMimeType,
                },
            });

            if (data.promoCodeId && data.discountAmount) {
                await tx.payment.create({
                    data: {
                        userId: data.userId,
                        purchaseId: data.purchaseId,
                        amount: data.discountAmount,
                        parentId: parent.id,
                        promoCodeId: data.promoCodeId,
                    },
                });
                await tx.promoCode.update({
                    where: { id: data.promoCodeId },
                    data: { usedCount: { increment: 1 } },
                });
            }

            return tx.payment.findUnique({
                where: { id: parent.id },
                include: { children: { include: { promoCode: true } } },
            });
        });
    }

    async getByPurchase(purchaseId: number) {
        return dbClient.payment.findMany({
            where: { purchaseId, parentId: null },
            include: { user: true, children: { include: { promoCode: true } } },
            orderBy: { paidAt: 'desc' },
        });
    }

    async getByUser(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: { purchase: true, children: { include: { promoCode: true } } },
            orderBy: { paidAt: 'desc' },
        });
    }

    async getById(id: number) {
        return dbClient.payment.findUnique({ where: { id } });
    }

    async findPendingByUserAndPurchase(userId: number, purchaseId: number) {
        return dbClient.payment.findFirst({
            where: { userId, purchaseId, status: 'PENDING', parentId: null },
        });
    }

    async updateStatus(id: number, status: 'CONFIRMED' | 'REJECTED', adminNote?: string) {
        return dbClient.$transaction(async (tx) => {
            const updated = await tx.payment.update({
                where: { id },
                data: { status, adminNote },
            });
            await tx.payment.updateMany({
                where: { parentId: id },
                data: { status },
            });
            return updated;
        });
    }

    async update(
        id: number,
        data: {
            amount?: number;
            userComment?: string;
            proofData?: Buffer;
            proofMimeType?: string;
            status?: string;
            adminNote?: string | null;
        },
    ) {
        const updateData: Record<string, unknown> = {};
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.userComment !== undefined) updateData.userComment = data.userComment;
        if (data.proofData !== undefined) updateData.proofData = new Uint8Array(data.proofData);
        if (data.proofMimeType !== undefined) updateData.proofMimeType = data.proofMimeType;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.adminNote !== undefined) updateData.adminNote = data.adminNote;

        return dbClient.$transaction(async (tx) => {
            const updated = await tx.payment.update({
                where: { id },
                data: updateData,
            });
            if (data.status === 'PENDING') {
                await tx.payment.updateMany({
                    where: { parentId: id },
                    data: { status: 'PENDING', adminNote: null },
                });
            }
            return updated;
        });
    }
}
