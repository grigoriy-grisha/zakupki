import { z } from 'zod';

import { UserRepository } from '../domain/user.repository';
import { UserService } from '../services/user.service';
import type { PrismaClient } from '@zakupki/database';
import { TRPCError } from '@trpc/server';
import { verifyTelegram, verifyVk } from '@/lib/auth';
import { adminProcedure, protectedProcedure, publicProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { user: new UserService(new UserRepository(db)) };
}

export const usersRouter = router({
    list: adminProcedure.query(async ({ ctx }) => {
        const { user } = services(ctx.db);
        return user.list();
    }),

    me: protectedProcedure.query(async ({ ctx }) => {
        const user = await ctx.db.user.findUnique({
            where: { id: ctx.userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                username: true,
                vkId: true,
                telegramId: true,
                vkAvatarUrl: true,
                telegramAvatarUrl: true,
            },
        });
        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
        }
        return user;
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

    linkProvider: protectedProcedure
        .input(z.object({ provider: z.enum(['vk', 'telegram']), data: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const { provider, data } = input;
            const userId = ctx.userId;

            if (provider === 'vk') {
                const verified = await verifyVk(data);
                if (!verified) throw new TRPCError({ code: 'BAD_REQUEST', message: 'VK верификация не удалась' });

                const existing = await ctx.db.user.findUnique({ where: { vkId: verified.providerAccountId } });
                if (existing && existing.id !== userId) {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Этот VK-аккаунт уже привязан к другому пользователю' });
                }

                await ctx.db.user.update({
                    where: { id: userId },
                    data: { vkId: verified.providerAccountId, avatarUrl: verified.avatar, vkAvatarUrl: verified.avatar },
                });
            } else {
                const verified = await verifyTelegram(data);
                if (!verified) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Telegram верификация не удалась' });

                const existing = await ctx.db.user.findUnique({ where: { telegramId: verified.providerAccountId } });
                if (existing && existing.id !== userId) {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Этот Telegram-аккаунт уже привязан к другому пользователю' });
                }

                await ctx.db.user.update({
                    where: { id: userId },
                    data: {
                        telegramId: verified.providerAccountId,
                        username: verified.username ?? undefined,
                        avatarUrl: verified.avatar,
                        telegramAvatarUrl: verified.avatar,
                    },
                });
            }
        }),

    unlinkProvider: protectedProcedure
        .input(z.object({ provider: z.enum(['vk', 'telegram']) }))
        .mutation(async ({ ctx, input }) => {
            const field = input.provider === 'vk' ? 'vkId' : 'telegramId';
            const otherField = input.provider === 'vk' ? 'telegramId' : 'vkId';

            const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
            if (!user || !user[field]) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Аккаунт не привязан' });
            }
            if (!user[otherField]) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя отвязать последний метод авторизации' });
            }

            await ctx.db.user.update({
                where: { id: ctx.userId },
                data: { [field]: null },
            });
        }),
});
