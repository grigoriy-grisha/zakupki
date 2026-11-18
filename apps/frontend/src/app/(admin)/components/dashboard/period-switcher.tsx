'use client';

import { ANALYTICS_PERIOD_LABELS, ANALYTICS_PERIODS, type AnalyticsPeriod } from '@zakupki/types';

import { cn } from '@/lib/utils';

type PeriodSwitcherProps = {
    value: AnalyticsPeriod;
    onChange: (period: AnalyticsPeriod) => void;
};

export function PeriodSwitcher({ value, onChange }: PeriodSwitcherProps) {
    return (
        <div role="radiogroup" aria-label="Период" className="inline-flex rounded-full bg-bg-soft p-0.5">
            {ANALYTICS_PERIODS.map((period) => {
                const active = period === value;
                return (
                    <button
                        key={period}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(period)}
                        className={cn(
                            'rounded-full px-3 py-1.5 text-13-medium whitespace-nowrap transition-colors',
                            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-secondary',
                            active
                                ? 'bg-bg-surface-elevated text-fg-primary shadow-sm'
                                : 'text-fg-secondary hover:text-fg-primary',
                        )}
                    >
                        {ANALYTICS_PERIOD_LABELS[period]}
                    </button>
                );
            })}
        </div>
    );
}
