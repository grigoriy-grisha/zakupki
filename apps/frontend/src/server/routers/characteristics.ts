import { z } from 'zod';
import { withDbConflict } from '../lib/error-utils';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const characteristicsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.characteristic.list();
    }),

    create: adminProcedure.input(z.object({ name: z.string().trim().min(1) })).mutation(async ({ ctx, input }) => {
        return withDbConflict(() => ctx.services.characteristic.create(input));
    }),

    update: adminProcedure
        .input(z.object({ id: z.number(), name: z.string().trim().min(1).optional() }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return withDbConflict(() => ctx.services.characteristic.update(id, data));
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.characteristic.delete(input.id);
    }),
});
