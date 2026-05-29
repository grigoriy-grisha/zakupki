import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, type PrismaClient } from '@zakupki/database';

import { AttributeTypeRepository } from '../domain/attribute-type.repository';
import { AttributeTypeService } from '../services/attribute-type.service';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { types: new AttributeTypeService(new AttributeTypeRepository(db)) };
}

export const attributeTypesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        const { types } = services(ctx.db);
        return types.list();
    }),

    create: adminProcedure
        .input(
            z.object({
                name: z.string().trim().min(1),
                parentId: z.number().nullable().optional(),
                showInTree: z.boolean().optional(),
                showInTitle: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { types } = services(ctx.db);
            try {
                return await types.create(input);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Тип с таким названием уже есть' });
                }
                throw err;
            }
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                showInTree: z.boolean().optional(),
                showInTitle: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { types } = services(ctx.db);
            try {
                return await types.update(id, data);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Тип с таким названием уже есть' });
                }
                throw err;
            }
        }),

    move: adminProcedure
        .input(z.object({ id: z.number(), direction: z.enum(['up', 'down']) }))
        .mutation(async ({ ctx, input }) => {
            const { types } = services(ctx.db);
            await types.move(input.id, input.direction);
            return { ok: true };
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { types } = services(ctx.db);
        return types.delete(input.id);
    }),
});
