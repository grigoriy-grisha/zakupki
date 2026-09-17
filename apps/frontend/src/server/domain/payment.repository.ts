import { dbClient } from '@zakupki/database';
import { NotFoundError, ValidationError } from '@zakupki/types';

export class PaymentRepository {
    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return dbClient.payment.create({
            data: {
                userId: data.userId,
                purchaseId: data.purchaseId,
                amount: data.amount,
                adminNote: data.note,
                status: 'CONFIRMED',
            },
        });
    }

    async submitPayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofObjectKey?: string;
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
                const countedAlready = await tx.payment.findFirst({                    where: {
                        userId: data.userId,
                        purchaseId: data.purchaseId,
                        status: { not: 'REJECTED' },
                        promoCodeId: data.promoCodeId,
                        id: { not: parent.id },
                    },
                });
                if (!countedAlready) {
                    await tx.promoCode.update({
                        where: { id: data.promoCodeId },
                        data: { usedCount: { increment: 1 } },
                    });
                }
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
            orderBy: { submittedAt: 'desc' },
        });
    }

    async getByUser(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: { purchase: true, children: { include: { promoCode: true } } },
            orderBy: { submittedAt: 'desc' },
        });
    }

    findAllByUserId(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: {
                purchase: { select: { id: true, tag: true } },
                children: true,
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async getById(id: number) {
        return dbClient.payment.findUnique({ where: { id }, include: { children: true } });
    }

    async findPinnedPromo(userId: number, purchaseId: number) {
        const payment = await dbClient.payment.findFirst({
            where: {
                userId,
                purchaseId,
                parentId: null,
                status: { not: 'REJECTED' },
                children: { some: { promoCodeId: { not: null } } },
            },
            include: { children: { include: { promoCode: true } } },
            orderBy: { submittedAt: 'desc' },
        });
        return payment?.children.find((c) => c.promoCodeId != null)?.promoCode ?? null;
    }

    async getPromoDiscountUsed(userId: number, purchaseId: number, promoCodeId: number) {
        const agg = await dbClient.payment.aggregate({
            where: {
                userId,
                purchaseId,
                promoCodeId,
                status: { not: 'REJECTED' },
            },
            _sum: { amount: true },
        });
        return Number(agg._sum.amount ?? 0);
    }

    async findWithPurchase(id: number) {
        return dbClient.payment.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                purchaseId: true,
                amount: true,
                status: true,
                purchase: { select: { tag: true } },
            },
        });
    }

    async updateStatus(id: number, status: 'CONFIRMED' | 'REJECTED', adminNote?: string) {
        return dbClient.$transaction(async (tx) => {
            const existing = await tx.payment.findUnique({
                where: { id },
                include: { children: { select: { promoCodeId: true } } },
            });
            const updated = await tx.payment.update({
                where: { id },
                data: { status, adminNote },
            });
            await tx.payment.updateMany({
                where: { parentId: id },
                data: { status },
            });
            if (status === 'REJECTED' && existing) {
                const promoIds = [
                    ...new Set(existing.children.map((c) => c.promoCodeId).filter((x): x is number => x != null)),
                ];
                for (const promoCodeId of promoIds) {
                    const stillUsed = await tx.payment.findFirst({
                        where: {
                            userId: existing.userId,
                            purchaseId: existing.purchaseId,
                            id: { not: id },
                            status: { not: 'REJECTED' },
                            promoCodeId,
                        },
                    });
                    if (!stillUsed) {
                        await tx.promoCode.updateMany({
                            where: { id: promoCodeId, usedCount: { gt: 0 } },
                            data: { usedCount: { decrement: 1 } },
                        });
                    }
                }
            }
            return updated;
        });
    }

    async update(
        id: number,
        data: {
            amount?: number;
            userComment?: string;
            proofObjectKey?: string;
            status?: string;
            adminNote?: string | null;
        },
    ) {
        const updateData: Record<string, unknown> = {};
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.userComment !== undefined) updateData.userComment = data.userComment;
        if (data.proofObjectKey !== undefined) updateData.proofObjectKey = data.proofObjectKey;
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
