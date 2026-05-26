import type { PrismaClient } from '@zakupki/database';
import type { CustomContext } from '../lib/types';

export function initMiddleware(db: PrismaClient) {
    return async (ctx: CustomContext, next: () => Promise<void>) => {
        ctx.db = db;

        if (ctx.from) {
            const telegramId = String(ctx.from.id);
            const existing = await db.telegramCredential.findUnique({
                where: { telegramId },
                select: { userId: true },
            });

            const user = existing
                ? await db.user.update({
                      where: { id: existing.userId },
                      data: {
                          firstName: ctx.from.first_name,
                          lastName: ctx.from.last_name,
                          username: ctx.from.username,
                          telegramCredential: {
                              update: { username: ctx.from.username },
                          },
                      },
                  })
                : await db.user.create({
                      data: {
                          firstName: ctx.from.first_name,
                          lastName: ctx.from.last_name,
                          username: ctx.from.username,
                          telegramCredential: {
                              create: {
                                  telegramId,
                                  username: ctx.from.username,
                              },
                          },
                      },
                  });

            ctx.session.userId = user.id;
            ctx.session.telegramId = ctx.from.id;
        }

        await next();
    };
}
