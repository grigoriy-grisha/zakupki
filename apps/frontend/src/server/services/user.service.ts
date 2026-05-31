import { NotFoundError, ValidationError } from '@zakupki/types';
import type { RoleKind } from '@zakupki/database';

import type { VerifiedAccount } from '../domain/user.types';
import { UserRepository } from '../domain/user.repository';

function splitName(name: string) {
    const [firstName, ...rest] = name.split(' ');
    return { firstName, lastName: rest.join(' ') || undefined };
}

const ROLE_CACHE_TTL_MS = 60_000; // 1 minute

export class UserService {
    private roleCache = new Map<number, { role: RoleKind; expiresAt: number }>();

    constructor(
        private repo: UserRepository,
    ) {}

    /**
     * Returns the user's role with in-memory TTL caching.
     * Used by auth middleware to avoid a DB query on every request.
     */
    async getCachedRole(userId: number): Promise<RoleKind | null> {
        const cached = this.roleCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.role;
        }

        const user = await this.repo.getRoleById(userId);
        if (!user) return null;

        this.roleCache.set(userId, { role: user.role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
        return user.role;
    }

    async list() {
        return this.repo.list();
    }

    async getById(id: number) {
        const user = await this.repo.getListItemById(id);
        if (!user) throw new NotFoundError('Пользователь', id);
        return user;
    }

    async upsertFromTelegramBot(telegramId: string, data: { username?: string; firstName: string; lastName?: string }) {
        return this.repo.upsertFromTelegramBot(telegramId, data);
    }

    async getProfile(userId: number) {
        const user = await this.repo.getProfileById(userId);
        if (!user) throw new NotFoundError('Пользователь', userId);
        return user;
    }

    async getRole(userId: number) {
        const role = await this.getCachedRole(userId);
        if (role === null) throw new NotFoundError('Пользователь', userId);
        return { role };
    }

    async signInWithVk(verified: VerifiedAccount) {
        const { firstName, lastName } = splitName(verified.name);
        const user = await this.repo.upsertFromVk(verified.providerAccountId, {
            firstName,
            lastName,
            avatarUrl: verified.avatar,
        });
        return { id: String(user.id), name: verified.name, image: verified.avatar, role: user.role };
    }

    async signInWithTelegram(verified: VerifiedAccount) {
        const { firstName, lastName } = splitName(verified.name);
        const user = await this.repo.upsertFromTelegram(verified.providerAccountId, {
            firstName,
            lastName,
            avatarUrl: verified.avatar,
            username: verified.username ?? undefined,
        });
        return { id: String(user.id), name: verified.name, image: verified.avatar, role: user.role };
    }

    async linkVk(userId: number, verified: VerifiedAccount) {
        const ownerId = await this.repo.findUserIdByVkId(verified.providerAccountId);
        if (ownerId != null && ownerId !== userId) {
            throw new ValidationError('Этот VK-аккаунт уже привязан к другому пользователю');
        }
        await this.repo.linkVk(userId, verified.providerAccountId, verified.avatar);
    }

    async linkTelegram(userId: number, verified: VerifiedAccount) {
        const ownerId = await this.repo.findUserIdByTelegramId(verified.providerAccountId);
        if (ownerId != null && ownerId !== userId) {
            throw new ValidationError('Этот Telegram-аккаунт уже привязан к другому пользователю');
        }
        await this.repo.linkTelegram(userId, verified.providerAccountId, {
            username: verified.username ?? undefined,
            avatar: verified.avatar,
        });
    }

    async unlinkProvider(userId: number, provider: 'vk' | 'telegram') {
        const user = await this.repo.getById(userId);
        if (!user) throw new NotFoundError('Пользователь', userId);

        const hasVk = !!user.vkCredential;
        const hasTelegram = !!user.telegramCredential;

        if (provider === 'vk') {
            if (!hasTelegram) {
                throw new ValidationError('Нельзя отвязать последний метод авторизации');
            }
            if (!hasVk) {
                throw new ValidationError('Аккаунт не привязан');
            }
            await this.repo.unlinkVk(userId);
            return;
        }

        if (!hasVk) {
            throw new ValidationError('Нельзя отвязать последний метод авторизации');
        }
        if (!hasTelegram) {
            throw new ValidationError('Аккаунт не привязан');
        }
        await this.repo.unlinkTelegram(userId);
    }
}
