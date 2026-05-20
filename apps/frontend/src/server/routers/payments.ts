import { z } from 'zod';

import { PaymentRepository } from '../domain/payment.repository';
import { PromoCodeRepository } from '../domain/promo-code.repository';
import { PaymentService } from '../services/payment.service';
import { PromoCodeService } from '../services/promo-code.service';
import { adminProcedure, publicProcedure, router } from '../trpc';
import type { PrismaClient } from '@zakupki/database';
import { getDemoUser } from '../lib/get-demo-user';

function services(db: PrismaClient) {
    return {
        payment: new PaymentService(new PaymentRepository(db)),
        promoCode: new PromoCodeService(new PromoCodeRepository(db)),
    };
}

export const paymentsRouter = router({
    submit: publicProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                amount: z.number().positive(),
                userComment: z.string().optional(),
                proofBase64: z.string().optional(),
                proofMimeType: z.string().optional(),
                promoCode: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const demoUser = await getDemoUser(ctx.db);

            const proofData = input.proofBase64 ? Buffer.from(input.proofBase64, 'base64') : undefined;

            let promoCodeId: number | undefined;
            let discountAmount: number | undefined;
            let finalAmount = input.amount;

            if (input.promoCode) {
                const { promoCode } = services(ctx.db);
                const promo = await promoCode.validate(input.promoCode.toUpperCase().trim(), input.purchaseId, input.amount);
                promoCodeId = promo.id;
                discountAmount = promo.discount;
                finalAmount = promo.finalAmount;
            }

            const { payment } = services(ctx.db);
            return payment.submitPayment({
                userId: demoUser.id,
                purchaseId: input.purchaseId,
                amount: finalAmount,
                userComment: input.userComment,
                proofData,
                proofMimeType: input.proofMimeType,
                promoCodeId,
                discountAmount,
            });
        }),

    getMyPayments: publicProcedure.query(async ({ ctx }) => {
        const demoUser = await getDemoUser(ctx.db);
        const { payment } = services(ctx.db);
        return payment.getByUser(demoUser.id);
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
            const { payment } = services(ctx.db);
            return payment.create(input);
        }),

    getByPurchase: adminProcedure.input(z.object({ purchaseId: z.number() })).query(async ({ ctx, input }) => {
        const { payment } = services(ctx.db);
        return payment.getByPurchase(input.purchaseId);
    }),

    update: publicProcedure
        .input(z.object({
            id: z.number(),
            amount: z.number().positive().optional(),
            userComment: z.string().optional(),
            proofBase64: z.string().optional(),
            proofMimeType: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const proofData = input.proofBase64 ? Buffer.from(input.proofBase64, 'base64') : undefined;
            const { payment } = services(ctx.db);
            return payment.updatePayment(input.id, {
                amount: input.amount,
                userComment: input.userComment,
                proofData,
                proofMimeType: input.proofMimeType,
            });
        }),

    cancel: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const { payment } = services(ctx.db);
            return payment.cancel(input.id);
        }),

    confirm: adminProcedure
        .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const { payment } = services(ctx.db);
            return payment.confirm(input.id, input.adminNote);
        }),

    reject: adminProcedure
        .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const { payment } = services(ctx.db);
            return payment.reject(input.id, input.adminNote);
        }),
});
