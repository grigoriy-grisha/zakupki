import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { ProductRepository } from '../domain/product.repository';
import { ProductService } from '../services/product.service';
import { Prisma, type PrismaClient } from '@zakupki/database';
import { adminProcedure, publicProcedure, router } from '../trpc';

export interface ProductCreateInput {
    name: string;
    unitId: number;
    pricePerUnit: number;
    description?: string;
    categoryId?: number;
    minPackageAmount?: number;
    minPackageUnit?: string;
    priceTiers?: { amount: number; unit: string; price: number }[];
    supplierPackageAmount?: number;
    supplierPackageUnit?: string;
    supplierPackagePrice?: number;
    availableAmount?: number;
    availableUnit?: string;
}

export interface ProductUpdateInput extends Partial<Omit<ProductCreateInput, 'name' | 'unitId' | 'pricePerUnit'>> {
    id: number;
    name?: string;
    unitId?: number;
    pricePerUnit?: number;
}

const priceTierSchema = z.object({
    amount: z.number(),
    unit: z.string(),
    price: z.number(),
});

const productCreateInput: z.ZodType<ProductCreateInput> = z.object({
    name: z.string().min(1),
    unitId: z.number(),
    pricePerUnit: z.number(),
    description: z.string().optional(),
    categoryId: z.number().optional(),
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
    unitId: z.number().optional(),
    pricePerUnit: z.number().optional(),
    description: z.string().optional(),
    categoryId: z.number().optional(),
    minPackageAmount: z.number().optional(),
    minPackageUnit: z.string().optional(),
    priceTiers: z.array(priceTierSchema).optional(),
    supplierPackageAmount: z.number().optional(),
    supplierPackageUnit: z.string().optional(),
    supplierPackagePrice: z.number().optional(),
    availableAmount: z.number().optional(),
    availableUnit: z.string().optional(),
});

function services(db: PrismaClient) {
    return { product: new ProductService(new ProductRepository(db)) };
}

export const productsRouter = router({
    list: publicProcedure
        .input(z.object({ search: z.string().optional(), categoryId: z.number().nullable().optional() }).optional())
        .query(async ({ ctx, input }) => {
            const { product } = services(ctx.db);
            return product.list(input?.search, input?.categoryId);
        }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        const { product } = services(ctx.db);
        return product.getById(input.id);
    }),

    create: adminProcedure.input(productCreateInput).mutation(async ({ ctx, input }) => {
        const { product } = services(ctx.db);
        return product.create(input);
    }),

    update: adminProcedure.input(productUpdateInput).mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const { product } = services(ctx.db);
        return product.update(id, data);
    }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { product } = services(ctx.db);
        try {
            return await product.delete(input.id);
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });
            }
            throw err;
        }
    }),

    deletePhoto: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { product } = services(ctx.db);
        return product.deletePhoto(input.id);
    }),
});
