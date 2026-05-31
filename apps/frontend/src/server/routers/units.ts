import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const unitsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.unit.list();
    }),

    create: adminProcedure
        .input(
            z.object({
                name: z.string().min(1, 'Название обязательно'),
                shortName: z.string().min(1, 'Краткое название обязательно'),
                multiplicity: z.number().positive('Кратность должна быть положительной'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.unit.create(input);
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().optional(),
                shortName: z.string().optional(),
                multiplicity: z.number().positive().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return ctx.services.unit.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.unit.delete(input.id);
    }),
});
