import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const ordersRouter = router({
    /**
     * Изменить количество на delta (±мин.фасовка).
     * Положительный delta = добавить, отрицательный = убрать.
     * При result <= 0 заказ удаляется.
     */
    adjustQuantity: protectedProcedure
        .input(
            z.object({
                purchaseItemId: z.number(),
                delta: z
                    .number()
                    .int()
                    .refine((d) => d !== 0),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.adjustQuantity(input.purchaseItemId, ctx.userId, input.delta);
        }),

    /**
     * Добавить/убрать упаковку поставщика (delta = +1 или -1).
     * Упаковка = целая нераспечатанная пачка.
     */
    adjustPackageCount: protectedProcedure
        .input(z.object({ purchaseItemId: z.number(), delta: z.number().int().min(-1).max(1) }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.adjustPackageCount(input.purchaseItemId, ctx.userId, input.delta);
        }),

    // Получить свои заказы
    getMyOrders: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.order.getUserOrders(ctx.userId);
    }),

    // Получить заказы пользователя (админ)
    getByUser: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.order.getUserOrders(input.userId);
    }),

    // Получить все заказы по закупке (админ)
    getAllByPurchase: adminProcedure.input(z.object({ purchaseId: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.order.getByPurchase(input.purchaseId);
    }),

    // Отменить свой заказ
    cancelOrder: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.order.cancelOrder(input.id, ctx.userId);
    }),

    // Удалить заказ (админ)
    deleteOrder: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.order.delete(input.id);
    }),

    // Удалить все заказы пользователя в закупке (админ)
    removeAllByUserFromPurchase: adminProcedure
        .input(z.object({ purchaseId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.removeAllByUserFromPurchase(input.userId, input.purchaseId);
        }),
});
