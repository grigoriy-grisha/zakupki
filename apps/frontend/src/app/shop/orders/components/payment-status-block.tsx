'use client';

import { CircleCheck, Clock, CreditCard } from 'lucide-react';

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
    const wrapCls = cn(
        'flex items-center justify-center gap-2 rounded-full border border-border-low bg-bg-card/60',
        compact ? 'min-h-9 px-4 text-13-medium' : 'min-h-12 px-5 text-14-medium',
    );
    const amountCls = 'text-fg-primary tabular-nums';

    if (isFullyPaid) {
        return (
            <div className={wrapCls}>
                <span className="flex items-center gap-1.5 text-success">
                    <CircleCheck className={compact ? 'size-3.5' : 'size-4'} />
                    Оплачено
                </span>
                <span className={cn(amountCls, compact ? 'text-13-semibold' : 'text-14-semibold')}>
                    {formatRub(total)}
                </span>
            </div>
        );
    }

    if (hasPending) {
        return (
            <div className={wrapCls}>
                <span className="flex items-center gap-1.5 text-warning">
                    <Clock className={compact ? 'size-3.5' : 'size-4'} />
                    Ожидает подтверждения
                </span>
                <span className={cn(amountCls, compact ? 'text-13-semibold' : 'text-14-semibold')}>
                    {formatRub(total)}
                </span>
            </div>
        );
    }

    if (isPast) {
        if (remaining === total) {
            return (
                <div className={wrapCls}>
                    <span className="text-fg-secondary">Не оплачено</span>
                </div>
            );
        }
        return (
            <div className={wrapCls}>
                <span className="text-fg-secondary">
                    Оплачено: <span className={amountCls}>{formatRub(total - remaining)}</span>
                </span>
                {remaining > 0 && (
                    <span className="text-12-regular text-fg-tertiary tabular-nums">
                        К оплате было {formatRub(remaining)}
                    </span>
                )}
            </div>
        );
    }

    if (remaining > 0 && paymentOpen) {
        return (
            <div className={wrapCls}>
                {remaining !== total && (
                    <span className="text-fg-secondary">
                        К оплате: <span className={amountCls}>{formatRub(remaining)}</span>
                    </span>
                )}
                <PurchasePaymentDialog
                    purchaseId={purchaseId}
                    remaining={remaining}
                    hasPending={hasPending}
                    paymentOpen={paymentOpen}
                    triggerVariant="link"
                />
            </div>
        );
    }

    if (paymentOpen) {
        return (
            <div className={wrapCls}>
                <span className="text-fg-secondary">
                    Итого: <span className={amountCls}>{formatRub(total)}</span>
                </span>
                {orderCount != null && (
                    <span className="text-12-regular text-fg-tertiary tabular-nums">
                        {orderCount} {orderCount === 1 ? 'позиция' : 'позиции'}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className={cn(wrapCls, 'text-fg-tertiary')}>
            <CreditCard className={compact ? 'size-3.5' : 'size-4'} />
            Ждём начала оплаты
        </div>
    );
}
