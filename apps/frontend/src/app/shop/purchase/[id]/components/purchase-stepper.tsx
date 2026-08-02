'use client';

import { Check } from 'lucide-react';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { cn } from '@/lib/utils';

interface PurchaseStepperProps {
    currentStatus: PurchaseFulfillmentStatus;
    deadline?: string | Date | null;
    className?: string;
}

interface Step {
    key: string;
    label: string;
}

const STEPS: Step[] = [
    { key: 'COLLECTION', label: 'Сбор' },
    { key: 'REORDER', label: 'Добор' },
    { key: 'PAYMENT', label: 'Оплата' },
    { key: 'SUPPLIER_ASSEMBLY', label: 'Комплектация' },
    { key: 'TRANSIT', label: 'Доставка' },
    { key: 'READY', label: 'Выдача' },
];

/** Маппинг PurchaseFulfillmentStatus → индекс шага 0..5. */
function getStepIndex(status: PurchaseFulfillmentStatus): number {
    switch (status) {
        case 'COLLECTION':
            return 0;
        case 'REORDER':
            return 1;
        case 'PAYMENT':
            return 2;
        case 'SUPPLIER_ASSEMBLY':
            return 3;
        case 'PREPARING_SHIPMENT_RF':
        case 'IN_TRANSIT_RF':
        case 'IN_TRANSIT_TO_ORGANIZER':
            return 4;
        case 'PACKAGING':
        case 'READY_FOR_PICKUP':
            return 5;
        default:
            return 0;
    }
}

export function PurchaseStepper({ currentStatus, className }: PurchaseStepperProps) {
    const currentIndex = getStepIndex(currentStatus);

    return (
        <div
            className={cn('rounded-2xl border border-border bg-bg-card px-4 py-3 sm:px-5 sm:py-3.5', className)}
            aria-label="Прогресс закупки"
        >
            <div className="-mx-1 overflow-x-auto px-1">
                <ol className="flex min-w-max items-center">
                    {STEPS.map((step, idx) => {
                        const isCompleted = idx < currentIndex;
                        const isCurrent = idx === currentIndex;
                        const isLast = idx === STEPS.length - 1;

                        return (
                            <li
                                key={step.key}
                                className="flex flex-1 items-center"
                                aria-current={isCurrent ? 'step' : undefined}
                            >
                                <div className="flex shrink-0 flex-col items-center gap-1">
                                    <div
                                        className={cn(
                                            'flex size-6 items-center justify-center rounded-full border-[1.5px] transition-colors sm:size-7',
                                            isCompleted && 'border-primary bg-primary text-white',
                                            isCurrent && 'border-primary bg-bg-card text-primary ring-4 ring-primary/15',
                                            !isCompleted &&
                                                !isCurrent &&
                                                'border-border bg-bg-card text-fg-disabled',
                                        )}
                                    >
                                        {isCompleted ? (
                                            <Check className="size-3 sm:size-3.5" strokeWidth={3} />
                                        ) : (
                                            <span
                                                className={cn(
                                                    'text-11-medium tabular-nums',
                                                    isCurrent ? 'text-primary' : 'text-fg-disabled',
                                                )}
                                            >
                                                {idx + 1}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            'text-11-medium whitespace-nowrap sm:text-12-medium',
                                            isCurrent && 'text-fg-primary',
                                            isCompleted && 'text-fg-secondary',
                                            !isCompleted && !isCurrent && 'text-fg-disabled',
                                        )}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                                {!isLast && (
                                    <div
                                        className={cn(
                                            'mx-1.5 h-px flex-1 sm:mx-2',
                                            idx < currentIndex ? 'bg-primary' : 'bg-border-soft',
                                        )}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
