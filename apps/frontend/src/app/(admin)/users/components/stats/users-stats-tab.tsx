'use client';

import { VISIT_DEVICE_LABELS, VISIT_PLATFORM_LABELS, type VisitDevice } from '@zakupki/types';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';

import { COMPARISON_LABELS, formatPeriodRange } from '../../../components/dashboard/format';
import { KpiCard, KpiCardSkeleton } from '../../../components/dashboard/kpi-card';
import { PeriodSwitcher } from '../../../components/dashboard/period-switcher';
import { Callout, percent, pluralize } from '../../../components/stats/shared';
import { useDashboardPeriod } from '../../../hooks/use-dashboard-period';
import { ActivityChart, FrequencyChart, GrowthChart } from './charts';
import { ShareList } from './share-list';
import type { UserStatsData } from './types';

const DEVICE_ICONS: Record<VisitDevice, typeof Smartphone> = {
    MOBILE: Smartphone,
    TABLET: Tablet,
    DESKTOP: Monitor,
};

const PLATFORM_COLORS = {
    TELEGRAM: 'var(--color-secondary)',
    VK: 'var(--color-primary)',
    WEB: 'var(--color-sage)',
} as const;

const SINCE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

function UsersStatsLayout({ data, comparison }: { data: UserStatsData; comparison: string }) {
    const { totals } = data;
    const tracking = data.trackingSince != null;
    const notTrackedYet = 'Начнёт копиться после выкладки';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    label="Всего клиентов"
                    value={totals.clients.toLocaleString('ru-RU')}
                    hint={`${totals.everOrdered} ${pluralize(totals.everOrdered, 'заказывал', 'заказывали', 'заказывали')} хоть раз · ${percent(totals.everOrdered, totals.clients)}`}
                    series={data.growth.totalSeries}
                    start={data.from}
                    bucketMs={data.bucketMs}
                />
                <KpiCard
                    label="Новые клиенты"
                    value={totals.newClients.value.toLocaleString('ru-RU')}
                    delta={totals.newClients.delta}
                    comparisonLabel={comparison}
                    series={data.growth.newSeries}
                    start={data.from}
                    bucketMs={data.bucketMs}
                />
                <KpiCard
                    label="Заказывали"
                    value={totals.buyers.value.toLocaleString('ru-RU')}
                    delta={totals.buyers.delta}
                    comparisonLabel={comparison}
                    series={data.activity.buyers}
                    start={data.from}
                    bucketMs={data.bucketMs}
                />
                <KpiCard
                    label="Заходили"
                    value={tracking ? totals.visitors.value.toLocaleString('ru-RU') : '—'}
                    delta={tracking ? totals.visitors.delta : undefined}
                    comparisonLabel={comparison}
                    hint={tracking ? undefined : notTrackedYet}
                    series={tracking ? data.activity.visitors : undefined}
                    start={data.from}
                    bucketMs={data.bucketMs}
                />
            </div>

            {!tracking && (
                <Callout>
                    Учёт заходов, площадок и устройств только что включён. Эти блоки начнут заполняться после выкладки,
                    когда клиенты будут открывать магазин. Регистрации и заказы посчитаны по всей истории.
                </Callout>
            )}
            {tracking && data.trackingSince && (
                <p className="text-12-regular text-fg-tertiary">
                    Заходы считаются с {SINCE_FORMAT.format(new Date(data.trackingSince))}
                </p>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <GrowthChart data={data} />
                <ActivityChart data={data} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ShareList
                    title="Как регистрировались"
                    meta="все клиенты"
                    items={[
                        {
                            key: 'tg',
                            label: 'Telegram',
                            value: data.sources.telegram,
                            color: PLATFORM_COLORS.TELEGRAM,
                        },
                        { key: 'vk', label: 'ВКонтакте', value: data.sources.vk, color: PLATFORM_COLORS.VK },
                        {
                            key: 'both',
                            label: 'Telegram и VK',
                            value: data.sources.both,
                            color: 'var(--color-gold)',
                        },
                        ...(data.sources.none > 0
                            ? [
                                  {
                                      key: 'none',
                                      label: 'Другое',
                                      value: data.sources.none,
                                      color: 'var(--color-chart-5)',
                                  },
                              ]
                            : []),
                    ]}
                />
                <ShareList
                    title="Где открывают"
                    meta="за период · люди"
                    empty={notTrackedYet}
                    items={data.platforms.map((row) => ({
                        key: row.key,
                        label: VISIT_PLATFORM_LABELS[row.key],
                        value: row.users,
                        color: PLATFORM_COLORS[row.key],
                    }))}
                />
                <ShareList
                    title="Устройства"
                    meta="за период · люди"
                    empty={notTrackedYet}
                    items={data.devices.map((row) => ({
                        key: row.key,
                        label: VISIT_DEVICE_LABELS[row.key],
                        value: row.users,
                        color: 'var(--color-secondary)',
                        icon: DEVICE_ICONS[row.key],
                    }))}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FrequencyChart
                    title="Как часто заходят"
                    meta="дней с заходом за период"
                    bins={data.visitFrequency}
                    color="color-mix(in srgb, var(--color-secondary) 70%, transparent)"
                    empty={notTrackedYet}
                />
                <FrequencyChart
                    title="Как часто заказывают"
                    meta="дней с заказом за период"
                    bins={data.orderFrequency}
                    color="color-mix(in srgb, var(--color-gold) 80%, transparent)"
                    empty="За период никто не заказывал"
                />
                <FrequencyChart
                    title="Закупок на клиента"
                    meta={`за всё время · ${totals.dormant} не заказывали ${data.dormantAfterDays}+ дней`}
                    bins={data.purchasesPerClient}
                    color="color-mix(in srgb, var(--color-sage) 75%, transparent)"
                />
            </div>
        </div>
    );
}

function UsersStatsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <KpiCardSkeleton key={i} />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        </div>
    );
}

/** Вкладка «Статистика» на странице участников: рост, активность, площадки и устройства. */
export function UsersStatsTab() {
    const [period, setPeriod] = useDashboardPeriod();
    const query = trpc.analytics.users.useQuery({ period }, { placeholderData: (prev) => prev, staleTime: 60_000 });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-14-regular text-fg-secondary">
                    Клиенты · {query.data ? formatPeriodRange(query.data.from, query.data.to) : '…'}
                </p>
                <PeriodSwitcher value={period} onChange={setPeriod} />
            </div>
            {query.data ? (
                <UsersStatsLayout data={query.data} comparison={COMPARISON_LABELS[period]} />
            ) : query.error ? (
                <p className="text-14-regular text-error">Не удалось загрузить статистику: {query.error.message}</p>
            ) : (
                <UsersStatsSkeleton />
            )}
        </div>
    );
}
