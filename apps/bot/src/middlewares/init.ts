import { dbClient } from '@zakupki/database';
import type { CustomContext } from '../domain/types';
import { PROFILE_REFRESH_INTERVAL } from '../domain/constants';
import { UserService } from '../services/user.service';

export function initMiddleware() {
    const users = new UserService();

    return async (ctx: CustomContext, next: () => Promise<void>) => {
        ctx.db = dbClient;

        if (!ctx.from) {
            await next();
            return;
        }

        const telegramId = String(ctx.from.id);

        if (ctx.session.userId && ctx.session.telegramId === ctx.from.id) {
            const lastRefresh = ctx.session.profileRefreshedAt ?? 0;
            if (Date.now() - lastRefresh > PROFILE_REFRESH_INTERVAL) {
                await users.refreshProfile(ctx.session.userId, {
                    firstName: ctx.from.first_name,
                    lastName: ctx.from.last_name,
                    username: ctx.from.username,
                });
                ctx.session.profileRefreshedAt = Date.now();
            }

            await next();
            return;
        }

        const user = await users.createOrGetUser(telegramId, {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
        });

        ctx.session.userId = user.id;
        ctx.session.telegramId = ctx.from.id;
        ctx.session.profileRefreshedAt = Date.now();

        await next();
    };
}
