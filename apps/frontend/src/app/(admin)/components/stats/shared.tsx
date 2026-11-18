import type { inferRouterOutputs } from '@trpc/server';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { AppRouter } from '@/server/routers/_app';

export type PurchaseStatsData = inferRouterOutputs<AppRouter>['analytics']['purchase'];

/** Целые рубли: в статистике копейки только мешают читать. */
export function rub(value: number): string {
    return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

/** «1,6 млн», «186,4 тыс» — для подписей на графиках. */
export function rubCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
    if (abs >= 1_000) return `${(value / 1_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс`;
    return Math.round(value).toLocaleString('ru-RU');
}

export function percent(part: number, total: number): string {
    if (total <= 0) return '0%';
    const value = (part / total) * 100;
    return `${value.toLocaleString('ru-RU', { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
}

export function pluralize(count: number, one: string, few: string, many: string): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
}

/** Карточка блока статистики: заголовок, пояснение справа, содержимое. */
export function StatsCard({
    title,
    meta,
    action,
    className,
    children,
}: {
    title: string;
    meta?: ReactNode;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn('flex min-w-0 flex-col gap-4 rounded-2xl bg-bg-soft p-4 sm:p-5', className)}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-16-semibold text-fg-primary">{title}</h3>
                {meta && <span className="text-12-regular text-fg-tertiary">{meta}</span>}
                {action}
            </header>
            {children}
        </section>
    );
}

export function LegendDot({ color, className }: { color: string; className?: string }) {
    return <i className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: color }} />;
}

export function Callout({ children }: { children: ReactNode }) {
    return (
        <p className="rounded-xl bg-bg-surface-elevated/70 px-3 py-2 text-12-regular text-fg-secondary">{children}</p>
    );
}
