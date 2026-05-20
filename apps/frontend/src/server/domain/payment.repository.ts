import type { PrismaClient } from '@zakupki/database';

export class PaymentRepository {
    constructor(private db: PrismaClient) {}

    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return this.db.payment.create({ data });
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
        return this.db.$transaction(async (tx) => {
            const parent = await tx.payment.create({
                data: {
                    userId: data.userId,
                    purchaseId: data.purchaseId,
                    amount: data.amount,
                    userComment: data.userComment,
                    proofData: data.proofData ? new Uint8Array(data.proofData) : undefined,
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
        return this.db.payment.findMany({
            where: { purchaseId, parentId: null },
            include: { user: true, children: { include: { promoCode: true } } },
            orderBy: { paidAt: 'desc' },
        });
    }

    async getByUser(userId: number) {
        return this.db.payment.findMany({
            where: { userId, parentId: null },
            include: { purchase: true, children: { include: { promoCode: true } } },
            orderBy: { paidAt: 'desc' },
        });
    }

    async getById(id: number) {
        return this.db.payment.findUnique({ where: { id } });
    }

    async updateStatus(id: number, status: 'CONFIRMED' | 'REJECTED', adminNote?: string) {
        return this.db.$transaction(async (tx) => {
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

    async update(id: number, data: { amount?: number; userComment?: string; proofData?: Buffer; proofMimeType?: string; status?: string; adminNote?: string | null }) {
        const updateData: Record<string, unknown> = {};
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.userComment !== undefined) updateData.userComment = data.userComment;
        if (data.proofData !== undefined) updateData.proofData = new Uint8Array(data.proofData);
        if (data.proofMimeType !== undefined) updateData.proofMimeType = data.proofMimeType;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.adminNote !== undefined) updateData.adminNote = data.adminNote;

        return this.db.$transaction(async (tx) => {
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
