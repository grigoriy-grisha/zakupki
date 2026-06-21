import * as React from 'react';

import { cn } from '@/lib/utils';

type StatCardProps = {
    /** Иконка слева от label (опц.) */
    icon?: React.ComponentType<{ className?: string; size?: number | string }>;
    /** Главное значение (число/строка) */
    value: React.ReactNode;
    /** Подпись (RU label) */
    label: React.ReactNode;
    /** Малый текст под value (тренд/доп. инфо) */
    hint?: React.ReactNode;
    /** Цветовой акцент value: neutral | success | warning | critical | primary */
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

/**
 * Компактная карточка метрики: иконка + label (uppercase) + value (text-24-semibold) + hint.
 * Используется в step-полосах админки.
 */
function StatCard({ icon: Icon, value, label, hint, accent = 'neutral', className }: StatCardProps) {
    return (
        <div
            className={cn(
                'rounded-2xl border border-border bg-bg-card p-4 transition-colors hover:border-border-strong',
                className,
            )}
        >
            <div className="flex items-center gap-2">
                {Icon && (
                    <div className="rounded-lg bg-bg-soft p-1.5 text-fg-secondary">
                        <Icon className="size-3.5" />
                    </div>
                )}
                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">{label}</span>
            </div>
            <div className={cn('mt-2 text-24-semibold tabular-nums', accentMap[accent])}>{value}</div>
            {hint && <div className="mt-1 text-12-regular text-fg-tertiary">{hint}</div>}
        </div>
    );
}

export { StatCard };
export type { StatCardProps };
