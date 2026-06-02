import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const ordersRouter = router({
    upsertOrder: protectedProcedure
        .input(z.object({ purchaseItemId: z.number(), quantity: z.number().positive() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.upsertOrder(input.purchaseItemId, ctx.userId, input.quantity);
        }),

    getMyOrders: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.order.getByUser(ctx.userId);
    }),

    getByUser: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.order.getByUser(input.userId);
    }),

    getAllByPurchase: adminProcedure.input(z.object({ purchaseId: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.order.getByPurchase(input.purchaseId);
    }),

    deleteOrder: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.order.deleteAndRestoreStock(input.id, ctx.userId, { throwIfNotFound: true });
    }),

    removeAllByUserFromPurchase: adminProcedure
        .input(z.object({ userId: z.number(), purchaseId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.removeAllByUserFromPurchase(input.userId, input.purchaseId);
        }),
});
