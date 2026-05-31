import { z } from 'zod';

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
                isBrand: z.boolean().optional(),
                parentId: z.number().nullable().optional(),
                showInTitle: z.boolean().optional(),
                characteristicIds: z.array(z.number()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.productAttribute.create(input);
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                showInTitle: z.boolean().optional(),
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
