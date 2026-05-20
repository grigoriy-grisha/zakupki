import { z } from 'zod';

import { PurchaseRepository } from '../domain/purchase.repository';
import { PurchaseService } from '../services/purchase.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, publicProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { purchase: new PurchaseService(new PurchaseRepository(db)) };
}

export const purchasesRouter = router({
    list: publicProcedure
        .input(
            z.object({
                status: z.string().optional(),
                statuses: z.array(z.string()).optional(),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            if (input?.statuses?.length) {
                return purchase.listByStatuses(input.statuses);
            }
            return purchase.list(input?.status);
        }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        const { purchase } = services(ctx.db);
        return purchase.getById(input.id);
    }),

    create: adminProcedure
        .input(
            z.object({
                tag: z.string().min(1),
                title: z.string().min(1),
                minAmount: z.number().positive(),
                deadline: z.string().transform((v) => new Date(v)),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.create(input);
        }),

    updateStatus: adminProcedure
        .input(z.object({ id: z.number(), status: z.enum(['DRAFT', 'ACTIVE', 'SUPPLEMENT', 'CLOSED', 'ARRIVED', 'DONE']) }))
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.updateStatus(input.id, input.status);
        }),

    setAvailableQuantities: adminProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                items: z.array(z.object({
                    purchaseItemId: z.number(),
                    availableQty: z.number().nullable(),
                })),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.setAvailableQuantities(input.purchaseId, input.items);
        }),

    addItems: adminProcedure
        .input(z.object({ purchaseId: z.number(), productIds: z.array(z.number()) }))
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.addItems(input.purchaseId, input.productIds);
        }),

    removeItem: adminProcedure.input(z.object({ purchaseItemId: z.number() })).mutation(async ({ ctx, input }) => {
        const { purchase } = services(ctx.db);
        return purchase.removeItem(input.purchaseItemId);
    }),
});
