import { isPurchasePaymentOpen, ValidationError } from '@zakupki/types';
import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const paymentsRouter = router({
    /** Настройки онлайн-оплаты для окна оплаты: комиссии, нужен ли чек, сохранённый контакт. */
    onlineConfig: protectedProcedure.query(async ({ ctx }) => {
        const [config, receiptContact] = await Promise.all([
            ctx.services.onlinePayment.getConfig(),
            ctx.services.onlinePayment.getSavedReceiptContact(ctx.userId),
        ]);
        return { ...config, receiptContact };
    }),

    /** Создаёт онлайн-платёж в Т-Банке и возвращает ссылку на оплату. */
    createOnline: protectedProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                amount: z.number().positive(),
                method: z.enum(['TBANK_CARD', 'TBANK_SBP']),
                promoCode: z.string().optional(),
                receiptContact: z.string().max(100).optional(),
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

            return ctx.services.onlinePayment.create({
                userId: ctx.userId,
                purchaseId: input.purchaseId,
                amount: input.amount,
                method: input.method,
                promoCode: input.promoCode,
                receiptContact: input.receiptContact,
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

    syncOnline: protectedProcedure.mutation(async ({ ctx }) => {
        const result = await ctx.services.onlinePayment.syncForUser(ctx.userId);
        return { changed: result.confirmed + result.rejected };
    }),

    cancel: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        return ctx.services.payment.cancel(input.id, ctx.userId);
    }),

    confirm: adminProcedure
        .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.payment.confirm(input.id, input.adminNote);
        }),

    /** Возврат денег клиенту по онлайн-оплате: вся сумма или часть. */
    refund: adminProcedure
        .input(
            z.object({
                id: z.number(),
                amount: z.number().positive(),
                reason: z.string().max(200).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.services.onlinePayment.refund({
                paymentId: input.id,
                amount: input.amount,
                reason: input.reason,
            });
        }),

    reject: adminProcedure
        .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.services.payment.reject(input.id, input.adminNote);
        }),
});
