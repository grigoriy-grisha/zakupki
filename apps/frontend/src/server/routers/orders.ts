import { z } from 'zod';

import { OrderRepository } from '../domain/order.repository';
import { OrderService } from '../services/order.service';
import { adminProcedure, protectedProcedure, router } from '../trpc';
import type { PrismaClient } from '@zakupki/database';

function services(db: PrismaClient) {
    return { order: new OrderService(new OrderRepository(db)) };
}

export const ordersRouter = router({
    upsertOrder: protectedProcedure
        .input(z.object({ purchaseItemId: z.number(), quantity: z.number().positive() }))
        .mutation(async ({ ctx, input }) => {
            const purchaseItem = await ctx.db.purchaseItem.findUnique({
                where: { id: input.purchaseItemId },
                include: { product: true, purchase: true },
            });

            if (!purchaseItem) throw new Error('Purchase item not found');

            const status = purchaseItem.purchase.status as string;
            if (status !== 'ACTIVE' && status !== 'SUPPLEMENT') {
                throw new Error('Закупка неактивна, заказы не принимаются');
            }

            const price = Number(purchaseItem.priceOverride ?? purchaseItem.product.pricePerUnit);
            const { order } = services(ctx.db);
            return order.upsertWithStock(input.purchaseItemId, ctx.userId, input.quantity, price);
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

    deleteOrder: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const { order } = services(ctx.db);
            return order.deleteAndRestoreStock(input.id);
        }),
});
