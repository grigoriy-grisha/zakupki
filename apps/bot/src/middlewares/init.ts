import type { PrismaClient } from '@zakupki/database';
import type { CustomContext, SessionData } from '../lib/types';

/**
 * Initializes context on every update:
 * - Attaches `db` to context
 * - On first visit (no session.userId): creates/finds user in DB, stores in session
 * - On subsequent visits: skips DB calls entirely
 * - Periodically refreshes profile fields (firstName, lastName, username)
 */
export function initMiddleware(db: PrismaClient) {
    const PROFILE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

    return async (ctx: CustomContext, next: () => Promise<void>) => {
        ctx.db = db;

        if (!ctx.from) {
            await next();
            return;
        }

        const telegramId = String(ctx.from.id);

        // Fast path: session already has userId
        if (ctx.session.userId && ctx.session.telegramId === ctx.from.id) {
            // Refresh profile fields occasionally
            const lastRefresh = ctx.session.profileRefreshedAt ?? 0;
            if (Date.now() - lastRefresh > PROFILE_REFRESH_INTERVAL) {
                await db.user.update({
                    where: { id: ctx.session.userId },
                    data: {
                        firstName: ctx.from.first_name,
                        lastName: ctx.from.last_name,
                        username: ctx.from.username,
                    },
                }).catch(() => { /* ignore if user deleted */ });
                ctx.session.profileRefreshedAt = Date.now();
            }

            await next();
            return;
        }

        // Slow path: resolve or create user
        const existing = await db.telegramCredential.findUnique({
            where: { telegramId },
            select: { userId: true },
        });

        const user = existing
            ? await db.user.update({
                  where: { id: existing.userId },
                  data: {
                      firstName: ctx.from!.first_name,
                      lastName: ctx.from!.last_name,
                      username: ctx.from!.username,
                      telegramCredential: { update: { username: ctx.from!.username } },
                  },
              })
            : await db.user.create({
                  data: {
                      firstName: ctx.from!.first_name,
                      lastName: ctx.from!.last_name,
                      username: ctx.from!.username,
                      telegramCredential: {
                          create: { telegramId, username: ctx.from!.username },
                      },
                  },
              });

        ctx.session.userId = user.id;
        ctx.session.telegramId = ctx.from.id;
        ctx.session.profileRefreshedAt = Date.now();

        await next();
    };
}
