'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { bucketLabel, ChartTooltipCard } from '@/components/ui/chart-tooltip';

import { LegendDot, percent, StatsCard } from '../../../components/stats/shared';
import type { UserStatsData } from './types';

const AXIS_TICK = { fontSize: 11, fill: 'var(--color-fg-tertiary)' };
const count = (value: number) => value.toLocaleString('ru-RU');

type SeriesPoint = { label: string; [key: string]: number | string };

function points(data: UserStatsData, series: Record<string, readonly number[]>): SeriesPoint[] {
    const from = new Date(data.from).getTime();
    const length = Object.values(series)[0]?.length ?? 0;
    return Array.from({ length }, (_, index) => {
        const point: SeriesPoint = { label: bucketLabel(from + index * data.bucketMs, data.bucketMs) };
        for (const [key, values] of Object.entries(series)) point[key] = values[index] ?? 0;
        return point;
    });
}

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload: SeriesPoint }> };

function bucketWord(bucketMs: number) {
    return bucketMs > 86_400_000 ? 'по неделям' : 'по дням';
}

/** Рост базы: новые за корзину (столбики) и сколько всего клиентов (линия). */
export function GrowthChart({ data }: { data: UserStatsData }) {
    const rows = points(data, { added: data.growth.newSeries, total: data.growth.totalSeries });
    const GrowthTooltip = ({ active, payload }: TooltipProps) => {
        const point = payload?.[0]?.payload;
        if (!active || !point) return null;
        return (
            <ChartTooltipCard
                title={point.label}
                rows={[
                    { label: 'Новых', value: `+${count(Number(point.added))}`, color: 'var(--color-sage)' },
                    { label: 'Всего клиентов', value: count(Number(point.total)), color: 'var(--color-secondary)' },
                ]}
            />
        );
    };

    return (
        <StatsCard title="Рост клиентов" meta={`${bucketWord(data.bucketMs)} · регистрации`}>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-12-regular text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                    <LegendDot color="var(--color-sage)" />
                    Новые
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <LegendDot color="var(--color-secondary)" />
                    Всего клиентов
                </span>
            </div>
            <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--color-border-low)" />
                        <XAxis
                            dataKey="label"
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={24}
                            tickMargin={8}
                        />
                        <YAxis
                            yAxisId="added"
                            width={32}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <YAxis
                            yAxisId="total"
                            orientation="right"
                            width={40}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            domain={['dataMin', 'dataMax']}
                        />
                        <Tooltip
                            isAnimationActive={false}
                            cursor={{ fill: 'var(--color-border-low)' }}
                            content={<GrowthTooltip />}
                        />
                        <Bar
                            yAxisId="added"
                            dataKey="added"
                            fill="color-mix(in srgb, var(--color-sage) 70%, transparent)"
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={false}
                        />
                        <Line
                            yAxisId="total"
                            type="monotone"
                            dataKey="total"
                            stroke="var(--color-secondary)"
                            strokeWidth={2.2}
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--color-secondary)', stroke: 'var(--color-bg-soft)' }}
                            isAnimationActive={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </StatsCard>
    );
}

/** Сколько разных людей заходило и сколько заказывало в каждой корзине. */
export function ActivityChart({ data }: { data: UserStatsData }) {
    const tracking = data.trackingSince != null;
    const rows = points(data, { buyers: data.activity.buyers, visitors: data.activity.visitors });
    const ActivityTooltip = ({ active, payload }: TooltipProps) => {
        const point = payload?.[0]?.payload;
        if (!active || !point) return null;
        return (
            <ChartTooltipCard
                title={point.label}
                rows={[
                    ...(tracking
                        ? [{ label: 'Заходили', value: count(Number(point.visitors)), color: 'var(--color-secondary)' }]
                        : []),
                    { label: 'Заказывали', value: count(Number(point.buyers)), color: 'var(--color-gold)' },
                ]}
            />
        );
    };

    return (
        <StatsCard title="Активность" meta={`${bucketWord(data.bucketMs)} · разные люди`}>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-12-regular text-fg-secondary">
                {tracking && (
                    <span className="inline-flex items-center gap-1.5">
                        <LegendDot color="var(--color-secondary)" />
                        Заходили
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                    <LegendDot color="var(--color-gold)" />
                    Заказывали
                </span>
            </div>
            <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--color-border-low)" />
                        <XAxis
                            dataKey="label"
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={24}
                            tickMargin={8}
                        />
                        <YAxis width={32} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                            isAnimationActive={false}
                            cursor={{ stroke: 'var(--color-border-soft)' }}
                            content={<ActivityTooltip />}
                        />
                        {tracking && (
                            <Line
                                type="monotone"
                                dataKey="visitors"
                                stroke="var(--color-secondary)"
                                strokeWidth={2.2}
                                dot={false}
                                activeDot={{ r: 4, fill: 'var(--color-secondary)', stroke: 'var(--color-bg-soft)' }}
                                isAnimationActive={false}
                            />
                        )}
                        <Line
                            type="monotone"
                            dataKey="buyers"
                            stroke="var(--color-gold)"
                            strokeWidth={2.2}
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--color-gold)', stroke: 'var(--color-bg-soft)' }}
                            isAnimationActive={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </StatsCard>
    );
}

type Bin = { label: string; count: number };

/** Столбики распределения с подсказкой «N человек · X%». */
export function FrequencyChart({
    title,
    meta,
    bins,
    color,
    empty,
}: {
    title: string;
    meta?: string;
    bins: Bin[];
    color: string;
    empty?: string;
}) {
    const total = bins.reduce((acc, bin) => acc + bin.count, 0);
    const FrequencyTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: Bin }> }) => {
        const bin = payload?.[0]?.payload;
        if (!active || !bin) return null;
        return (
            <ChartTooltipCard
                title={bin.label}
                rows={[{ label: 'Человек', value: `${count(bin.count)} · ${percent(bin.count, total)}`, color }]}
            />
        );
    };

    return (
        <StatsCard title={title} meta={meta}>
            {total === 0 ? (
                <p className="text-14-regular text-fg-tertiary">{empty ?? 'Данных пока нет'}</p>
            ) : (
                <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bins} margin={{ top: 20, right: 0, bottom: 0, left: 0 }} barCategoryGap={6}>
                            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={AXIS_TICK} />
                            <Tooltip
                                isAnimationActive={false}
                                cursor={{ fill: 'var(--color-border-low)', radius: 6 }}
                                content={<FrequencyTooltip />}
                            />
                            <Bar
                                dataKey="count"
                                fill={color}
                                radius={[6, 6, 0, 0]}
                                minPointSize={2}
                                isAnimationActive={false}
                            >
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
            )}
        </StatsCard>
    );
}
