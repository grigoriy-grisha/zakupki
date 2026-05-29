import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@zakupki/database';

import { ProductAttributeRepository } from '../domain/product-attribute.repository';
import { ProductAttributeService } from '../services/product-attribute.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { attr: new ProductAttributeService(new ProductAttributeRepository(db)) };
}

export const productAttributesRouter = router({
    list: protectedProcedure
        .input(z.object({ typeId: z.number().optional() }).optional())
        .query(async ({ ctx, input }) => {
            const { attr } = services(ctx.db);
            return attr.list(input?.typeId);
        }),

    create: adminProcedure
        .input(
            z.object({
                typeId: z.number(),
                name: z.string().trim().min(1),
                characteristicIds: z.array(z.number()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { attr } = services(ctx.db);
            try {
                return await attr.create(input);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'Такое значение уже есть в справочнике',
                    });
                }
                throw err;
            }
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                characteristicIds: z.array(z.number()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { attr } = services(ctx.db);
            return attr.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { attr } = services(ctx.db);
        return attr.delete(input.id);
    }),
});
