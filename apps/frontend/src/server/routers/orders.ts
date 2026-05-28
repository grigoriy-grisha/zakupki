import { z } from 'zod';
import type { PrismaClient } from '@zakupki/database';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import { OrderService } from '../services/order.service';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { order: new OrderService(new OrderRepository(db), new PurchaseRepository(db)) };
}

export const ordersRouter = router({
    upsertOrder: protectedProcedure
        .input(z.object({ purchaseItemId: z.number(), quantity: z.number().positive() }))
        .mutation(async ({ ctx, input }) => {
            const { order } = services(ctx.db);
            return order.upsertOrder(input.purchaseItemId, ctx.userId, input.quantity);
        }),

    getMyOrders: protectedProcedure.query(async ({ ctx }) => {
        const { order } = services(ctx.db);
        return order.getByUser(ctx.userId);
    }),

    getByUser: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ ctx, input }) => {
        const { order } = services(ctx.db);
        return order.getByUser(input.userId);
    }),

    getAllByPurchase: adminProcedure.input(z.object({ purchaseId: z.number() })).query(async ({ ctx, input }) => {
        const { order } = services(ctx.db);
        return order.getByPurchase(input.purchaseId);
    }),

    deleteOrder: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { order } = services(ctx.db);
        return order.deleteAndRestoreStock(input.id);
    }),
});
