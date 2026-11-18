import type { MetricDelta } from '@zakupki/types';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';

type KpiCardProps = {
    label: string;
    value: ReactNode;
    /** Изменение к прошлому периоду. */
    delta?: MetricDelta;
    /** Рост — это хорошо (оборот) или плохо (долг). */
    higherIsBetter?: boolean;
    comparisonLabel?: string;
    series?: readonly number[];
    /** Нижняя строка вместо графика (например, прогресс оплаты). */
    footer?: ReactNode;
    hint?: ReactNode;
    /** Начало периода и длина корзины — подписи дат в подсказке графика. */
    start?: Date | string;
    bucketMs?: number;
    formatValue?: (value: number) => string;
};

const FLAT_THRESHOLD = 1;

function DeltaBadge({ delta, higherIsBetter, label }: { delta: MetricDelta; higherIsBetter: boolean; label?: string }) {
    if (delta.kind === 'none') {
        return <span className="text-12-medium text-fg-tertiary">нет данных для сравнения</span>;
    }
    if (delta.kind === 'new') {
        return <span className="text-12-medium text-success">новое — раньше было 0</span>;
    }
    const flat = Math.abs(delta.percent) < FLAT_THRESHOLD;
    const good = delta.percent > 0 === higherIsBetter;
    const Icon = flat ? ArrowRight : delta.percent > 0 ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-12-medium tabular-nums',
                flat ? 'text-fg-tertiary' : good ? 'text-success' : 'text-error',
            )}
        >
            <Icon className="size-3.5" aria-hidden />
            {Math.abs(delta.percent).toLocaleString('ru-RU')}%
            {label && <span className="ml-1 font-normal text-fg-tertiary">{label}</span>}
        </span>
    );
}

export function KpiCard({
    label,
    value,
    delta,
    higherIsBetter = true,
    comparisonLabel,
    series,
    footer,
    hint,
    start,
    bucketMs,
    formatValue,
}: KpiCardProps) {
    const trendColor =
        delta?.kind === 'change' && Math.abs(delta.percent) >= FLAT_THRESHOLD
            ? delta.percent > 0 === higherIsBetter
                ? 'var(--color-success)'
                : 'var(--color-error)'
            : 'var(--color-secondary)';

    return (
        <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-bg-soft p-4">
            <span className="truncate text-13-medium text-fg-secondary">{label}</span>
            <span className="truncate text-24-medium tabular-nums text-fg-primary">{value}</span>
            <div className="min-h-4">
                {delta ? (
                    <DeltaBadge delta={delta} higherIsBetter={higherIsBetter} label={comparisonLabel} />
                ) : (
                    hint && <span className="text-12-regular text-fg-tertiary">{hint}</span>
                )}
            </div>
            <div className="mt-auto pt-2">
                {footer ??
                    (series && (
                        <Sparkline
                            values={series}
                            color={trendColor}
                            start={start}
                            bucketMs={bucketMs}
                            formatValue={formatValue}
                            valueLabel={label}
                            aria-label={`Динамика: ${label}`}
                        />
                    ))}
            </div>
        </div>
    );
}

export function KpiCardSkeleton() {
    return (
        <div className="flex flex-col gap-2 rounded-2xl bg-bg-soft p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-2 h-8 w-full" />
        </div>
    );
}
