'use client';

import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { cn } from '@/lib/utils';

interface PurchaseStepperProps {
    currentStatus: PurchaseFulfillmentStatus;
    className?: string;
}

const STEPS: { key: string; label: string }[] = [
    { key: 'COLLECTION', label: 'Сбор' },
    { key: 'REORDER', label: 'Добор' },
    { key: 'PAYMENT', label: 'Оплата' },
    { key: 'SUPPLIER_ASSEMBLY', label: 'Комплектация' },
    { key: 'TRANSIT', label: 'Доставка' },
    { key: 'READY', label: 'Выдача' },
];

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
            className={cn('rounded-full bg-bg-soft/60 px-4 py-4 sm:px-8', className)}
            aria-label="Прогресс закупки"
        >
            <ol className="flex items-center">
                {STEPS.map((step, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;

                    return (
                        <li key={step.key} className="flex flex-1 items-center last:flex-none">
                            <div className="flex shrink-0 flex-col items-center gap-1.5">
                                <span
                                    aria-current={isCurrent ? 'step' : undefined}
                                    className={cn(
                                        'size-5 rounded-full transition-colors sm:size-9',
                                        isCompleted && 'bg-secondary',
                                        isCurrent && 'border-2 border-secondary',
                                        !isCompleted && !isCurrent && 'bg-fg-secondary',
                                    )}
                                />
                                <span
                                    className={cn(
                                        'hidden whitespace-nowrap text-12-regular sm:block',
                                        isCurrent ? 'text-secondary' : 'text-fg-secondary',
                                    )}
                                >
                                    {step.label}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'mx-2 h-px flex-1 sm:mx-3',
                                        isCompleted ? 'bg-secondary' : 'bg-fg-secondary/40',
                                    )}
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
