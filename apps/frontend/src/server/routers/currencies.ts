import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';
import { withDbConflict } from '../lib/error-utils';

const currencyNameSchema = z.string().trim().min(1, 'Укажите название').max(120);
const currencyCodeSchema = z
    .string()
    .trim()
    .max(10, 'Не более 10 символов')
    .optional()
    .or(z.literal(''));
const currencySymbolSchema = z
    .string()
    .trim()
    .max(10, 'Не более 10 символов')
    .optional()
    .or(z.literal(''));

export const currenciesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.currency.list();
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.currency.findById(input.id);
    }),

    create: adminProcedure
        .input(
            z.object({
                name: currencyNameSchema,
                code: currencyCodeSchema,
                symbol: currencySymbolSchema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return withDbConflict(
                () => ctx.services.currency.create(input),
                'Валюта с таким названием уже существует',
            );
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: currencyNameSchema.optional(),
                code: z.string().trim().max(10).nullable().optional(),
                symbol: z.string().trim().max(10).nullable().optional(),
                position: z.number().int().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            return withDbConflict(
                () => ctx.services.currency.update(id, data),
                'Валюта с таким названием уже существует',
            );
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.currency.delete(input.id);
    }),
});
