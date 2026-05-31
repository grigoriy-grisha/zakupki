import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const attributeTypesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.attributeType.list();
    }),

    create: adminProcedure
        .input(
            z.object({
                name: z.string().trim().min(1),
                parentId: z.number().nullable().optional(),
                showInTitle: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.attributeType.create(input);
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                showInTitle: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.services.attributeType.update(id, data);
        }),

    move: adminProcedure
        .input(z.object({ id: z.number(), direction: z.enum(['up', 'down']) }))
        .mutation(async ({ ctx, input }) => {
            await ctx.services.attributeType.move(input.id, input.direction);
            return { ok: true };
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.attributeType.delete(input.id);
    }),
});
