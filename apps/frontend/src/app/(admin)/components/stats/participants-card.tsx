'use client';

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { ChartTooltipCard } from '@/components/ui/chart-tooltip';

import { pluralize, type PurchaseStatsData, rub, StatsCard } from './shared';

type Bin = PurchaseStatsData['participants']['histogram'][number];

function HistogramTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: Bin }> }) {
    const bin = payload?.[0]?.payload;
    if (!active || !bin) return null;
    return (
        <ChartTooltipCard
            title={`Чек ${bin.label} тыс ₽`}
            rows={[
                {
                    label: 'Участий',
                    value: bin.count.toLocaleString('ru-RU'),
                    color: 'var(--color-secondary)',
                },
            ]}
        />
    );
}

function ChecksHistogram({ bins, medianBin }: { bins: Bin[]; medianBin: number }) {
    return (
        <div className="h-44 w-full" role="img" aria-label="Распределение чеков">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bins} margin={{ top: 20, right: 0, bottom: 0, left: 0 }} barCategoryGap={6}>
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tick={{ fontSize: 11, fill: 'var(--color-fg-tertiary)' }}
                    />
                    <Tooltip
                        isAnimationActive={false}
                        cursor={{ fill: 'var(--color-border-low)', radius: 6 }}
                        content={<HistogramTooltip />}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} minPointSize={2} isAnimationActive={false}>
                        {bins.map((bin, i) => (
                            <Cell
                                key={bin.label}
                                fill={
                                    i === medianBin
                                        ? 'var(--color-secondary)'
                                        : 'color-mix(in srgb, var(--color-secondary) 35%, transparent)'
                                }
                            />
                        ))}
                        <LabelList
                            dataKey="count"
                            position="top"
                            fontSize={11}
                            fill="var(--color-fg-secondary)"
                            formatter={(value: unknown) => (Number(value) > 0 ? String(value) : '')}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Распределение чеков участников, средний и медианный чек, новички и добор. */
export function ParticipantsCard({ data }: { data: PurchaseStatsData }) {
    const { participants, supplements } = data;
    const bins = participants.histogram;
    const medianBin = bins.findIndex(
        (b) => participants.median >= b.from && (b.to == null || participants.median < b.to),
    );

    return (
        <StatsCard
            title="Участники"
            meta={
                participants.count === participants.uniqueClients
                    ? `${participants.count} ${pluralize(participants.count, 'человек', 'человека', 'человек')} · чеки, тыс ₽`
                    : `${participants.uniqueClients} ${pluralize(participants.uniqueClients, 'клиент', 'клиента', 'клиентов')} · ${participants.count} ${pluralize(participants.count, 'чек', 'чека', 'чеков')}, тыс ₽`
            }
        >
            {participants.count === 0 ? (
                <p className="text-14-regular text-fg-tertiary">Заказов пока нет</p>
            ) : (
                <>
                    <ChecksHistogram bins={bins} medianBin={medianBin} />
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-bg-surface-elevated/70 px-3 py-2">
                            <dt className="text-12-regular text-fg-tertiary">Средний чек</dt>
                            <dd className="text-16-semibold tabular-nums text-fg-primary">
                                {rub(participants.average)}
                            </dd>
                        </div>
                        <div className="rounded-xl bg-bg-surface-elevated/70 px-3 py-2">
                            <dt className="text-12-regular text-fg-tertiary">Медиана · выделена</dt>
                            <dd className="text-16-semibold tabular-nums text-fg-primary">
                                {rub(participants.median)}
                            </dd>
                        </div>
                        <div className="rounded-xl bg-bg-surface-elevated/70 px-3 py-2">
                            <dt className="text-12-regular text-fg-tertiary">
                                {participants.newcomers != null ? 'Впервые у нас' : 'Вернулись повторно'}
                            </dt>
                            <dd className="text-16-semibold tabular-nums text-fg-primary">
                                {participants.newcomers ?? participants.repeatClients}
                                <span className="ml-1 text-12-regular text-fg-tertiary">
                                    из {participants.uniqueClients}
                                </span>
                            </dd>
                        </div>
                        <div className="rounded-xl bg-bg-surface-elevated/70 px-3 py-2">
                            <dt className="text-12-regular text-fg-tertiary">Добор</dt>
                            <dd className="text-16-semibold tabular-nums text-fg-primary">
                                {supplements.lines > 0 ? rub(supplements.amount) : '—'}
                            </dd>
                            {supplements.lines > 0 && (
                                <dd className="text-11-regular text-fg-tertiary">
                                    {supplements.lines} {pluralize(supplements.lines, 'строка', 'строки', 'строк')} ·{' '}
                                    {supplements.users}{' '}
                                    {pluralize(supplements.users, 'участник', 'участника', 'участников')}
                                </dd>
                            )}
                        </div>
                    </dl>
                </>
            )}
        </StatsCard>
    );
}
