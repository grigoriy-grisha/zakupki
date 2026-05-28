import { TRPCError } from '@trpc/server';

import type { VerifiedAccount } from '../domain/user.types';
import { UserRepository } from '../domain/user.repository';
import { RoleService } from './role.service';

function splitName(name: string) {
    const [firstName, ...rest] = name.split(' ');
    return { firstName, lastName: rest.join(' ') || undefined };
}

export class UserService {
    constructor(
        private repo: UserRepository,
        private roleService: RoleService,
    ) {}

    async list() {
        return this.repo.list();
    }

    async upsertFromTelegramBot(telegramId: string, data: { username?: string; firstName: string; lastName?: string }) {
        return this.repo.upsertFromTelegramBot(telegramId, data);
    }

    async getProfile(userId: number) {
        const user = await this.repo.getProfileById(userId);
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
        }
        return user;
    }

    async signInWithVk(verified: VerifiedAccount) {
        const { firstName, lastName } = splitName(verified.name);
        const user = await this.repo.upsertFromVk(verified.providerAccountId, {
            firstName,
            lastName,
            avatarUrl: verified.avatar,
        });
        await this.roleService.ensureClientRole(user.id);
        const role = await this.roleService.getUserRoleKind(user.id);
        return { id: String(user.id), name: verified.name, image: verified.avatar, role };
    }

    async signInWithTelegram(verified: VerifiedAccount) {
        const { firstName, lastName } = splitName(verified.name);
        const user = await this.repo.upsertFromTelegram(verified.providerAccountId, {
            firstName,
            lastName,
            avatarUrl: verified.avatar,
            username: verified.username ?? undefined,
        });
        await this.roleService.ensureClientRole(user.id);
        const role = await this.roleService.getUserRoleKind(user.id);
        return { id: String(user.id), name: verified.name, image: verified.avatar, role };
    }

    async linkVk(userId: number, verified: VerifiedAccount) {
        const ownerId = await this.repo.findUserIdByVkId(verified.providerAccountId);
        if (ownerId != null && ownerId !== userId) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Этот VK-аккаунт уже привязан к другому пользователю' });
        }
        await this.repo.linkVk(userId, verified.providerAccountId, verified.avatar);
    }

    async linkTelegram(userId: number, verified: VerifiedAccount) {
        const ownerId = await this.repo.findUserIdByTelegramId(verified.providerAccountId);
        if (ownerId != null && ownerId !== userId) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'Этот Telegram-аккаунт уже привязан к другому пользователю',
            });
        }
        await this.repo.linkTelegram(userId, verified.providerAccountId, {
            username: verified.username ?? undefined,
            avatar: verified.avatar,
        });
    }

    async unlinkProvider(userId: number, provider: 'vk' | 'telegram') {
        const user = await this.repo.getById(userId);
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
        }

        const hasVk = !!user.vkCredential;
        const hasTelegram = !!user.telegramCredential;

        if (provider === 'vk') {
            if (!hasVk) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Аккаунт не привязан' });
            }
            if (!hasTelegram) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя отвязать последний метод авторизации' });
            }
            await this.repo.unlinkVk(userId);
            return;
        }

        if (!hasTelegram) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Аккаунт не привязан' });
        }
        if (!hasVk) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя отвязать последний метод авторизации' });
        }
        await this.repo.unlinkTelegram(userId);
    }
}
