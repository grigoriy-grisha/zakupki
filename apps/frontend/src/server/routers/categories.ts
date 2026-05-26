import { z } from 'zod';

import { CategoryRepository } from '../domain/category.repository';
import { CategoryService } from '../services/category.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, publicProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { category: new CategoryService(new CategoryRepository(db)) };
}

export const categoriesRouter = router({
    tree: publicProcedure.query(async ({ ctx }) => {
        const { category } = services(ctx.db);
        return category.getTree();
    }),

    list: publicProcedure.query(async ({ ctx }) => {
        const { category } = services(ctx.db);
        return category.getAll();
    }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        const { category } = services(ctx.db);
        return category.getById(input.id);
    }),

    create: adminProcedure
        .input(z.object({
            name: z.string().min(1),
            parentId: z.number().nullable().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { category } = services(ctx.db);
            return category.create(input);
        }),

    update: adminProcedure
        .input(z.object({
            id: z.number(),
            name: z.string().min(1).optional(),
            parentId: z.number().nullable().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { category } = services(ctx.db);
            return category.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { category } = services(ctx.db);
        return category.delete(input.id);
    }),
});
