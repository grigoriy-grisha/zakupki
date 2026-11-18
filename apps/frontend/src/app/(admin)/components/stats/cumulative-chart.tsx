'use client';

import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { bucketLabel, ChartTooltipCard } from '@/components/ui/chart-tooltip';

import { LegendDot, type PurchaseStatsData, rub, rubCompact, StatsCard } from './shared';

const HEIGHT = 240;
const GAP_FILL = 'color-mix(in srgb, var(--color-gold) 22%, transparent)';
const AXIS_TICK = { fontSize: 11, fill: 'var(--color-fg-tertiary)' };

type Point = { index: number; label: string; orders: number; paid: number; gap: [number, number] };

function CumulativeTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: Point }> }) {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;
    const debt = Math.max(0, point.orders - point.paid);
    return (
        <ChartTooltipCard
            title={point.label}
            rows={[
                { label: 'Заказано', value: rub(point.orders), color: 'var(--color-secondary)' },
                { label: 'Оплачено', value: rub(point.paid), color: 'var(--color-sage)' },
                { label: 'Долг', value: rub(debt), color: 'var(--color-gold)' },
            ]}
        />
    );
}

function EndLabel({
    cx,
    cy,
    index,
    last,
    value,
    color,
    below,
}: {
    cx?: number;
    cy?: number;
    index?: number;
    last: number;
    value: number;
    color: string;
    below?: boolean;
}) {
    if (index !== last || cx == null || cy == null) return <g key={index} />;
    return (
        <g key="end">
            <circle cx={cx} cy={cy} r={4} fill={color} />
            <text
                x={cx - 8}
                y={below ? cy + 17 : cy - 9}
                textAnchor="end"
                fontSize={12}
                fontWeight={600}
                fill="var(--color-fg-primary)"
            >
                {rubCompact(value)}
            </text>
        </g>
    );
}

export function CumulativeChart({ data }: { data: PurchaseStatsData }) {
    const { timeline } = data;
    const from = new Date(timeline.from).getTime();
    const points: Point[] = timeline.orders.map((orders, index) => {
        const paid = timeline.paid[index] ?? 0;
        return {
            index,
            label: bucketLabel(from + index * timeline.bucketMs, timeline.bucketMs),
            orders,
            paid,
            gap: [paid, orders],
        };
    });
    const last = points.length - 1;
    const lastOrders = timeline.orders[last] ?? 0;
    const lastPaid = timeline.paid[last] ?? 0;

    return (
        <StatsCard
            title="Заказы и оплаты нарастающим итогом"
            meta={
                timeline.bucketMs > 86_400_000
                    ? 'по неделям · разрыв — текущий долг'
                    : 'по дням · разрыв — текущий долг'
            }
        >
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-12-regular text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                    <LegendDot color="var(--color-secondary)" />
                    Сумма заказов
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <LegendDot color="var(--color-sage)" />
                    Подтверждённые оплаты
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <LegendDot color={GAP_FILL} />
                    Долг
                </span>
            </div>
            <div
                className="w-full"
                style={{ height: HEIGHT }}
                role="img"
                aria-label={`Заказы ${rubCompact(lastOrders)} ₽, оплачено ${rubCompact(lastPaid)} ₽`}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={points} margin={{ top: 22, right: 14, bottom: 0, left: 0 }}>
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
                            width={52}
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value: number) => rubCompact(value)}
                            tickCount={5}
                        />
                        {timeline.marks.map((mark) => (
                            <ReferenceLine
                                key={mark.label}
                                x={points[mark.index]?.label}
                                stroke="var(--color-border-soft)"
                                strokeDasharray="3 4"
                                label={{
                                    value: mark.label,
                                    position: 'insideTopLeft',
                                    fontSize: 11,
                                    fill: 'var(--color-fg-tertiary)',
                                }}
                            />
                        ))}
                        <Tooltip
                            isAnimationActive={false}
                            cursor={{ stroke: 'var(--color-border-soft)' }}
                            content={<CumulativeTooltip />}
                        />
                        <Area
                            type="linear"
                            dataKey="gap"
                            stroke="none"
                            fill={GAP_FILL}
                            fillOpacity={1}
                            isAnimationActive={false}
                            activeDot={false}
                        />
                        <Line
                            type="linear"
                            dataKey="orders"
                            stroke="var(--color-secondary)"
                            strokeWidth={2.2}
                            isAnimationActive={false}
                            dot={({ key: _key, ...props }) => (
                                <EndLabel
                                    key={props.index}
                                    {...props}
                                    last={last}
                                    value={lastOrders}
                                    color="var(--color-secondary)"
                                />
                            )}
                            activeDot={{ r: 4, fill: 'var(--color-secondary)', stroke: 'var(--color-bg-soft)' }}
                        />
                        <Line
                            type="linear"
                            dataKey="paid"
                            stroke="var(--color-sage)"
                            strokeWidth={2.2}
                            isAnimationActive={false}
                            dot={({ key: _key, ...props }) => (
                                <EndLabel
                                    key={props.index}
                                    {...props}
                                    last={last}
                                    value={lastPaid}
                                    color="var(--color-sage)"
                                    below
                                />
                            )}
                            activeDot={{ r: 4, fill: 'var(--color-sage)', stroke: 'var(--color-bg-soft)' }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </StatsCard>
    );
}
