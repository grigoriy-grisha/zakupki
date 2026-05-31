'use client';

import {
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_FULFILLMENT_STATUSES,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PurchaseFulfillmentStatusSelectProps {
    value: PurchaseFulfillmentStatus | null | undefined;
    onChange: (value: PurchaseFulfillmentStatus) => void;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
}

export function PurchaseFulfillmentStatusSelect({
    value,
    onChange,
    disabled,
    className,
    triggerClassName,
}: PurchaseFulfillmentStatusSelectProps) {
    const current = value ?? 'COLLECTION';

    return (
        <div className={cn('min-w-[14rem]', className)}>
            <Select
                value={current}
                disabled={disabled}
                onValueChange={(next) => onChange(next as PurchaseFulfillmentStatus)}
            >
                <SelectTrigger className={cn('w-full max-w-md', triggerClassName)}>
                    <SelectValue placeholder="Этап закупки" />
                </SelectTrigger>
                <SelectContent>
                    {PURCHASE_FULFILLMENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                            {PURCHASE_FULFILLMENT_LABELS[status]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function PurchaseFulfillmentStatusLabel({
    status,
    className,
}: {
    status: PurchaseFulfillmentStatus | null | undefined;
    className?: string;
}) {
    if (!status) return null;
    return (
        <span className={cn('text-sm text-muted-foreground', className)}>
            {PURCHASE_FULFILLMENT_LABELS[status]}
        </span>
    );
}
