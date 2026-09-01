'use client';

import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { useEffect, useRef } from 'react';

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
    const currentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        currentRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }, [currentIndex]);

    return (
        <div
            className={cn(
                'rounded-full bg-bg-soft/60 px-4 py-4',
                'sm:bg-bg-soft sm:px-20 sm:py-4',
                className,
            )}
            aria-label="Прогресс закупки"
        >
            <ol className="flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible">
                {STEPS.map((step, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;

                    return (
                        <li key={step.key} className="flex items-center sm:flex-1 sm:last:flex-none">
                            <div
                                ref={isCurrent ? currentRef : undefined}
                                className="flex shrink-0 items-center gap-1.5 sm:flex-col sm:gap-2"
                            >
                                <span
                                    aria-current={isCurrent ? 'step' : undefined}
                                    className={cn(
                                        'size-5 rounded-full transition-colors sm:size-10',
                                        isCompleted && 'bg-secondary',
                                        isCurrent && 'border-2 border-secondary',
                                        !isCompleted && !isCurrent && 'bg-fg-secondary',
                                    )}
                                />
                                <span
                                    className={cn(
                                        'whitespace-nowrap sm:text-18-regular',
                                        isCurrent
                                            ? 'text-12-medium text-secondary sm:text-fg-primary'
                                            : 'text-12-regular text-fg-secondary',
                                    )}
                                >
                                    {step.label}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'mx-2 h-px w-6 shrink-0 sm:mx-3 sm:mt-[19px] sm:h-0.5 sm:w-auto sm:flex-1 sm:self-start',
                                        isCompleted
                                            ? 'bg-secondary'
                                            : 'bg-fg-secondary/40 sm:bg-fg-secondary',
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
