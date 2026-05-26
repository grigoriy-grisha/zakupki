import { TRPCError } from '@trpc/server';

import { z } from 'zod';



import { createPurchaseServices } from '../lib/create-purchase-services';

import { adminProcedure, publicProcedure, router } from '../trpc';



export const purchasesRouter = router({

    list: publicProcedure

        .input(

            z.object({

                status: z.string().optional(),

                statuses: z.array(z.string()).optional(),

            }).optional(),

        )

        .query(async ({ ctx, input }) => {

            const { purchase } = createPurchaseServices(ctx.db);

            if (input?.statuses?.length) {

                return purchase.listByStatuses(input.statuses);

            }

            return purchase.list(input?.status);

        }),



    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {

        const { purchase } = createPurchaseServices(ctx.db);

        return purchase.getById(input.id);

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

            const { purchase } = createPurchaseServices(ctx.db);

            return purchase.create(input);

        }),



    updateStatus: adminProcedure

        .input(z.object({ id: z.number(), status: z.enum(['DRAFT', 'ACTIVE', 'SUPPLEMENT', 'CLOSED', 'ARRIVED', 'DONE']) }))

        .mutation(async ({ ctx, input }) => {

            const { purchase } = createPurchaseServices(ctx.db);

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

            const { purchase } = createPurchaseServices(ctx.db);

            return purchase.setAvailableQuantities(input.purchaseId, input.items);

        }),



    addItems: adminProcedure

        .input(z.object({

            purchaseId: z.number(),

            productIds: z.array(z.number()).min(1, 'Выберите хотя бы один товар'),

            publishToTg: z.boolean().optional(),

        }))

        .mutation(async ({ ctx, input }) => {

            const { purchase, telegramPublish } = createPurchaseServices(ctx.db);

            const { items, skippedCount } = await purchase.addItems(input.purchaseId, input.productIds);



            if (items.length === 0) {

                throw new TRPCError({

                    code: 'CONFLICT',

                    message: 'Выбранные товары уже добавлены в эту закупку',

                });

            }



            const tgPublish = await telegramPublish.enqueueAfterAddItems(

                input.publishToTg,

                items.map((i) => i.id),

            );



            return { items, skippedCount, tgPublish };

        }),



    publishItemToTg: adminProcedure

        .input(z.object({ purchaseItemId: z.number() }))

        .mutation(async ({ ctx, input }) => {

            const item = await ctx.db.purchaseItem.findUnique({

                where: { id: input.purchaseItemId },

                select: { id: true },

            });



            if (!item) {

                throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });

            }

            const { telegramPublish } = createPurchaseServices(ctx.db);

            return telegramPublish.publishPurchaseItem(input.purchaseItemId);

        }),



    removeItem: adminProcedure.input(z.object({ purchaseItemId: z.number() })).mutation(async ({ ctx, input }) => {

        const { purchase } = createPurchaseServices(ctx.db);

        return purchase.removeItem(input.purchaseItemId);

    }),

});


