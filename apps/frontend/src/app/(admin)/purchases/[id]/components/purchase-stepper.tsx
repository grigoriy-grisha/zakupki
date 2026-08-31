'use client';

import { CheckIcon } from 'lucide-react';
import { PURCHASE_FULFILLMENT_LABELS, PURCHASE_FULFILLMENT_STATUSES, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { cn } from '@/lib/utils';

interface PurchaseStepperProps {
    currentStatus: PurchaseFulfillmentStatus | null;
}

const SHORT_LABELS: Record<PurchaseFulfillmentStatus, string> = {
    COLLECTION: 'Сбор',
    REORDER: 'Добор',
    PAYMENT: 'Оплата',
    SUPPLIER_ASSEMBLY: 'Сборка',
    PREPARING_SHIPMENT_RF: 'Отправ.',
    IN_TRANSIT_RF: 'В пути',
    IN_TRANSIT_TO_ORGANIZER: 'До орг.',
    PACKAGING: 'Фасовка',
    READY_FOR_PICKUP: 'Выдача',
};

/**
 * Горизонтальный step-трекер этапов закупки (как трекинг «Почта России»).
 * Текущий шаг подсвечен, пройденные с галочкой, будущие — outline.
 */
export function PurchaseStepper({ currentStatus }: PurchaseStepperProps) {
    const currentIdx = currentStatus
        ? PURCHASE_FULFILLMENT_STATUSES.indexOf(currentStatus)
        : -1;

    return (
        <ol className="flex w-full items-start overflow-x-auto rounded-2xl border border-border bg-bg-card px-3 py-4 sm:px-5">
            {PURCHASE_FULFILLMENT_STATUSES.map((status, idx) => {
                const isCompleted = currentIdx >= 0 && idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isFuture = currentIdx < 0 || idx > currentIdx;
                const isFirst = idx === 0;
                const isLast = idx === PURCHASE_FULFILLMENT_STATUSES.length - 1;
                const label = SHORT_LABELS[status];
                const fullLabel = PURCHASE_FULFILLMENT_LABELS[status];
                return (
                    <li
                        key={status}
                        className="flex min-w-[60px] flex-1 flex-col items-center"
                        title={fullLabel}
                    >
                        <div className="flex w-full items-center">
                            <div
                                className={cn(
                                    'h-px flex-1',
                                    isFirst
                                        ? 'bg-transparent'
                                        : isCompleted || isCurrent
                                          ? 'bg-primary'
                                          : 'bg-border-low',
                                )}
                            />
                            <div
                                className={cn(
                                    'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all',
                                    isCompleted && 'bg-primary/15 text-primary',
                                    isCurrent &&
                                        'bg-primary text-primary-foreground ring-4 ring-primary/15',
                                    isFuture && 'border-2 border-border-low bg-bg-card text-fg-tertiary',
                                )}
                            >
                                {isCurrent && (
                                    <span
                                        className="absolute -inset-1 animate-pulse rounded-full bg-primary/20 motion-reduce:animate-none"
                                        aria-hidden
                                    />
                                )}
                                {isCompleted ? (
                                    <CheckIcon className="relative size-3.5" />
                                ) : (
                                    <span className="relative text-12-medium tabular-nums">{idx + 1}</span>
                                )}
                            </div>
                            <div
                                className={cn(
                                    'h-px flex-1',
                                    isLast
                                        ? 'bg-transparent'
                                        : isCompleted
                                          ? 'bg-primary'
                                          : 'bg-border-low',
                                )}
                            />
                        </div>
                        <span
                            className={cn(
                                'mt-2 px-1 text-center text-12-medium leading-tight',
                                isCurrent && 'text-fg-primary font-semibold',
                                isCompleted && 'text-fg-primary',
                                isFuture && 'text-fg-tertiary',
                            )}
                        >
                            {label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
