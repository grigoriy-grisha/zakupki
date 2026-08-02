import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';
import { withDbConflict } from '../lib/error-utils';

const supplierNameSchema = z.string().trim().min(1, 'Укажите название').max(120);

export const suppliersRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.supplier.list();
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.supplier.findById(input.id);
    }),

    create: adminProcedure
        .input(
            z.object({
                name: supplierNameSchema,
                contact: z.string().trim().max(200).optional(),
                notes: z.string().trim().max(2000).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return withDbConflict(() => ctx.services.supplier.create(input), 'Поставщик с таким именем уже существует');
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: supplierNameSchema.optional(),
                contact: z.string().trim().max(200).nullable().optional(),
                notes: z.string().trim().max(2000).nullable().optional(),
                position: z.number().int().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return withDbConflict(() => ctx.services.supplier.update(id, data), 'Поставщик с таким именем уже существует');
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.supplier.delete(input.id);
    }),
});
