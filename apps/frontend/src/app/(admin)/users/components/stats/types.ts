import type { inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/server/routers/_app';

export type UserStatsData = inferRouterOutputs<AppRouter>['analytics']['users'];
