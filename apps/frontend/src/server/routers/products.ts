import { z } from 'zod';
import { Prisma } from '@zakupki/database';
import { AppError } from '@zakupki/types';

import { withDbConflict } from '../lib/error-utils';
import { adminProcedure, protectedProcedure, router } from '../trpc';

const priceTierSchema = z.object({
    amount: z.number(),
    unit: z.string(),
    price: z.number(),
});

const productCreateInput = z.object({
    name: z.string().min(1),
    articleNumber: z.string().nullable().optional(),
    brandId: z.number().nullable().optional(),
    unitCode: z.string().optional(),
    multiplicity: z.number().optional(),
    pricePerUnit: z.number().optional(),
    description: z.string().optional(),
    attributeIds: z.array(z.number()).optional(),
    characteristics: z.array(z.object({ characteristicId: z.number(), value: z.string() })).optional(),
    minPackageAmount: z.number().nullable().optional(),
    minPackageUnit: z.string().nullable().optional(),
    priceTiers: z.array(priceTierSchema).nullable().optional(),
    supplierPackageAmount: z.number().nullable().optional(),
    supplierPackageUnit: z.string().nullable().optional(),
    supplierPackagePrice: z.number().nullable().optional(),
    supplierPackageTiers: z.array(priceTierSchema).nullable().optional(),
    supplementStep: z.number().nullable().optional(),
    referenceStock: z.number().nullable().optional(),
    referenceStockUnit: z.string().nullable().optional(),
});

const productUpdateInput = z.object({
    id: z.number(),
    expectedVersion: z.number().optional(),
    name: z.string().optional(),
    articleNumber: z.string().nullable().optional(),
    brandId: z.number().nullable().optional(),
    unitCode: z.string().optional(),
    multiplicity: z.number().optional(),
    pricePerUnit: z.number().optional(),
    description: z.string().optional(),
    attributeIds: z.array(z.number()).optional(),
    characteristics: z.array(z.object({ characteristicId: z.number(), value: z.string() })).optional(),
    minPackageAmount: z.number().nullable().optional(),
    minPackageUnit: z.string().nullable().optional(),
    priceTiers: z.array(priceTierSchema).nullable().optional(),
    supplierPackageAmount: z.number().nullable().optional(),
    supplierPackageUnit: z.string().nullable().optional(),
    supplierPackagePrice: z.number().nullable().optional(),
    supplierPackageTiers: z.array(priceTierSchema).nullable().optional(),
    supplementStep: z.number().nullable().optional(),
    referenceStock: z.number().nullable().optional(),
    referenceStockUnit: z.string().nullable().optional(),
});

export const productsRouter = router({
    list: protectedProcedure
        .input(z.object({ search: z.string().optional() }).optional())
        .query(async ({ ctx, input }) => {
            return ctx.services.product.list(input?.search);
        }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.product.getById(input.id);
    }),

    create: adminProcedure.input(productCreateInput).mutation(async ({ ctx, input }) => {
        return withDbConflict(() =>
            ctx.services.product.create({
                ...input,
                unitCode: input.unitCode ?? 'piece',
                multiplicity: input.multiplicity ?? 1,
                pricePerUnit: input.pricePerUnit ?? 0,
            }),
        );
    }),

    update: adminProcedure.input(productUpdateInput).mutation(async ({ ctx, input }) => {
        const { id, expectedVersion, ...data } = input;
        if (expectedVersion != null) {
            const updated = await ctx.services.product.updateWithVersionCheck(id, data, expectedVersion);
            if (!updated) {
                throw new AppError(
                    'CONFLICT',
                    'Товар был изменён другим пользователем. Обновите страницу и попробуйте снова.',
                );
            }
            return updated;
        }
        return withDbConflict(() => ctx.services.product.update(id, data));
    }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        try {
            return await ctx.services.product.delete(input.id);
        } catch (err) {
            if (err instanceof AppError) throw err;
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new AppError('NOT_FOUND', 'Товар не найден');
            }
            throw err;
        }
    }),

    deletePhoto: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.product.deletePhoto(input.id);
    }),
});
