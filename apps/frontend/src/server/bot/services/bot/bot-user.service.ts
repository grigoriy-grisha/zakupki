import { serviceContainer } from '@/server/lib/service-container';

export type BotUser = {
    id: number;
};

/**
 * Bot-специфичный user service. Тонкая обёртка над frontend `serviceContainer.user`,
 * ограниченная только теми методами, которые нужны боту.
 *
 * Phase E: фасад. Phase E+ (если потребуется полная изоляция) — копия логики
 * `user.service.ts:createOrGetUser` + `refreshProfile` с прямым Prisma-доступом.
 */
export class BotUserService {
    /** Создаёт или обновляет пользователя по Telegram ID. */
    async upsertFromTelegramBot(
        telegramId: string,
        info: { firstName: string; lastName?: string; username?: string },
    ): Promise<BotUser> {
        const user = await serviceContainer.user.createOrGetUser(telegramId, info);
        return { id: user.id };
    }

    /** Обновляет профиль (firstName/lastName/username) без throw, если user удалён. */
    async refreshProfile(
        userId: number,
        data: { firstName: string; lastName?: string; username?: string },
    ): Promise<void> {
        await serviceContainer.user.refreshProfile(userId, data);
    }

    async hasPersonalDataConsent(userId: number): Promise<boolean> {
        const consent = await serviceContainer.user.getPersonalDataConsent(userId);
        return consent.accepted;
    }

    async acceptPersonalDataConsent(userId: number): Promise<void> {
        await serviceContainer.user.acceptPersonalDataConsent(userId);
    }
}
