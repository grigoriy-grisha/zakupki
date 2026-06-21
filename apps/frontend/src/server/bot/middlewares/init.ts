import { dbClient } from '@zakupki/database';
import type { NextFunction } from 'grammy';

import type { CustomContext } from '../domain/types';
import { PROFILE_REFRESH_INTERVAL } from '../domain/constants';
import { log } from '../lib/logger';
import type { ServiceContainer } from '../container/service-container';

/**
 * SessionInitMiddleware — инициализирует ctx.session.userId/telegramId/profileRefreshedAt
 * на основе Telegram-профиля. Также обновляет профиль, если прошло > 5 минут.
 */
export class SessionInitMiddleware {
    constructor(private readonly container: ServiceContainer) {}

    middleware() {
        return async (ctx: CustomContext, next: NextFunction): Promise<void> => {
            ctx.db = dbClient;

            if (!ctx.from) {
                await next();
                return;
            }

            const telegramId = String(ctx.from.id);

            if (ctx.session.userId && ctx.session.telegramId === ctx.from.id) {
                const lastRefresh = ctx.session.profileRefreshedAt ?? 0;
                if (Date.now() - lastRefresh > PROFILE_REFRESH_INTERVAL) {
                    await this.container.userService.refreshProfile(ctx.session.userId, {
                        firstName: ctx.from.first_name,
                        lastName: ctx.from.last_name,
                        username: ctx.from.username,
                    });
                    ctx.session.profileRefreshedAt = Date.now();
                }

                await next();
                return;
            }

            try {
                const user = await this.container.userService.upsertFromTelegramBot(telegramId, {
                    firstName: ctx.from.first_name,
                    lastName: ctx.from.last_name,
                    username: ctx.from.username,
                });

                ctx.session.userId = user.id;
                ctx.session.telegramId = ctx.from.id;
                ctx.session.profileRefreshedAt = Date.now();
            } catch (err) {
                log.error({ err, telegramId }, 'createOrGetUser failed');
            }

            await next();
        };
    }
}

/** Backward-compat: модульная функция, использующая новый класс. */
export function initMiddleware() {
    // ServiceContainer передаётся в create-bot.ts через start.ts
    // Эта функция-заглушка перехватывается в create-bot.ts, где заменяется на class.
    throw new Error('initMiddleware() deprecated — use SessionInitMiddleware(container)');
}
