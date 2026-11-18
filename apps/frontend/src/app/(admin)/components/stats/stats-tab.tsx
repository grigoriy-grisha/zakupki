'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';

import { CumulativeChart } from './cumulative-chart';
import { HandoffFunnel } from './handoff-funnel';
import { MoneyBreakdown } from './money-breakdown';
import { PackFill } from './pack-fill';
import { ParticipantsCard } from './participants-card';
import { PaymentsCard } from './payments-card';
import { ProgressTrio } from './progress-trio';
import { PurchasesCompare } from './purchases-compare';
import type { PurchaseStatsData } from './shared';
import { SuppliersCard } from './suppliers-card';

function StatsSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy>
            <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
            </div>
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
        </div>
    );
}

function StatsError({ message }: { message?: string }) {
    return (
        <p className="rounded-2xl bg-error-50 px-4 py-3 text-14-regular text-error">
            Не удалось загрузить статистику{message ? `: ${message}` : ''}
        </p>
    );
}

function StatsLayout({ data }: { data: PurchaseStatsData }) {
    const overall = data.scope.kind === 'all';
    return (
        <div className="flex flex-col gap-4">
            <ProgressTrio data={data} />
            <MoneyBreakdown data={data} />
            <CumulativeChart data={data} />
            {overall ? (
                <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                    <PurchasesCompare data={data} />
                    <SuppliersCard data={data} />
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                    <PackFill data={data} />
                    <SuppliersCard data={data} />
                </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
                <PaymentsCard data={data} />
                <ParticipantsCard data={data} />
            </div>
            <HandoffFunnel data={data} />
        </div>
    );
}

/** Вкладка «Статистика» на странице закупки. */
export function PurchaseStatsTab({ purchaseId }: { purchaseId: number }) {
    const { data, isLoading, error } = trpc.analytics.purchase.useQuery({ purchaseId }, { staleTime: 60_000 });
    if (isLoading) return <StatsSkeleton />;
    if (error || !data) return <StatsError message={error?.message} />;
    return <StatsLayout data={data} />;
}

/** Вкладка «Статистика» в сводке: всё то же, но по всем закупкам сразу. */
export function OverallStatsTab() {
    const { data, isLoading, error } = trpc.analytics.all.useQuery(undefined, { staleTime: 60_000 });
    if (isLoading) return <StatsSkeleton />;
    if (error || !data) return <StatsError message={error?.message} />;
    return <StatsLayout data={data} />;
}
