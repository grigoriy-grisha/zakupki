import { TRPCError } from '@trpc/server';
import { z } from 'zod';

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
            if (input?.statuses?.length) {
                return ctx.services.purchase.listByStatuses(input.statuses);
            }
            return ctx.services.purchase.list(input?.status);
        }),

    listMyCompleted: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.purchase.listByStatusesForUser(ctx.userId, ['DONE']);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.purchase.getById(input.id);
    }),

    create: adminProcedure
        .input(
            z.object({
                tag: z.string().min(1),
                supplier: z.string().min(1),
                minAmount: z.number().positive(),
                deadline: z.string().transform((v) => new Date(v)),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.create(input);
        }),

    updateStatus: adminProcedure
        .input(
            z.object({
                id: z.number(),
                status: z.enum(['DRAFT', 'ACTIVE', 'SUPPLEMENT', 'CLOSED', 'ARRIVED', 'DONE']),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.updateStatus(input.id, input.status);
        }),

    updateFulfillmentStatus: adminProcedure
        .input(
            z.object({
                id: z.number(),
                fulfillmentStatus: purchaseFulfillmentStatusSchema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.updateFulfillmentStatus(input.id, input.fulfillmentStatus);
        }),

    activate: adminProcedure.input(z.object({ purchaseId: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchase.activate(input.purchaseId);
    }),

    publishToTelegram: adminProcedure.input(z.object({ purchaseId: z.number() })).mutation(async ({ ctx, input }) => {
        const unpublishedItems = await ctx.services.purchase.findItemsToPublish(input.purchaseId);
        const queued = await ctx.services.telegramPublish.enqueuePurchaseItems(unpublishedItems.map((i) => i.id));
        return { queued };
    }),

    complete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchase.complete(input.id);
    }),

    deleteDraft: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.purchase.deleteDraft(input.id);
    }),

    toggleShouldPublish: adminProcedure
        .input(z.object({ purchaseItemId: z.number(), value: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.purchase.setPublicationState(input.purchaseItemId, input.value ? 'PUBLISHED' : 'DRAFT');
        }),

    setAvailableQuantities: adminProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                items: z.array(
                    z.object({
                        purchaseItemId: z.number(),
                        targetRemainder: z.number().nullable(),
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
                productIds: z.array(z.number()).min(1, 'Выберите хотя бы один товар'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { items, skippedCount } = await ctx.services.purchase.addItems(
                input.purchaseId,
                input.productIds,
            );

            if (items.length === 0) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'Выбранные товары уже добавлены в эту закупку',
                });
            }

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
                product: z.object({
                    name: z.string().min(1).optional(),
                    description: z.string().optional(),
                    pricePerUnit: z.number().optional(),
                    minPackageAmount: z.number().nullable().optional(),
                    minPackageUnit: z.string().nullable().optional(),
                    priceTiers: z
                        .array(
                            z.object({
                                amount: z.number().positive('Укажите количество'),
                                unit: z.string().min(1, 'Выберите ед.'),
                                price: z.number().positive('Укажите цену больше 0'),
                            }),
                        )
                        .min(1, 'Укажите хотя бы одну цену')
                        .optional(),
                    supplierPackageAmount: z.number().nullable().optional(),
                    supplierPackageUnit: z.string().nullable().optional(),
                    supplierPackagePrice: z.number().nullable().optional(),
                    supplierPackageTiers: z
                        .array(
                            z.object({
                                amount: z.number().positive(),
                                unit: z.string().min(1),
                                price: z.number().nonnegative(),
                            }),
                        )
                        .optional(),
                    referenceStock: z.number().nullable().optional(),
                    referenceStockUnit: z.string().nullable().optional(),
                }),
                priceOverride: z.number().nullable().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const item = await ctx.services.purchase.updateItemProduct(input.purchaseItemId, input.product, input.priceOverride ?? null);

            if (item.tgMessageId) {
                await ctx.services.telegramPublish.enqueueEditPurchaseItem(input.purchaseItemId);
            }

            return { ok: true };
        }),
});
