import { z } from 'zod';

import { adminProcedure, protectedProcedure, router } from '../trpc';

export const appSettingsRouter = router({
    getPricing: protectedProcedure.query(async ({ ctx }) => {
        return ctx.services.appSetting.getPricingSettings();
    }),

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
            return ctx.services.appSetting.setBeadPackPriceDiscountPercent(input.percent);
        }),
});
