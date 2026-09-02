import * as React from 'react';

import { cn } from '@/lib/utils';

type StatCardProps = {
    icon?: React.ComponentType<{ className?: string; size?: number | string }>;
    value: React.ReactNode;
    label: React.ReactNode;
    hint?: React.ReactNode;
    accent?: 'neutral' | 'success' | 'warning' | 'critical' | 'primary';
    className?: string;
};

const accentMap = {
    neutral: 'text-fg-primary',
    success: 'text-success',
    warning: 'text-warning',
    critical: 'text-error',
    primary: 'text-primary',
} as const;

function StatCard({ icon: Icon, value, label, hint, accent = 'neutral', className }: StatCardProps) {
    return (
        <div className={cn('rounded-2xl bg-bg-soft p-4', className)}>
            <div className="flex items-center gap-2">
                {Icon && (
                    <div className="rounded-full bg-secondary/10 p-1.5 text-secondary">
                        <Icon className="size-3.5" />
                    </div>
                )}
                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">{label}</span>
            </div>
            <div className={cn('mt-2 text-24-medium tabular-nums', accentMap[accent])}>{value}</div>
            {hint && <div className="mt-1 text-12-regular text-fg-tertiary">{hint}</div>}
        </div>
    );
}

export { StatCard };
export type { StatCardProps };
