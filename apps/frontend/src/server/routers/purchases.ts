import { z } from 'zod';

import { RoleKind } from '@zakupki/database';

import { adminProcedure, protectedProcedure, router } from '../trpc';

const purchaseFulfillmentStatusSchema = z.enum([
    'COLLECTION',
    'REORDER',
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP',
]);

// Переиспользуемая схема per-purchase полей. Вынесена на верхний уровень, чтобы
// tRPC мог корректно вывести типы (вложенные z.object-ы ломают рекурсивный инферент).
const purchaseItemFieldsSchema = z.object({
    supplierId: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    minPackageAmount: z.number().nullable().optional(),
    minPackageUnit: z.string().nullable().optional(),
    supplementStep: z.number().nullable().optional(),
    // Лимит поставщика + targetRemainder редактируются через отдельные мутации,
    // но updateItemProduct тоже их принимает (для удобства из ItemEditSheet).
    supplierLimit: z.number().nullable().optional(),
    supplierLimitUnit: z.string().nullable().optional(),
    targetRemainder: z.number().nullable().optional(),
    // Новая модель цен (валюта + курс + оргсбор):
    packAmount: z.number().nullable().optional(),
    packUnit: z.string().nullable().optional(),
    currencyId: z.number().nullable().optional(),
    pricePerPackCurrency: z.number().nullable().optional(),
    orgFeePercentOverride: z.number().min(0).max(100).nullable().optional(),
    // Операционные количества (заполняет организатор):
    orderedQty: z.number().nullable().optional(),
    assembledQty: z.number().nullable().optional(),
    reorderedQty: z.number().nullable().optional(),
    // Комментарий организатора + скрытие товара:
    adminComment: z.string().max(2000).nullable().optional(),
    hidden: z.boolean().optional(),
});

const addItemInputSchema = z.object({
    productId: z.number(),
}).merge(purchaseItemFieldsSchema);

export const purchasesRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    status: z.string().optional(),
                    statuses: z.array(z.string()).optional(),
                })
                .optional(),
        )
        .query(async ({ ctx, input }) => {
            const includeHidden = ctx.role === RoleKind.ADMIN;
            if (input?.statuses?.length) {
                return ctx.services.purchase.listByStatuses(input.statuses, includeHidden);
            }
            return ctx.services.purchase.list(input?.status, includeHidden);
        }),

    listMyCompleted: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.purchase.listByStatusesForUser(ctx.userId, ['DONE'], false);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        const includeHidden = ctx.role === RoleKind.ADMIN;
        return ctx.services.purchase.getById(input.id, includeHidden);
    }),

    create: adminProcedure
        .input(
            z.object({
                tag: z.string().min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.create(input);
        }),

    updateStatus: adminProcedure
        .input(
            z.object({
                id: z.number(),
                status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED', 'ARRIVED', 'DONE']),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchaseStatus.updateStatus(input.id, input.status);
        }),

    updateFulfillmentStatus: adminProcedure
        .input(
            z.object({
                id: z.number(),
                fulfillmentStatus: purchaseFulfillmentStatusSchema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchaseStatus.updateFulfillmentStatus(input.id, input.fulfillmentStatus);
        }),

    activate: adminProcedure.input(z.object({ purchaseId: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchaseStatus.activate(input.purchaseId);
    }),

    publishToTelegram: adminProcedure
        .input(z.object({ purchaseId: z.number(), purchaseItemIds: z.array(z.number()).min(1) }))
        .mutation(async ({ ctx, input }) => {
            const queued = await ctx.services.telegramPublish.enqueuePurchaseItems(input.purchaseItemIds);
            return { queued };
        }),

    complete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchaseStatus.complete(input.id);
    }),

    deleteDraft: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchase.deleteDraft(input.id);
    }),

    setAvailableQuantities: adminProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                items: z.array(
                    z.object({
                        purchaseItemId: z.number(),
                        targetRemainder: z.number().nullable(),
                        supplementStep: z.number().nullable().optional(),
                    }),
                ),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.setAvailableQuantities(input.purchaseId, input.items);
        }),

    addItems: adminProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                items: z.array(addItemInputSchema).min(1, 'Выберите хотя бы один товар'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { items, skippedCount } = await ctx.services.purchase.addItems(input.purchaseId, input.items);

            const tgPublish = await ctx.services.telegramPublish.enqueueAfterAddItems(
                false,
                items.map((i) => i.id),
            );

            return { items, skippedCount, tgPublish };
        }),

    publishItemToTg: adminProcedure.input(z.object({ purchaseItemId: z.number() })).mutation(async ({ ctx, input }) => {
        await ctx.services.purchase.ensureCanPublishItem(input.purchaseItemId);
        return ctx.services.telegramPublish.publishPurchaseItem(input.purchaseItemId);
    }),

    removeItem: adminProcedure.input(z.object({ purchaseItemId: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchase.removeItem(input.purchaseItemId);
    }),

    updateItemProduct: adminProcedure
        .input(
            z.object({
                purchaseItemId: z.number(),
                product: purchaseItemFieldsSchema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.services.purchase.updateItemProduct(input.purchaseItemId, input.product);
            // Edit поста в канале обрабатывается шиной channel-post-events —
            // PurchaseService.updateItemProduct уже вызывает eventBus.emitPurchaseItemChanged.
            return { ok: true };
        }),

    /**
     * Admin: установить/очистить комментарий к участнику закупки (PurchaseOrder).
     * Пустая строка (или только пробелы) → удаление комментария.
     * commentAt ставится автоматически на уровне репозитория.
     */
    setOrderComment: adminProcedure
        .input(z.object({ id: z.number(), comment: z.string().max(2000) }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.setOrderComment(input.id, input.comment, ctx.userId);
        }),

    /**
     * Admin: установить ставки валют закупки (до 3 валют).
     * Полная замена: переданный массив перезаписывает существующие ставки.
     */
    updateCurrencyRates: adminProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                rates: z
                    .array(
                        z.object({
                            currencyId: z.number(),
                            rateToRub: z.number().positive('Курс должен быть больше 0'),
                        }),
                    )
                    .max(3, 'Не более 3 валют на закупку'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.setCurrencyRates(input.purchaseId, input.rates);
        }),
});
