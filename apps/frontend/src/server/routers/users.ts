import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import type { PrismaClient } from '@zakupki/database';
import { verifyTelegram, verifyVk } from '@/lib/auth';
import { createUserService } from '../lib/create-user-service';
import { adminProcedure, protectedProcedure, publicProcedure, router } from '../trpc';

function userService(db: PrismaClient) {
    return createUserService(db);
}

export const usersRouter = router({
    list: adminProcedure.query(async ({ ctx }) => {
        return userService(ctx.db).list();
    }),

    me: protectedProcedure.query(async ({ ctx }) => {
        return userService(ctx.db).getProfile(ctx.userId);
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
            return userService(ctx.db).upsertFromTelegramBot(input.telegramId, {
                username: input.username,
                firstName: input.firstName,
                lastName: input.lastName,
            });
        }),

    linkProvider: protectedProcedure
        .input(z.object({ provider: z.enum(['vk', 'telegram']), data: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const service = userService(ctx.db);

            if (input.provider === 'vk') {
                const verified = await verifyVk(input.data);
                if (!verified) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'VK верификация не удалась' });
                }
                await service.linkVk(ctx.userId, verified);
            } else {
                const verified = await verifyTelegram(input.data);
                if (!verified) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Telegram верификация не удалась' });
                }
                await service.linkTelegram(ctx.userId, verified);
            }
        }),

    unlinkProvider: protectedProcedure
        .input(z.object({ provider: z.enum(['vk', 'telegram']) }))
        .mutation(async ({ ctx, input }) => {
            await userService(ctx.db).unlinkProvider(ctx.userId, input.provider);
        }),
});
