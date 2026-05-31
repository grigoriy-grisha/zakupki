import { dbClient } from '@zakupki/database';

import { USER_CREDENTIALS_INCLUDE, USER_PROFILE_SELECT } from './user.types';

const userWithCredentials = {
    select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        role: true,
        telegramCredential: {
            select: {
                id: true,
                telegramId: true,
                username: true,
                avatarUrl: true,
            },
        },
        vkCredential: {
            select: {
                id: true,
                vkId: true,
                avatarUrl: true,
            },
        },
    },
} as const;

export class UserRepository {
    async list() {
        return dbClient.user.findMany({
            include: {
                orderLines: true,
                payments: true,
                ...USER_CREDENTIALS_INCLUDE,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getListItemById(id: number) {
        return dbClient.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                avatarUrl: true,
                phone: true,
                createdAt: true,
                orderLines: { select: { id: true } },
                telegramCredential: {
                    select: {
                        telegramId: true,
                        username: true,
                        avatarUrl: true,
                    },
                },
                vkCredential: {
                    select: {
                        vkId: true,
                        avatarUrl: true,
                    },
                },
            },
        });
    }

    async getById(id: number) {
        return dbClient.user.findUnique({
            where: { id },
            ...userWithCredentials,
        });
    }

    async getProfileById(id: number) {
        return dbClient.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                username: true,
                ...USER_PROFILE_SELECT,
            },
        });
    }

    async findUserIdByTelegramId(telegramId: string) {
        const credential = await dbClient.telegramCredential.findUnique({
            where: { telegramId },
            select: { userId: true },
        });
        return credential?.userId ?? null;
    }

    async findUserIdByVkId(vkId: string) {
        const credential = await dbClient.vkCredential.findUnique({
            where: { vkId },
            select: { userId: true },
        });
        return credential?.userId ?? null;
    }

    async upsertFromTelegramBot(telegramId: string, data: { username?: string; firstName: string; lastName?: string }) {
        const existingUserId = await this.findUserIdByTelegramId(telegramId);
        if (existingUserId != null) {
            return dbClient.user.update({
                where: { id: existingUserId },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    username: data.username,
                    telegramCredential: {
                        update: { username: data.username },
                    },
                },
                ...userWithCredentials,
            });
        }

        return dbClient.user.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                username: data.username,
                telegramCredential: {
                    create: {
                        telegramId,
                        username: data.username,
                    },
                },
            },
            ...userWithCredentials,
        });
    }

    async upsertFromVk(vkId: string, data: { firstName: string; lastName?: string; avatarUrl?: string | null }) {
        const existingUserId = await this.findUserIdByVkId(vkId);
        const credentialData = { avatarUrl: data.avatarUrl ?? undefined };

        if (existingUserId != null) {
            return dbClient.user.update({
                where: { id: existingUserId },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    avatarUrl: data.avatarUrl ?? undefined,
                    vkCredential: { update: credentialData },
                },
                ...userWithCredentials,
            });
        }

        return dbClient.user.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                avatarUrl: data.avatarUrl ?? undefined,
                vkCredential: {
                    create: {
                        vkId,
                        ...credentialData,
                    },
                },
            },
            ...userWithCredentials,
        });
    }

    async upsertFromTelegram(telegramId: string, data: { firstName: string; lastName?: string; avatarUrl?: string | null; username?: string }) {
        const existingUserId = await this.findUserIdByTelegramId(telegramId);
        const credentialData = {
            username: data.username,
            avatarUrl: data.avatarUrl ?? undefined,
        };

        if (existingUserId != null) {
            return dbClient.user.update({
                where: { id: existingUserId },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    avatarUrl: data.avatarUrl ?? undefined,
                    username: data.username,
                    telegramCredential: { update: credentialData },
                },
                ...userWithCredentials,
            });
        }

        return dbClient.user.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                avatarUrl: data.avatarUrl ?? undefined,
                username: data.username,
                telegramCredential: {
                    create: {
                        telegramId,
                        ...credentialData,
                    },
                },
            },
            ...userWithCredentials,
        });
    }

    async linkVk(userId: number, vkId: string, avatar: string | null) {
        return dbClient.user.update({
            where: { id: userId },
            data: {
                avatarUrl: avatar,
                vkCredential: {
                    upsert: {
                        create: { vkId, avatarUrl: avatar },
                        update: { vkId, avatarUrl: avatar },
                    },
                },
            },
            ...userWithCredentials,
        });
    }

    async linkTelegram(userId: number, telegramId: string, data: { username?: string; avatar: string | null }) {
        return dbClient.user.update({
            where: { id: userId },
            data: {
                avatarUrl: data.avatar,
                username: data.username,
                telegramCredential: {
                    upsert: {
                        create: {
                            telegramId,
                            username: data.username,
                            avatarUrl: data.avatar,
                        },
                        update: {
                            telegramId,
                            username: data.username,
                            avatarUrl: data.avatar,
                        },
                    },
                },
            },
            ...userWithCredentials,
        });
    }

    async getRoleById(id: number) {
        return dbClient.user.findUnique({
            where: { id },
            select: { role: true },
        });
    }

    async updateRole(userId: number, role: 'ADMIN' | 'CLIENT') {
        return dbClient.user.update({
            where: { id: userId },
            data: { role },
            select: { id: true, role: true },
        });
    }

    async unlinkVk(userId: number) {
        return dbClient.vkCredential.deleteMany({ where: { userId } });
    }

    async unlinkTelegram(userId: number) {
        return dbClient.telegramCredential.deleteMany({ where: { userId } });
    }
}
