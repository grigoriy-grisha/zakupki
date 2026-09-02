'use client';

import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type QuantityStepperSize = 'sm' | 'md' | 'lg';

const STEPPER_SIZES: Record<QuantityStepperSize, { button: string; cell: string; icon: string; wrap: string }> = {
    sm: {
        button: 'size-8 rounded-lg sm:size-9',
        cell: 'px-1 text-12-semibold',
        icon: 'size-3.5',
        wrap: 'gap-1',
    },
    md: {
        button: 'size-10 rounded-xl',
        cell: 'min-w-20 px-2 text-13-semibold',
        icon: 'size-4',
        wrap: 'gap-1.5',
    },
    lg: {
        button: 'size-11 rounded-xl',
        cell: 'px-2 text-14-semibold',
        icon: 'size-4',
        wrap: 'gap-2',
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
                    'flex min-w-0 flex-1 items-center justify-center border border-border bg-bg-base text-fg-primary tabular-nums',
                    s.button,
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
