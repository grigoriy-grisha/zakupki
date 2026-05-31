import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { verifyTelegram, verifyVk } from '@/lib/auth';
import { adminProcedure, protectedProcedure, publicProcedure, router } from '../trpc';

export const usersRouter = router({
    list: adminProcedure.query(async ({ ctx }) => {
        return ctx.services.user.list();
    }),

    getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.user.getById(input.id);
    }),

    me: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.user.getProfile(ctx.userId);
    }),

    getRole: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.user.getRole(ctx.userId);
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
            return ctx.services.user.upsertFromTelegramBot(input.telegramId, {
                username: input.username,
                firstName: input.firstName,
                lastName: input.lastName,
            });
        }),

    linkProvider: protectedProcedure
        .input(z.object({ provider: z.enum(['vk', 'telegram']), data: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const service = ctx.services.user;

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
            await ctx.services.user.unlinkProvider(ctx.userId, input.provider);
        }),
});
