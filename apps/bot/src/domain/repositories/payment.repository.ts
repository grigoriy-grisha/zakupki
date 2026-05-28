import type { PrismaClient } from '@zakupki/database';

export class PaymentRepository {
    private db: PrismaClient;

    constructor(db: PrismaClient) {
        this.db = db;
    }

    findByUserId(userId: number, limit = 10) {
        return this.db.payment.findMany({
            where: { userId, parentId: null },
            include: {
                purchase: { select: { tag: true, supplier: true } },
                children: { include: { promoCode: true } },
            },
            orderBy: { paidAt: 'desc' },
            take: limit,
        });
    }
}
