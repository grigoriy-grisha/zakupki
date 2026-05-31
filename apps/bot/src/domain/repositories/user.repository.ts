import { dbClient } from '@zakupki/database';

const db = dbClient;

export class UserRepository {
    async refreshProfile(userId: number, data: { firstName: string; lastName?: string; username?: string }) {
        await db.user
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
        const existing = await db.telegramCredential.findUnique({
            where: { telegramId },
            select: { userId: true },
        });

        if (existing) {
            return db.user.update({
                where: { id: existing.userId },
                data: {
                    firstName: info.firstName,
                    lastName: info.lastName,
                    username: info.username,
                    telegramCredential: { update: { username: info.username } },
                },
            });
        }

        return db.user.create({
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
