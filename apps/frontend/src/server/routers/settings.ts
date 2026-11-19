import { isSettingKey, type SettingDef, SETTINGS_SCHEMA, ValidationError } from '@zakupki/types';
import { z } from 'zod';

import { TBANK_TAXATIONS, TBANK_VATS, type TbankTaxation, type TbankVat } from '../lib/tbank/types';
import { adminProcedure, protectedProcedure, router } from '../trpc';

const settingKeySchema = z.string().refine(isSettingKey, { message: 'Неизвестный ключ настройки' });

/** Настройки, от которых зависят суммы заказов: после их смены записанные суммы пересчитываем. */
const PRICING_SETTING_KEYS = new Set<string>(['bead_pack_price_discount_percent', 'org_fee_default_percent']);

export const settingsRouter = router({
    getPricing: protectedProcedure.query(({ ctx }) => ctx.services.pricingSettings.getPricingSettings()),

    updateBeadPackDiscount: adminProcedure
        .input(
            z.object({
                percent: z
                    .number()
                    .min(0, 'Скидка не может быть отрицательной')
                    .max(100, 'Скидка не может быть больше 100%'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.services.pricingSettings.setBeadPackPriceDiscountPercent(input.percent);
            // Скидка участвует в amountDue записанных заказов — пересчитываем все
            // закупки с активными строками, иначе суммы остаются в старых ценах.
            await ctx.services.purchase.recalculateAllAmounts();
            return { beadPackPriceDiscountPercent: input.percent };
        }),

    updateOrgFee: adminProcedure
        .input(
            z.object({
                percent: z
                    .number()
                    .min(0, 'Орг. сбор не может быть отрицательным')
                    .max(100, 'Орг. сбор не может быть больше 100%'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.services.pricingSettings.setOrgFeeDefaultPercent(input.percent);
            // Оргсбор входит в amountDue записанных заказов: без пересчёта старые заказы оставались
            // по старому проценту, новые — по новому, а расшифровка суммы уходила в минус.
            await ctx.services.purchase.recalculateAllAmounts();
            return { orgFeeDefaultPercent: input.percent };
        }),

    getOnlinePayment: adminProcedure.query(async ({ ctx }) => {
        const [config, receipt] = await Promise.all([
            ctx.services.onlinePayment.getConfig(),
            ctx.services.settings.getMany(['receipt_taxation', 'receipt_vat']),
        ]);
        return {
            ...config,
            receiptTaxation: receipt.receipt_taxation,
            receiptVat: receipt.receipt_vat,
        };
    }),

    updateOnlinePayment: adminProcedure
        .input(
            z.object({
                cardFeePercent: z.number().min(0, 'Комиссия не может быть отрицательной').max(20, 'Не больше 20%'),
                sbpFeePercent: z.number().min(0, 'Комиссия не может быть отрицательной').max(20, 'Не больше 20%'),
                receiptEnabled: z.boolean(),
                receiptTaxation: z.enum(TBANK_TAXATIONS as [TbankTaxation, ...TbankTaxation[]]),
                receiptVat: z.enum(TBANK_VATS as [TbankVat, ...TbankVat[]]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.services.settings.set('online_payment_card_fee_percent', input.cardFeePercent);
            await ctx.services.settings.set('online_payment_sbp_fee_percent', input.sbpFeePercent);
            await ctx.services.settings.set('receipt_enabled', input.receiptEnabled);
            await ctx.services.settings.set('receipt_taxation', input.receiptTaxation);
            await ctx.services.settings.set('receipt_vat', input.receiptVat);
            return input;
        }),

    // ── Generic API для будущих настроек ───────────────────────────
    get: protectedProcedure
        .input(z.object({ key: settingKeySchema }))
        .query(({ ctx, input }) => ctx.services.settings.get(input.key)),

    list: protectedProcedure.query(({ ctx }) => ctx.services.settings.getAll()),

    set: adminProcedure
        .input(
            z.object({
                key: settingKeySchema,
                value: z.union([z.string(), z.number(), z.boolean()]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const def = SETTINGS_SCHEMA[input.key] as SettingDef;
            let typed: unknown;
            switch (def.type) {
                case 'number': {
                    typed = Number(input.value);
                    break;
                }
                case 'boolean': {
                    typed = input.value === true || input.value === 'true';
                    break;
                }
                case 'string': {
                    typed = String(input.value);
                    break;
                }
                case 'json': {
                    try {
                        typed = typeof input.value === 'string' ? JSON.parse(input.value) : input.value;
                    } catch {
                        throw new ValidationError(`${input.key}: невалидный JSON`);
                    }
                    break;
                }
            }
            await ctx.services.settings.set(input.key, typed as never);
            if (PRICING_SETTING_KEYS.has(input.key)) await ctx.services.purchase.recalculateAllAmounts();
            return { key: input.key, value: typed };
        }),
});
