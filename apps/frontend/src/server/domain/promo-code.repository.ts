import { dbClient } from '@zakupki/database';

export class PromoCodeRepository {
    constructor() {}

    async create(data: {
        code: string;
        label?: string;
        type: 'PERCENT' | 'FIXED';
        value: number;
        purchaseId?: number;
        maxUses?: number;
        minAmount?: number;
        expiresAt?: Date;
    }) {
        return dbClient.promoCode.create({ data });
    }

    async update(id: number, data: { isActive?: boolean; maxUses?: number; expiresAt?: Date; label?: string }) {
        return dbClient.promoCode.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.promoCode.delete({ where: { id } });
    }

    async findById(id: number) {
        return dbClient.promoCode.findUnique({ where: { id }, include: { purchase: true } });
    }

    async findByCode(code: string) {
        return dbClient.promoCode.findUnique({ where: { code } });
    }

    async list() {
        return dbClient.promoCode.findMany({
            include: { purchase: true, _count: { select: { usages: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async incrementUsedCount(id: number) {
        return dbClient.promoCode.update({
            where: { id },
            data: { usedCount: { increment: 1 } },
        });
    }
}
