import type { PrismaClient } from '@zakupki/database';

export class UserRepository {
    private db: PrismaClient;

    constructor(db: PrismaClient) {
        this.db = db;
    }

    async refreshProfile(userId: number, data: { firstName: string; lastName?: string; username?: string }) {
        await this.db.user
            .update({
                where: { id: userId },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    username: data.username,
                },
            })
            .catch(() => {
                /* ignore if user deleted */
            });
    }

    async createOrGetUser(telegramId: string, info: { firstName: string; lastName?: string; username?: string }) {
        const existing = await this.db.telegramCredential.findUnique({
            where: { telegramId },
            select: { userId: true },
        });

        if (existing) {
            return this.db.user.update({
                where: { id: existing.userId },
                data: {
                    firstName: info.firstName,
                    lastName: info.lastName,
                    username: info.username,
                    telegramCredential: { update: { username: info.username } },
                },
            });
        }

        return this.db.user.create({
            data: {
                firstName: info.firstName,
                lastName: info.lastName,
                username: info.username,
                telegramCredential: {
                    create: { telegramId, username: info.username },
                },
            },
        });
    }
}
