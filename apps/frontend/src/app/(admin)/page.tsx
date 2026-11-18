'use client';

import { ANALYTICS_PERIOD_LABELS, type AnalyticsPeriod } from '@zakupki/types';
import { BarChart3, LayoutDashboard, PlusIcon } from 'lucide-react';
import { Suspense } from 'react';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/client/trpc';

import { AttentionList, AttentionListSkeleton } from './components/dashboard/attention-list';
import { COMPARISON_LABELS, formatPeriodRange, formatRubShort, pluralize } from './components/dashboard/format';
import { KpiCard, KpiCardSkeleton } from './components/dashboard/kpi-card';
import { PeriodSwitcher } from './components/dashboard/period-switcher';
import { PurchasesTable, PurchasesTableSkeleton } from './components/dashboard/purchases-table';
import { StagePipeline, StagePipelineSkeleton } from './components/dashboard/stage-pipeline';
import type { DashboardOverview, DashboardSnapshot } from './components/dashboard/types';
import { OverallStatsTab } from './components/stats/stats-tab';
import { type DashboardTab, useDashboardPeriod, useDashboardTab } from './hooks/use-dashboard-period';

function DebtCard({ snapshot }: { snapshot: DashboardSnapshot }) {
    const open = snapshot.purchases.filter((row) => row.paymentOpen);
    const due = open.reduce((acc, row) => acc + row.due, 0);
    const confirmed = open.reduce((acc, row) => acc + row.confirmed, 0);
    const percent = due > 0 ? Math.min(100, (confirmed / due) * 100) : 0;
    const { total, debtors } = snapshot.debt;

    return (
        <KpiCard
            label="Долг клиентов"
            value={<span className={total > 0 ? 'text-error' : undefined}>{formatRubShort(total)}</span>}
            hint={
                debtors > 0
                    ? `${debtors} ${pluralize(debtors, 'должник', 'должника', 'должников')} · сейчас`
                    : 'на сейчас'
            }
            footer={
                <div className="flex flex-col gap-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                        <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-11-regular text-fg-tertiary tabular-nums">
                        оплачено {Math.round(percent)}% от {formatRubShort(due)}
                    </span>
                </div>
            }
        />
    );
}

function KpiRow({
    overview,
    snapshot,
    period,
}: {
    overview: DashboardOverview | undefined;
    snapshot: DashboardSnapshot | undefined;
    period: AnalyticsPeriod;
}) {
    const comparison = COMPARISON_LABELS[period];
    return (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {overview ? (
                <>
                    <KpiCard
                        label="Оборот"
                        value={formatRubShort(overview.turnover.value)}
                        delta={overview.turnover.delta}
                        comparisonLabel={comparison}
                        series={overview.turnover.series}
                        start={overview.from}
                        bucketMs={overview.bucketMs}
                        formatValue={formatRubShort}
                    />
                    <KpiCard
                        label="Поступило"
                        value={formatRubShort(overview.received.value)}
                        delta={overview.received.delta}
                        comparisonLabel={comparison}
                        series={overview.received.series}
                        start={overview.from}
                        bucketMs={overview.bucketMs}
                        formatValue={formatRubShort}
                    />
                </>
            ) : (
                <>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                </>
            )}
            {snapshot ? <DebtCard snapshot={snapshot} /> : <KpiCardSkeleton />}
            {overview ? (
                <>
                    <KpiCard
                        label="Оргсбор"
                        value={formatRubShort(overview.orgFee.value)}
                        delta={overview.orgFee.delta}
                        comparisonLabel={comparison}
                        series={overview.orgFee.series}
                        start={overview.from}
                        bucketMs={overview.bucketMs}
                        formatValue={formatRubShort}
                    />
                    <KpiCard
                        label="Новые клиенты"
                        value={overview.newClients.value.toLocaleString('ru-RU')}
                        delta={overview.newClients.delta}
                        comparisonLabel={comparison}
                        series={overview.newClients.series}
                        start={overview.from}
                        bucketMs={overview.bucketMs}
                    />
                    <KpiCard
                        label="Средний чек"
                        value={formatRubShort(overview.avgCheck.value)}
                        delta={overview.avgCheck.delta}
                        comparisonLabel={comparison}
                        series={overview.avgCheck.series}
                        start={overview.from}
                        bucketMs={overview.bucketMs}
                        formatValue={formatRubShort}
                    />
                </>
            ) : (
                <>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                </>
            )}
        </div>
    );
}

function SummaryTab() {
    const [period, setPeriod] = useDashboardPeriod();
    const overview = trpc.analytics.overview.useQuery({ period }, { placeholderData: (prev) => prev });
    const snapshot = trpc.analytics.snapshot.useQuery();

    const range = overview.data
        ? formatPeriodRange(overview.data.from, overview.data.to)
        : ANALYTICS_PERIOD_LABELS[period];

    return (
        <div className="flex flex-col gap-6">
            <p className="-mb-2 text-14-regular text-fg-secondary">Деньги и заказы · {range}</p>
            <div className="-mt-2 overflow-x-auto">
                <PeriodSwitcher value={period} onChange={setPeriod} />
            </div>

            <div className={overview.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <KpiRow overview={overview.data} snapshot={snapshot.data} period={period} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Card rounded="2xl">
                    <CardHeader>
                        <CardTitle>Требует внимания</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {snapshot.data ? <AttentionList snapshot={snapshot.data} /> : <AttentionListSkeleton />}
                    </CardContent>
                </Card>
                <Card rounded="2xl">
                    <CardHeader>
                        <CardTitle>Этапы открытых закупок</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {snapshot.data ? <StagePipeline stages={snapshot.data.stages} /> : <StagePipelineSkeleton />}
                    </CardContent>
                </Card>
            </div>

            <Card rounded="2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Открытые закупки</CardTitle>
                    {snapshot.data && (
                        <span className="text-13-medium text-fg-tertiary tabular-nums">
                            {snapshot.data.purchases.length}
                        </span>
                    )}
                </CardHeader>
                <CardContent>
                    {snapshot.data ? <PurchasesTable rows={snapshot.data.purchases} /> : <PurchasesTableSkeleton />}
                </CardContent>
            </Card>
        </div>
    );
}

function Dashboard() {
    const [tab, setTab] = useDashboardTab();
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Сводка"
                description={tab === 'stats' ? 'Все закупки за всё время' : undefined}
                actions={
                    <Button asChild variant="brand" size="sm">
                        <AppLink href="/purchases">
                            <PlusIcon className="size-4" />
                            <span className="hidden sm:inline">Новая закупка</span>
                        </AppLink>
                    </Button>
                }
                className="mb-0 sm:mb-0"
            />
            <Tabs value={tab} onValueChange={(v) => setTab(v as DashboardTab)} className="min-w-0 gap-4">
                <TabsList className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
                    <TabsTrigger value="summary">
                        <LayoutDashboard className="size-3.5" />
                        Сводка
                    </TabsTrigger>
                    <TabsTrigger value="stats">
                        <BarChart3 className="size-3.5" />
                        Статистика
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="mt-2">
                    {tab === 'summary' && <SummaryTab />}
                </TabsContent>
                <TabsContent value="stats" className="mt-2">
                    {tab === 'stats' && <OverallStatsTab />}
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={null}>
            <Dashboard />
        </Suspense>
    );
}
