import { dbClient } from '@zakupki/database';
import { NotFoundError, ValidationError } from '@zakupki/types';

export class PaymentRepository {
    /**
     * Create a payment record directly (admin-side). The admin note is stored
     * in `adminNote` (the only note-style field on Payment besides `userComment`,
     * which is reserved for the paying user's own text). Status defaults to
     * CONFIRMED: when an admin records an offline / cash / SBP-out-of-band
     * payment they have already seen the money — a PENDING row would just sit
     * in their own "awaiting review" queue forever.
     */
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
        return dbClient.payment.findUnique({ where: { id } });
    }

    /** Fetch a payment with the purchase tag included (for notification payloads). */
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
