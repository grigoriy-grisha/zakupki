import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const postTemplatesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.postTemplate.list();
    }),

    create: adminProcedure
        .input(z.object({ name: z.string().trim().min(1), body: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.postTemplate.create(input);
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                body: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.services.postTemplate.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.postTemplate.delete(input.id);
    }),
});
