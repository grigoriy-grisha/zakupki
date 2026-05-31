import { z } from 'zod';
import { handleDbConflict } from '../lib/error-utils';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const suppliersRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.supplier.list();
    }),

    create: adminProcedure
        .input(z.object({ name: z.string().trim().min(1) }))
        .mutation(async ({ ctx, input }) => {
            try {
                return await ctx.services.supplier.create(input);
            } catch (err) {
                handleDbConflict(err);
            }
        }),

    update: adminProcedure
        .input(z.object({ id: z.number(), name: z.string().trim().min(1).optional() }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            try {
                return await ctx.services.supplier.update(id, data);
            } catch (err) {
                handleDbConflict(err);
            }
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.supplier.delete(input.id);
    }),
});
