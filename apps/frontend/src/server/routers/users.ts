import { z } from 'zod';

import { UserRepository } from '../domain/user.repository';
import { UserService } from '../services/user.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, publicProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { user: new UserService(new UserRepository(db)) };
}

export const usersRouter = router({
    list: adminProcedure.query(async ({ ctx }) => {
        const { user } = services(ctx.db);
        return user.list();
    }),

    upsertFromTelegram: publicProcedure
        .input(
            z.object({
                telegramId: z.string(),
                username: z.string().optional(),
                firstName: z.string(),
                lastName: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { user } = services(ctx.db);
            return user.upsert(input.telegramId, {
                username: input.username,
                firstName: input.firstName,
                lastName: input.lastName,
            });
        }),
});
