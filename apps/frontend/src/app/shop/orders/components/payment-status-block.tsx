'use client';

import { CircleCheck, Clock, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatRub } from '@/lib/format/money';
import { cn } from '@/lib/utils';

import { PurchasePaymentDialog } from './purchase-payment-dialog';

interface PaymentStatusBlockProps {
    total: number;
    remaining: number;
    hasPending: boolean;
    isFullyPaid: boolean;
    isPast?: boolean;
    paymentOpen: boolean;
    purchaseId: number;
    orderCount?: number;
    size?: 'default' | 'compact';
}

export function PaymentStatusBlock({
    total,
    remaining,
    hasPending,
    isFullyPaid,
    isPast = false,
    paymentOpen,
    purchaseId,
    orderCount,
    size = 'default',
}: PaymentStatusBlockProps) {
    const compact = size === 'compact';
    const wrapCls = compact
        ? 'rounded-lg bg-bg-soft/60 p-2 text-12-regular'
        : 'rounded-xl bg-bg-soft/60 p-3 text-14-regular';
    const amountCls = cn('text-fg-primary tabular-nums', compact ? 'text-13-semibold' : 'text-14-semibold');
    const labelCls = compact ? 'text-12-medium' : 'text-14-medium';
    const hintCls = 'text-12-regular text-fg-tertiary tabular-nums';

    if (isFullyPaid) {
        return (
            <div className={wrapCls}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-success">
                        <CircleCheck className={compact ? 'size-3.5' : 'size-4'} />
                        <span className={labelCls}>Оплачено</span>
                    </div>
                    <span className={amountCls}>{formatRub(total)}</span>
                </div>
            </div>
        );
    }

    if (hasPending) {
        return (
            <div className={wrapCls}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-warning">
                        <Clock className={compact ? 'size-3.5' : 'size-4'} />
                        <span className={labelCls}>Ожидает подтверждения</span>
                    </div>
                    <span className={amountCls}>{formatRub(total)}</span>
                </div>
            </div>
        );
    }

    if (isPast) {
        return (
            <div className={wrapCls}>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <span className="text-fg-secondary">
                        Итого: <span className={amountCls}>{formatRub(total)}</span>
                    </span>
                    {remaining > 0 && <span className={hintCls}>К оплате было {formatRub(remaining)}</span>}
                </div>
            </div>
        );
    }

    if (remaining > 0 && paymentOpen) {
        return (
            <div className={wrapCls}>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-fg-secondary">
                        К оплате: <span className={amountCls}>{formatRub(remaining)}</span>
                    </span>
                    <PurchasePaymentDialog
                        purchaseId={purchaseId}
                        remaining={remaining}
                        hasPending={hasPending}
                        paymentOpen={paymentOpen}
                        triggerVariant="link"
                    />
                </div>
            </div>
        );
    }

    if (paymentOpen) {
        return (
            <div className={wrapCls}>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <span className="text-fg-secondary">
                        Итого: <span className={amountCls}>{formatRub(total)}</span>
                    </span>
                    {orderCount != null && (
                        <span className={hintCls}>
                            {orderCount} {orderCount === 1 ? 'позиция' : 'позиции'}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={wrapCls}>
            <div className="flex flex-col gap-1.5">
                <span className={amountCls}>{formatRub(total)}</span>
                <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    className="h-8 w-full cursor-not-allowed gap-1 px-3 text-12-medium"
                >
                    <CreditCard className="size-3" />
                    Ждём начала оплаты
                </Button>
            </div>
        </div>
    );
}
