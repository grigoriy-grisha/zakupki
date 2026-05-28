import { z } from 'zod';

import { PromoCodeRepository } from '../domain/promo-code.repository';
import { PromoCodeService } from '../services/promo-code.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { promoCode: new PromoCodeService(new PromoCodeRepository(db)) };
}

export const promoCodesRouter = router({
    list: adminProcedure.query(async ({ ctx }) => {
        const { promoCode } = services(ctx.db);
        return promoCode.list();
    }),

    create: adminProcedure
        .input(
            z.object({
                code: z.string().min(1).max(50),
                label: z.string().optional(),
                type: z.enum(['PERCENT', 'FIXED']),
                value: z.number().positive(),
                purchaseId: z.number().optional(),
                maxUses: z.number().int().positive().optional(),
                minAmount: z.number().positive().optional(),
                expiresAt: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { promoCode } = services(ctx.db);
            return promoCode.create({
                ...input,
                code: input.code.toUpperCase().trim(),
                expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
            });
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                isActive: z.boolean().optional(),
                maxUses: z.number().int().positive().optional(),
                expiresAt: z.string().optional(),
                label: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { promoCode } = services(ctx.db);
            return promoCode.update(id, {
                ...data,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
            });
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { promoCode } = services(ctx.db);
        return promoCode.delete(input.id);
    }),

    validate: protectedProcedure
        .input(z.object({ code: z.string(), purchaseId: z.number(), orderAmount: z.number() }))
        .query(async ({ ctx, input }) => {
            const { promoCode } = services(ctx.db);
            return promoCode.validate(input.code.toUpperCase().trim(), input.purchaseId, input.orderAmount);
        }),
});
