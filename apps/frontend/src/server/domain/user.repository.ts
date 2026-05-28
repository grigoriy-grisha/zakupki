import type { PrismaClient } from '@zakupki/database';

import { USER_PROFILE_INCLUDE, type UpsertOAuthProfile } from './user.types';

const userWithCredentials = {
    include: {
        telegramCredential: true,
        vkCredential: true,
    },
} as const;

export class UserRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.user.findMany({
            include: {
                orderLines: true,
                payments: true,
                ...USER_PROFILE_INCLUDE,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return this.db.user.findUnique({
            where: { id },
            ...userWithCredentials,
        });
    }

    async getProfileById(id: number) {
        return this.db.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                username: true,
                ...USER_PROFILE_INCLUDE,
            },
        });
    }

    async findUserIdByTelegramId(telegramId: string) {
        const credential = await this.db.telegramCredential.findUnique({
            where: { telegramId },
            select: { userId: true },
        });
        return credential?.userId ?? null;
    }

    async findUserIdByVkId(vkId: string) {
        const credential = await this.db.vkCredential.findUnique({
            where: { vkId },
            select: { userId: true },
        });
        return credential?.userId ?? null;
    }

    async upsertFromTelegramBot(telegramId: string, data: { username?: string; firstName: string; lastName?: string }) {
        const existingUserId = await this.findUserIdByTelegramId(telegramId);
        if (existingUserId != null) {
            return this.db.user.update({
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

        return this.db.user.create({
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

    async upsertFromVk(vkId: string, data: UpsertOAuthProfile) {
        const existingUserId = await this.findUserIdByVkId(vkId);
        const credentialData = { avatarUrl: data.avatarUrl ?? undefined };

        if (existingUserId != null) {
            return this.db.user.update({
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

        return this.db.user.create({
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

    async upsertFromTelegram(telegramId: string, data: UpsertOAuthProfile & { username?: string }) {
        const existingUserId = await this.findUserIdByTelegramId(telegramId);
        const credentialData = {
            username: data.username,
            avatarUrl: data.avatarUrl ?? undefined,
        };

        if (existingUserId != null) {
            return this.db.user.update({
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

        return this.db.user.create({
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
        return this.db.user.update({
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
        return this.db.user.update({
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

    async unlinkVk(userId: number) {
        return this.db.vkCredential.deleteMany({ where: { userId } });
    }

    async unlinkTelegram(userId: number) {
        return this.db.telegramCredential.deleteMany({ where: { userId } });
    }
}
