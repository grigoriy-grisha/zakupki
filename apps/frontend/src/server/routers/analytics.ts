import { ANALYTICS_PERIODS } from '@zakupki/types';
import { z } from 'zod';

import { adminProcedure, router } from '../trpc';

export const analyticsRouter = router({
    overview: adminProcedure
        .input(z.object({ period: z.enum(ANALYTICS_PERIODS) }))
        .query(({ ctx, input }) => ctx.services.analytics.overview(input.period)),

    snapshot: adminProcedure.query(({ ctx }) => ctx.services.analytics.snapshot()),

    users: adminProcedure
        .input(z.object({ period: z.enum(ANALYTICS_PERIODS) }))
        .query(({ ctx, input }) => ctx.services.userAnalytics.overview(input.period)),

    all: adminProcedure.query(({ ctx }) => ctx.services.purchaseAnalytics.all()),
    purchase: adminProcedure
        .input(z.object({ purchaseId: z.number().int().positive() }))
        .query(({ ctx, input }) => ctx.services.purchaseAnalytics.purchase(input.purchaseId)),
});
