import { z } from 'zod';
import { Prisma } from '@zakupki/database';
import { AppError } from '@zakupki/types';

import { ensureDefaultUnitId } from '../domain/default-unit';
import { adminProcedure, protectedProcedure, router } from '../trpc';

export interface ProductCreateInput {
    name: string;
    articleNumber?: string | null;
    brandId?: number | null;
    unitId?: number;
    pricePerUnit?: number;
    description?: string;
    attributeIds?: number[];
    characteristics?: { characteristicId: number; value: string }[];
    minPackageAmount?: number;
    minPackageUnit?: string;
    priceTiers?: { amount: number; unit: string; price: number }[];
    supplierPackageAmount?: number;
    supplierPackageUnit?: string;
    supplierPackagePrice?: number;
    availableAmount?: number;
    availableUnit?: string;
}

export interface ProductUpdateInput {
    id: number;
    name?: string;
    articleNumber?: string | null;
    brandId?: number | null;
    unitId?: number;
    pricePerUnit?: number;
    description?: string;
    attributeIds?: number[];
    characteristics?: { characteristicId: number; value: string }[];
    minPackageAmount?: number;
    minPackageUnit?: string;
    priceTiers?: { amount: number; unit: string; price: number }[];
    supplierPackageAmount?: number;
    supplierPackageUnit?: string;
    supplierPackagePrice?: number;
    availableAmount?: number;
    availableUnit?: string;
}

const priceTierSchema = z.object({
    amount: z.number(),
    unit: z.string(),
    price: z.number(),
});

const productCreateInput: z.ZodType<ProductCreateInput> = z.object({
    name: z.string().min(1),
    articleNumber: z.string().optional(),
    brandId: z.number().nullable().optional(),
    unitId: z.number().optional(),
    pricePerUnit: z.number().optional(),
    description: z.string().optional(),
    attributeIds: z.array(z.number()).optional(),
    characteristics: z
        .array(z.object({ characteristicId: z.number(), value: z.string() }))
        .optional(),
    minPackageAmount: z.number().optional(),
    minPackageUnit: z.string().optional(),
    priceTiers: z.array(priceTierSchema).optional(),
    supplierPackageAmount: z.number().optional(),
    supplierPackageUnit: z.string().optional(),
    supplierPackagePrice: z.number().optional(),
    availableAmount: z.number().optional(),
    availableUnit: z.string().optional(),
});

const productUpdateInput: z.ZodType<ProductUpdateInput> = z.object({
    id: z.number(),
    name: z.string().optional(),
    articleNumber: z.string().nullable().optional(),
    brandId: z.number().nullable().optional(),
    unitId: z.number().optional(),
    pricePerUnit: z.number().optional(),
    description: z.string().optional(),
    attributeIds: z.array(z.number()).optional(),
    characteristics: z
        .array(z.object({ characteristicId: z.number(), value: z.string() }))
        .optional(),
    minPackageAmount: z.number().optional(),
    minPackageUnit: z.string().optional(),
    priceTiers: z.array(priceTierSchema).optional(),
    supplierPackageAmount: z.number().optional(),
    supplierPackageUnit: z.string().optional(),
    supplierPackagePrice: z.number().optional(),
    availableAmount: z.number().optional(),
    availableUnit: z.string().optional(),
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
        const unitId = input.unitId ?? (await ensureDefaultUnitId(ctx.db));
        return ctx.services.product.create({ ...input, unitId, pricePerUnit: input.pricePerUnit ?? 0 });
    }),

    update: adminProcedure.input(productUpdateInput).mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.services.product.update(id, data);
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
