import { dbClient } from '@zakupki/database';

export class PaymentRepository {
    findByUserId(userId: number, limit = 10) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: {
                purchase: { select: { tag: true, supplier: true } },
                children: { include: { promoCode: true } },
            },
            orderBy: { paidAt: 'desc' },
            take: limit,
        });
    }

    findAllByUserId(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: {
                purchase: { select: { id: true, tag: true } },
                children: true,
            },
            orderBy: { paidAt: 'desc' },
        });
    }

    submitPayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofObjectKey?: string;
        proofMimeType?: string;
    }) {
        return dbClient.$transaction(async (tx) => {
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

            return tx.payment.findUnique({
                where: { id: parent.id },
                include: { children: { include: { promoCode: true } } },
            });
        });
    }
}
