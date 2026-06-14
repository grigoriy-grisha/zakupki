import { SETTINGS_SCHEMA, isSettingKey, ValidationError, type SettingDef } from '@zakupki/types';
import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

const settingKeySchema = z.string().refine(isSettingKey, { message: 'Неизвестный ключ настройки' });

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
            return { beadPackPriceDiscountPercent: input.percent };
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
            return { key: input.key, value: typed };
        }),
});
