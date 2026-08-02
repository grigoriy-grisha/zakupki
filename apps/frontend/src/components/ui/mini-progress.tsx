import * as React from 'react';

import { cn } from '@/lib/utils';

interface MiniProgressProps {
    /** Значение 0..100. Вне диапазона clampится. */
    value: number;
    /** Показывать ли числовую подпись справа (по умолчанию true). */
    showLabel?: boolean;
    /** Текст лейбла (если не задан — value + '%'). */
    label?: React.ReactNode;
    /** Цвет полоски: primary | success | warning | critical. */
    tone?: 'primary' | 'success' | 'warning' | 'critical';
    /** Размер: sm (1.5px, w-16) | md (2px, w-24). */
    size?: 'sm' | 'md';
    className?: string;
    title?: string;
}

const toneBarMap = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    critical: 'bg-error',
} as const;

/**
 * Горизонтальная sparkline-полоска прогресса. Используется в колонке «Прогресс» таблицы товаров.
 */
function MiniProgress({
    value,
    showLabel = true,
    label,
    tone = 'primary',
    size = 'sm',
    className,
    title,
}: MiniProgressProps) {
    const clamped = Math.max(0, Math.min(100, value));
    const isEmpty = clamped <= 0;
    return (
        <div className={cn('flex items-center gap-2', className)} title={title}>
            <div
                className={cn(
                    'relative overflow-hidden rounded-full bg-bg-soft',
                    size === 'sm' ? 'h-1.5 w-16' : 'h-2 w-24',
                )}
            >
                <div
                    className={cn(
                        'absolute inset-y-0 left-0 transition-all duration-300',
                        isEmpty ? 'bg-border-strong' : toneBarMap[tone],
                    )}
                    style={{ width: `${clamped}%` }}
                />
            </div>
            {showLabel && (
                <span
                    className={cn(
                        'tabular-nums text-fg-secondary',
                        size === 'sm' ? 'text-12-medium' : 'text-13-medium',
                    )}
                >
                    {label ?? `${Math.round(clamped)}%`}
                </span>
            )}
        </div>
    );
}

export { MiniProgress };
export type { MiniProgressProps };
