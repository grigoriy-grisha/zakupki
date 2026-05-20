import type { PrismaClient } from '@zakupki/database';
import type { CustomContext } from '../types';

export function initMiddleware(db: PrismaClient) {
    return async (ctx: CustomContext, next: () => Promise<void>) => {
        ctx.db = db;

        if (ctx.from) {
            // Upsert user from Telegram data
            const user = await db.user.upsert({
                where: { telegramId: String(ctx.from.id) },
                update: {
                    firstName: ctx.from.first_name,
                    lastName: ctx.from.last_name,
                    username: ctx.from.username,
                },
                create: {
                    telegramId: String(ctx.from.id),
                    firstName: ctx.from.first_name,
                    lastName: ctx.from.last_name,
                    username: ctx.from.username,
                },
            });
            ctx.session.userId = user.id;
            ctx.session.telegramId = ctx.from.id;
        }

        await next();
    };
}
