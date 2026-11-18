import type { inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/server/routers/_app';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DashboardOverview = RouterOutputs['analytics']['overview'];
export type DashboardSnapshot = RouterOutputs['analytics']['snapshot'];
export type DashboardMetric = DashboardOverview['turnover'];
export type DashboardPurchaseRow = DashboardSnapshot['purchases'][number];
