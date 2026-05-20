import type { PrismaClient } from '@zakupki/database';

export class PromoCodeRepository {
    constructor(private db: PrismaClient) {}

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
        return this.db.promoCode.create({ data });
    }

    async update(id: number, data: { isActive?: boolean; maxUses?: number; expiresAt?: Date; label?: string }) {
        return this.db.promoCode.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.promoCode.delete({ where: { id } });
    }

    async findById(id: number) {
        return this.db.promoCode.findUnique({ where: { id }, include: { purchase: true } });
    }

    async findByCode(code: string) {
        return this.db.promoCode.findUnique({ where: { code } });
    }

    async list() {
        return this.db.promoCode.findMany({
            include: { purchase: true, _count: { select: { usages: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async incrementUsedCount(id: number) {
        return this.db.promoCode.update({
            where: { id },
            data: { usedCount: { increment: 1 } },
        });
    }
}
