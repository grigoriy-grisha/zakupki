import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ChartTooltipRow = { label: string; value: ReactNode; color?: string };

/** Карточка подсказки графика: заголовок (обычно дата) и строки значений. */
export function ChartTooltipCard({
    title,
    rows,
    className,
}: {
    title?: ReactNode;
    rows: ChartTooltipRow[];
    className?: string;
}) {
    return (
        <div
            className={cn(
                'min-w-36 rounded-xl border border-border-soft bg-bg-surface-elevated px-3 py-2 shadow-lg',
                className,
            )}
        >
            {title && <div className="mb-1 text-12-medium text-fg-secondary">{title}</div>}
            <div className="space-y-0.5">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-center gap-2 text-13-regular">
                        {row.color && (
                            <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                        )}
                        <span className="text-fg-secondary">{row.label}</span>
                        <span className="ml-auto pl-3 tabular-nums text-14-semibold text-fg-primary">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const DAY_MS = 86_400_000;
const DAY_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' });
const MONTH_FORMAT = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });

function day(ms: number) {
    return DAY_FORMAT.format(new Date(ms)).replace('.', '');
}

/** Подпись корзины: «18 нояб», «11–17 нояб» или «ноябрь 2026». */
export function bucketLabel(fromMs: number, bucketMs: number): string {
    if (bucketMs <= DAY_MS) return day(fromMs);
    if (bucketMs >= 28 * DAY_MS) return MONTH_FORMAT.format(new Date(fromMs));
    const start = day(fromMs);
    const end = day(fromMs + bucketMs - DAY_MS);
    const [startDay, startMonth] = start.split(' ');
    const [endDay, endMonth] = end.split(' ');
    return startMonth === endMonth ? `${startDay}–${endDay} ${endMonth}` : `${start} – ${end}`;
}
