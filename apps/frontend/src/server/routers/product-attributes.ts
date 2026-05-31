import { z } from 'zod';
import { handleDbConflict } from '../lib/error-utils';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const productAttributesRouter = router({
    list: protectedProcedure
        .input(z.object({ typeId: z.number().optional() }).optional())
        .query(async ({ ctx, input }) => {
            return ctx.services.productAttribute.list(input?.typeId);
        }),

    create: adminProcedure
        .input(
            z.object({
                typeId: z.number(),
                name: z.string().trim().min(1),
                characteristicIds: z.array(z.number()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            try {
                return await ctx.services.productAttribute.create(input);
            } catch (err) {
                handleDbConflict(err);
            }
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                characteristicIds: z.array(z.number()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.services.productAttribute.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.productAttribute.delete(input.id);
    }),
});
