import { z } from 'zod';

import { UnitRepository } from '../domain/unit.repository';
import { UnitService } from '../services/unit.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, publicProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { unit: new UnitService(new UnitRepository(db)) };
}

export const unitsRouter = router({
    list: publicProcedure.query(async ({ ctx }) => {
        const { unit } = services(ctx.db);
        return unit.list();
    }),

    create: adminProcedure
        .input(
            z.object({
                name: z.string().min(1, 'Название обязательно'),
                shortName: z.string().min(1, 'Краткое название обязательно'),
                multiplicity: z.number().positive('Кратность должна быть положительной'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { unit } = services(ctx.db);
            return unit.create(input);
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().optional(),
                shortName: z.string().optional(),
                multiplicity: z.number().positive().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { unit } = services(ctx.db);
            return unit.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { unit } = services(ctx.db);
        return unit.delete(input.id);
    }),
});
