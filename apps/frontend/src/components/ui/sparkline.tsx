'use client';

import { useId } from 'react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

import { bucketLabel, ChartTooltipCard } from '@/components/ui/chart-tooltip';
import { cn } from '@/lib/utils';

type SparklineProps = {
    values: readonly number[];
    /** CSS-цвет графика; по умолчанию — currentColor. */
    color?: string;
    className?: string;
    /**
     * `line` — линия с подложкой, `bars` — столбики по корзинам.
     * `auto` берёт столбики, когда значений мало (меньше половины корзин ненулевые):
     * линия, лежащая на нуле с одиночным всплеском, читается как поломка.
     */
    variant?: 'auto' | 'line' | 'bars';
    /** Начало первой корзины и её длина — для подписи даты в подсказке. */
    start?: Date | string | number;
    bucketMs?: number;
    /** Как показать значение в подсказке. */
    formatValue?: (value: number) => string;
    /** Подпись значения в подсказке. */
    valueLabel?: string;
    /**
     * `left` — подсказка открывается левее курсора и не выходит за правый край графика.
     * Нужно, когда график стоит у правого края контейнера с прокруткой (колонка таблицы).
     */
    tooltipSide?: 'auto' | 'left';
    'aria-label'?: string;
};

type Point = { index: number; value: number };

function SparkTooltip({
    active,
    payload,
    color,
    start,
    bucketMs,
    formatValue,
    valueLabel,
}: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload: Point }>;
    color: string;
    start?: number;
    bucketMs?: number;
    formatValue: (value: number) => string;
    valueLabel: string;
}) {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;
    const title = start != null && bucketMs ? bucketLabel(start + point.index * bucketMs, bucketMs) : undefined;
    return <ChartTooltipCard title={title} rows={[{ label: valueLabel, value: formatValue(point.value), color }]} />;
}

const defaultFormat = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

/** Мини-график без осей: тренд значения по корзинам периода, при наведении — значение и дата. */
export function Sparkline({
    values,
    color = 'currentColor',
    className,
    variant = 'auto',
    start,
    bucketMs,
    formatValue = defaultFormat,
    valueLabel = 'Значение',
    tooltipSide = 'auto',
    'aria-label': label,
}: SparklineProps) {
    const gradientId = useId().replace(/:/g, '');
    if (values.length < 2) return <div className={cn('h-8', className)} aria-hidden />;

    const nonZero = values.filter((v) => v !== 0).length;
    const useBars = variant === 'bars' || (variant === 'auto' && nonZero < values.length / 2);
    const data: Point[] = values.map((value, index) => ({ index, value }));
    const last = data.length - 1;
    const startMs = start != null ? new Date(start).getTime() : undefined;

    const tooltip = (
        <Tooltip
            isAnimationActive={false}
            cursor={useBars ? { fill: 'var(--color-border-low)' } : { stroke: 'var(--color-border-soft)' }}
            wrapperStyle={{ zIndex: 20, outline: 'none' }}
            allowEscapeViewBox={{ x: tooltipSide === 'left', y: true }}
            reverseDirection={tooltipSide === 'left' ? { x: true } : undefined}
            offset={12}
            content={
                <SparkTooltip
                    color={color}
                    start={startMs}
                    bucketMs={bucketMs}
                    formatValue={formatValue}
                    valueLabel={valueLabel}
                />
            }
        />
    );

    return (
        <div
            className={cn('h-8 w-full', className)}
            role={label ? 'img' : undefined}
            aria-label={label}
            style={{ color }}
        >
            <ResponsiveContainer width="100%" height="100%">
                {useBars ? (
                    <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={1}>
                        <YAxis hide domain={[0, 'dataMax']} />
                        {tooltip}
                        <Bar
                            dataKey="value"
                            fill={color}
                            fillOpacity={0.6}
                            radius={[2, 2, 0, 0]}
                            minPointSize={2}
                            isAnimationActive={false}
                        />
                    </BarChart>
                ) : (
                    <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 2, left: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        {tooltip}
                        <Area
                            type="linear"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={1.75}
                            fill={`url(#${gradientId})`}
                            isAnimationActive={false}
                            dot={(props: { cx?: number; cy?: number; index?: number }) =>
                                props.index === last ? (
                                    <circle
                                        key="last"
                                        cx={props.cx}
                                        cy={props.cy}
                                        r={3}
                                        fill={color}
                                        stroke="var(--color-bg-soft)"
                                        strokeWidth={2}
                                    />
                                ) : (
                                    <g key={props.index} />
                                )
                            }
                            activeDot={{ r: 3.5, fill: color, stroke: 'var(--color-bg-soft)', strokeWidth: 2 }}
                        />
                    </AreaChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}
