'use client';

import type { LucideIcon } from 'lucide-react';
import { Boxes, Check, ClipboardList, CreditCard, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { cn } from '@/lib/utils';

interface PurchaseStepperProps {
    currentStatus: PurchaseFulfillmentStatus;
    className?: string;
}

interface Step {
    key: string;
    label: string;
    icon: LucideIcon;
}

const STEPS: Step[] = [
    { key: 'COLLECTION', label: 'Сбор', icon: ClipboardList },
    { key: 'REORDER', label: 'Добор', icon: RefreshCw },
    { key: 'PAYMENT', label: 'Оплата', icon: CreditCard },
    { key: 'SUPPLIER_ASSEMBLY', label: 'Комплектация', icon: Boxes },
    { key: 'TRANSIT', label: 'Доставка', icon: Truck },
    { key: 'READY', label: 'Выдача', icon: PackageCheck },
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
            className={cn('rounded-2xl border border-border bg-bg-card px-4 py-3 sm:px-5', className)}
            aria-label="Прогресс закупки"
        >
            <div className="flex items-center justify-between gap-3">
                <span className="text-11-medium uppercase tracking-wide text-fg-tertiary">
                    Этап закупки
                </span>
                <span className="text-12-regular tabular-nums text-fg-tertiary">
                    Шаг {currentIndex + 1} из {STEPS.length}
                </span>
            </div>
            <div className="overflow-x-auto py-1.5">
                <ol className="flex w-full min-w-[30rem] items-start sm:min-w-0">
                    {STEPS.map((step, idx) => {
                        const isCompleted = idx < currentIndex;
                        const isCurrent = idx === currentIndex;
                        const isReached = idx <= currentIndex;
                        const isFirst = idx === 0;
                        const isLast = idx === STEPS.length - 1;
                        const StepIcon = step.icon;
                        const leftTone = isFirst ? 'bg-transparent' : isReached ? 'bg-primary/50' : 'bg-border-soft';
                        const rightTone = isLast ? 'bg-transparent' : isCompleted ? 'bg-primary/50' : 'bg-border-soft';

                        return (
                            <li
                                key={step.key}
                                className="flex min-w-16 flex-1 flex-col items-center"
                                aria-current={isCurrent ? 'step' : undefined}
                            >
                                <div className="flex w-full items-center self-stretch">
                                    <div className={cn('h-[2px] flex-1 rounded-full transition-colors', leftTone)} />
                                    <div
                                        className={cn(
                                            'relative flex size-7 shrink-0 items-center justify-center',
                                            'rounded-full transition-colors',
                                            isCompleted && 'bg-primary/15 text-primary',
                                            isCurrent &&
                                                'bg-primary text-primary-foreground ring-[3px] ring-primary/15',
                                            !isCompleted &&
                                                !isCurrent &&
                                                'border-[1.5px] border-border-soft bg-bg-card text-fg-tertiary',
                                        )}
                                    >
                                        {isCurrent && (
                                            <span
                                                className={cn(
                                                    'absolute -inset-1 animate-pulse rounded-full',
                                                    'bg-primary/20 motion-reduce:animate-none',
                                                )}
                                                aria-hidden
                                            />
                                        )}
                                        {isCompleted ? (
                                            <Check className="relative size-3.5" strokeWidth={3} />
                                        ) : (
                                            <StepIcon className="relative size-3.5" />
                                        )}
                                    </div>
                                    <div className={cn('h-[2px] flex-1 rounded-full transition-colors', rightTone)} />
                                </div>
                                <span
                                    className={cn(
                                        'mt-1.5 whitespace-nowrap px-1 text-center text-11-medium leading-tight',
                                        'sm:text-12-medium',
                                        isCurrent && 'font-semibold text-fg-primary',
                                        isCompleted && 'text-fg-secondary',
                                        !isCompleted && !isCurrent && 'text-fg-tertiary',
                                    )}
                                >
                                    {step.label}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
