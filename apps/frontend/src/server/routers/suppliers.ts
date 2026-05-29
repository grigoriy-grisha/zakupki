import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, type PrismaClient } from '@zakupki/database';

import { SupplierRepository } from '../domain/supplier.repository';
import { SupplierService } from '../services/supplier.service';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { suppliers: new SupplierService(new SupplierRepository(db)) };
}

export const suppliersRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        const { suppliers } = services(ctx.db);
        return suppliers.list();
    }),

    create: adminProcedure
        .input(z.object({ name: z.string().trim().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const { suppliers } = services(ctx.db);
            try {
                return await suppliers.create(input);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Такой поставщик уже есть' });
                }
                throw err;
            }
        }),

    update: adminProcedure
        .input(z.object({ id: z.number(), name: z.string().trim().min(1).optional() }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { suppliers } = services(ctx.db);
            try {
                return await suppliers.update(id, data);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Такой поставщик уже есть' });
                }
                throw err;
            }
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { suppliers } = services(ctx.db);
        return suppliers.delete(input.id);
    }),
});

