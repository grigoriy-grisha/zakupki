'use client';

import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type QuantityStepperSize = 'sm' | 'md';

const STEPPER_SIZES: Record<QuantityStepperSize, { button: string; cell: string; icon: string; wrap: string }> = {
    sm: {
        button: 'size-8 rounded-lg sm:size-9',
        cell: 'h-8 rounded-lg px-1 text-12-semibold sm:h-9 sm:rounded-xl',
        icon: 'size-3.5',
        wrap: 'gap-1',
    },
    md: {
        button: 'size-9 rounded-xl',
        cell: 'h-9 min-w-20 rounded-xl px-2 text-13-semibold',
        icon: 'size-3.5',
        wrap: 'gap-1.5',
    },
};

interface QuantityStepperProps {
    value: ReactNode;
    onRemove: () => void;
    onAdd: () => void;
    canRemove?: boolean;
    canAdd?: boolean;
    size?: QuantityStepperSize;
    wrapClassName?: string;
    removeAriaLabel?: string;
    addAriaLabel?: string;
}

export function QuantityStepper({
    value,
    onRemove,
    onAdd,
    canRemove,
    canAdd,
    size = 'md',
    wrapClassName,
    removeAriaLabel,
    addAriaLabel,
}: QuantityStepperProps) {
    const s = STEPPER_SIZES[size];

    return (
        <div className={cn('flex items-stretch', s.wrap, wrapClassName)}>
            <Button
                variant="outline"
                size="icon"
                className={cn('shrink-0', s.button)}
                onClick={onRemove}
                disabled={!canRemove}
                aria-label={removeAriaLabel ?? 'Уменьшить количество'}
            >
                <Minus className={s.icon} />
            </Button>
            <div
                className={cn(
                    'flex min-w-0 flex-auto items-center justify-center border border-border bg-bg-base text-fg-primary tabular-nums',
                    s.cell,
                )}
            >
                {value}
            </div>
            <Button
                variant="brand"
                size="icon"
                className={cn('shrink-0', s.button)}
                onClick={onAdd}
                disabled={!canAdd}
                aria-label={addAriaLabel ?? 'Увеличить количество'}
            >
                <Plus className={s.icon} />
            </Button>
        </div>
    );
}
