import { isPurchasePaymentOpen, ValidationError } from '@zakupki/types';
import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const paymentsRouter = router({
    submit: protectedProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                amount: z.number().positive(),
                userComment: z.string().optional(),
                proofBase64: z.string().min(1, 'Прикрепите чек'),
                proofMimeType: z.string().min(1),
                promoCode: z.string().optional(),
                consentAccepted: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const purchase = await ctx.services.purchase.getById(input.purchaseId);
            if (!isPurchasePaymentOpen(purchase.fulfillmentStatus)) {
                throw new ValidationError('Оплата ещё не открыта. Ждём начала оплаты.');
            }

            const consent = await ctx.services.user.getPersonalDataConsent(ctx.userId);
            if (!consent.accepted) {
                if (input.consentAccepted !== true) {
                    throw new ValidationError('Подтвердите согласие на обработку персональных данных');
                }
                await ctx.services.user.acceptPersonalDataConsent(ctx.userId);
            }

            const proofData = input.proofBase64 ? Buffer.from(input.proofBase64, 'base64') : undefined;

            let promoCodeId: number | undefined;
            let discountAmount: number | undefined;
            let finalAmount = input.amount;

            if (input.promoCode) {
                const promo = await ctx.services.promoCode.validate(
                    input.promoCode.toUpperCase().trim(),
                    input.purchaseId,
                    input.amount,
                );
                promoCodeId = promo.id;
                discountAmount = promo.discount;
                finalAmount = promo.finalAmount;
            }

            return ctx.services.payment.submitPayment({
                userId: ctx.userId,
                purchaseId: input.purchaseId,
                amount: finalAmount,
                userComment: input.userComment,
                proofData,
                proofMimeType: input.proofMimeType,
                promoCodeId,
                discountAmount,
            });
        }),

    getMyPayments: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.payment.getByUser(ctx.userId);
    }),

    addPayment: adminProcedure
        .input(
            z.object({
                userId: z.number(),
                purchaseId: z.number(),
                amount: z.number().positive(),
                note: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.payment.create(input);
        }),

    getByPurchase: adminProcedure.input(z.object({ purchaseId: z.number() })).query(async ({ ctx, input }) => {
        return ctx.services.payment.getByPurchase(input.purchaseId);
    }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                amount: z.number().positive().optional(),
                userComment: z.string().optional(),
                proofBase64: z.string().optional(),
                proofMimeType: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const proofData = input.proofBase64 ? Buffer.from(input.proofBase64, 'base64') : undefined;
            return ctx.services.payment.updatePayment(input.id, ctx.userId, {
                amount: input.amount,
                userComment: input.userComment,
                proofData,
                proofMimeType: input.proofMimeType,
            });
        }),

    cancel: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.payment.cancel(input.id, ctx.userId);
    }),

    confirm: adminProcedure
        .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.payment.confirm(input.id, input.adminNote);
        }),

    reject: adminProcedure
        .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.payment.reject(input.id, input.adminNote);
        }),
});
