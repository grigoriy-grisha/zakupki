import type { LucideIcon } from 'lucide-react';

import { percent, StatsCard } from '../../../components/stats/shared';

export type ShareItem = { key: string; label: string; value: number; color: string; icon?: LucideIcon };

/** Доли одной величины: подпись, полоска, число и процент. */
export function ShareList({
    title,
    meta,
    items,
    empty,
}: {
    title: string;
    meta?: string;
    items: ShareItem[];
    empty?: string;
}) {
    const total = items.reduce((acc, item) => acc + item.value, 0);
    const max = Math.max(1, ...items.map((item) => item.value));

    return (
        <StatsCard title={title} meta={meta}>
            {total === 0 ? (
                <p className="text-14-regular text-fg-tertiary">{empty ?? 'Данных пока нет'}</p>
            ) : (
                <ul className="space-y-3">
                    {items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.key} className="space-y-1.5" title={`${item.label}: ${item.value}`}>
                                <div className="flex items-center gap-2 text-14-regular">
                                    {Icon && <Icon className="size-4 shrink-0 text-fg-tertiary" aria-hidden />}
                                    <span className="text-fg-primary">{item.label}</span>
                                    <span className="ml-auto tabular-nums text-14-semibold text-fg-primary">
                                        {item.value.toLocaleString('ru-RU')}
                                    </span>
                                    <span className="w-11 text-right tabular-nums text-12-regular text-fg-tertiary">
                                        {percent(item.value, total)}
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-border-low">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${(item.value / max) * 100}%`, background: item.color }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </StatsCard>
    );
}
