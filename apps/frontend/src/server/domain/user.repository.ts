import type { PrismaClient } from '@zakupki/database';

export class UserRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.user.findMany({
            include: {
                orderLines: true,
                payments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async upsert(telegramId: string, data: { username?: string; firstName: string; lastName?: string }) {
        return this.db.user.upsert({
            where: { telegramId },
            update: data,
            create: { telegramId, ...data },
        });
    }

    async getById(id: number) {
        return this.db.user.findUnique({ where: { id } });
    }

    async getByTelegramId(telegramId: string) {
        return this.db.user.findUnique({ where: { telegramId } });
    }

    async getByVkId(vkId: string) {
        return this.db.user.findUnique({ where: { vkId } });
    }

    async upsertByVkId(vkId: string, data: { firstName: string; lastName?: string; avatarUrl?: string }) {
        return this.db.user.upsert({
            where: { vkId },
            update: data,
            create: { vkId, telegramId: null, ...data },
        });
    }
}
