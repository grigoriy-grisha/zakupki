import { z } from 'zod';

import { OrderRepository } from '../domain/order.repository';
import { OrderService } from '../services/order.service';
import { adminProcedure, publicProcedure, router } from '../trpc';
import type { PrismaClient } from '@zakupki/database';
import { getDemoUser } from '../lib/get-demo-user';

function services(db: PrismaClient) {
    return { order: new OrderService(new OrderRepository(db)) };
}

export const ordersRouter = router({
    upsertOrder: publicProcedure
        .input(z.object({ purchaseItemId: z.number(), quantity: z.number().positive() }))
        .mutation(async ({ ctx, input }) => {
            const demoUser = await getDemoUser(ctx.db);

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
            return order.upsertWithStock(input.purchaseItemId, demoUser.id, input.quantity, price);
        }),

    getMyOrders: publicProcedure
        .input(z.object({ _userId: z.number().optional() }).optional())
        .query(async ({ ctx, input }) => {
            let userId = input?._userId;
            if (!userId) {
                const demoUser = await getDemoUser(ctx.db);
                userId = demoUser.id;
            }
            const { order } = services(ctx.db);
            return order.getByUser(userId);
        }),

    getAllByPurchase: adminProcedure.input(z.object({ purchaseId: z.number() })).query(async ({ ctx, input }) => {
        const { order } = services(ctx.db);
        return order.getByPurchase(input.purchaseId);
    }),

    deleteOrder: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const { order } = services(ctx.db);
            return order.deleteAndRestoreStock(input.id);
        }),
});
