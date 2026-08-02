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

    /**
     * Получить все PurchaseOrder-заголовки по закупке (админ).
     * Источник правды для списка участников: покрывает и «голых» участников
     * (PurchaseOrder без строк), и тех, у кого есть заказы.
     */
    getPurchaseOrdersByPurchase: adminProcedure
        .input(z.object({ purchaseId: z.number() }))
        .query(async ({ ctx, input }) => {
            return ctx.services.order.getPurchaseOrdersByPurchase(input.purchaseId);
        }),

    // Отменить свой заказ
    cancelOrder: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.order.cancelOrder(input.id, ctx.userId);
    }),

    // Удалить заказ (админ)
    deleteOrder: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.order.delete(input.id);
    }),

    /**
     * Admin: изменить количество позиции участника на delta (±).
     * Идёт в обход stage-правил/пула/лимита поставщика. amountDue пересчитывается.
     * delta>0 — добавить, delta<0 — убрать. Дробный (кол-ва Decimal(10,3)).
     */
    adminAdjust: adminProcedure
        .input(
            z.object({
                purchaseItemId: z.number(),
                userId: z.number(),
                delta: z.number().refine((d) => d !== 0),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.adminAdjust(input.purchaseItemId, input.userId, input.delta);
        }),

    /**
     * Admin: установить точное количество позиции участника.
     * qty=0 → удаление строки. В обход всех правил.
     */
    adminSetQuantity: adminProcedure
        .input(
            z.object({
                purchaseItemId: z.number(),
                userId: z.number(),
                qty: z.number().min(0),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.adminSetQuantity(input.purchaseItemId, input.userId, input.qty);
        }),

    /**
     * Admin: изменить количество упаковок позиции участника на delta (±1уп).
     * Идёт в обход stage-правил/пула/лимита поставщика. amountDue пересчитывается.
     * delta>0 — добавить упаковку, delta<0 — убрать.
     */
    adminAdjustPackageCount: adminProcedure
        .input(
            z.object({
                purchaseItemId: z.number(),
                userId: z.number(),
                delta: z.number().int().refine((d) => d !== 0),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.adminAdjustPackageCount(
                input.purchaseItemId,
                input.userId,
                input.delta,
            );
        }),

    // Удалить все заказы пользователя в закупке (админ)
    removeAllByUserFromPurchase: adminProcedure
        .input(z.object({ purchaseId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.removeAllByUserFromPurchase(input.userId, input.purchaseId);
        }),

    /**
     * Admin: удалить ВСЕ строки участника на конкретный товар
     * (сбор + добор + упаковки). Для объединённой карточки участника,
     * где несколько OrderLine одного товара показываются как одна позиция.
     */
    deleteAllByUserItem: adminProcedure
        .input(z.object({ purchaseItemId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.deleteAllByUserAndItem(input.purchaseItemId, input.userId);
        }),

    /**
     * Admin: добавить участника в закупку (без позиций). Создаёт PurchaseOrder
     * (идемпотентно). Позиции добавляются позже через adminAdjust.
     */
    addParticipant: adminProcedure
        .input(z.object({ purchaseId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.order.addParticipant(input.userId, input.purchaseId);
        }),
});
