import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, type PrismaClient } from '@zakupki/database';

import { CharacteristicRepository } from '../domain/characteristic.repository';
import { CharacteristicService } from '../services/characteristic.service';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { characteristics: new CharacteristicService(new CharacteristicRepository(db)) };
}

export const characteristicsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        const { characteristics } = services(ctx.db);
        return characteristics.list();
    }),

    create: adminProcedure
        .input(z.object({ name: z.string().trim().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const { characteristics } = services(ctx.db);
            try {
                return await characteristics.create(input);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Такая характеристика уже есть' });
                }
                throw err;
            }
        }),

    update: adminProcedure
        .input(z.object({ id: z.number(), name: z.string().trim().min(1).optional() }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { characteristics } = services(ctx.db);
            try {
                return await characteristics.update(id, data);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    throw new TRPCError({ code: 'CONFLICT', message: 'Такая характеристика уже есть' });
                }
                throw err;
            }
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { characteristics } = services(ctx.db);
        return characteristics.delete(input.id);
    }),
});
