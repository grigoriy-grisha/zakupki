import { PURCHASE_FULFILLMENT_LABELS } from '@zakupki/types';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { formatRubShort } from './format';
import type { DashboardSnapshot } from './types';

/** Воронка этапов: сколько открытых закупок сейчас на каждом шаге. */
export function StagePipeline({ stages }: { stages: DashboardSnapshot['stages'] }) {
    return (
        <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
            {stages.map((stage, index) => {
                const active = stage.purchases > 0;
                return (
                    <li
                        key={stage.status}
                        className={cn(
                            'flex min-w-0 flex-col gap-0.5 rounded-xl px-2.5 py-2',
                            active ? 'bg-secondary/12 text-fg-primary' : 'bg-bg-soft text-fg-tertiary',
                        )}
                        title={active ? `${stage.purchases} · ${formatRubShort(stage.due)}` : undefined}
                    >
                        <span className="truncate text-11-medium text-fg-tertiary">
                            {index + 1}. {PURCHASE_FULFILLMENT_LABELS[stage.status]}
                        </span>
                        <span
                            className={cn(
                                'text-20-semibold tabular-nums',
                                active ? 'text-secondary' : 'text-fg-disabled',
                            )}
                        >
                            {stage.purchases}
                        </span>
                        <span className="truncate text-11-regular tabular-nums">
                            {active ? formatRubShort(stage.due) : '—'}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export function StagePipelineSkeleton() {
    return (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
            {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="h-[74px] rounded-xl" />
            ))}
        </div>
    );
}
