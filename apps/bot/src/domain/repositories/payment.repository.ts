import { dbClient } from '@zakupki/database';

const db = dbClient;

export class PaymentRepository {
    findByUserId(userId: number, limit = 10) {
        return db.payment.findMany({
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
