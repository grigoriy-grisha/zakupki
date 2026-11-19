'use client';

import { CircleCheck, CreditCard, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { openExternalUrl } from '@/lib/client/open-external-url';
import { formatRub } from '@/lib/format/money';
import type { PaymentPromoInfo } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';

import { PurchasePaymentDialog } from './purchase-payment-dialog';

interface PaymentStatusBlockProps {
    total: number;
    remaining: number;
    available: number;
    hasPending: boolean;
    isFullyPaid: boolean;
    isPast?: boolean;
    paymentOpen: boolean;
    purchaseId: number;
    pinnedPromo?: PaymentPromoInfo;
    orderCount?: number;
    size?: 'default' | 'compact';
    /** Начатая, но не оплаченная онлайн-оплата: её сумма зарезервирована, предлагаем продолжить. */
    awaitingPayment?: { paymentUrl: string; total: number };
}

export function PaymentStatusBlock({
    total,
    remaining,
    available,
    hasPending,
    isFullyPaid,
    isPast = false,
    paymentOpen,
    purchaseId,
    pinnedPromo,
    orderCount,
    size = 'default',
    awaitingPayment,
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

    if (awaitingPayment && paymentOpen && !isPast) {
        return (
            <div className="flex flex-col gap-2">
                <Button
                    variant="brand"
                    className="w-full rounded-full"
                    onClick={() => openExternalUrl(awaitingPayment.paymentUrl)}
                >
                    <ExternalLink className="size-4" />
                    Продолжить оплату {formatRub(awaitingPayment.total)}
                </Button>
                {available > 0 && (
                    <div className={wrapCls}>
                        <PurchasePaymentDialog
                            purchaseId={purchaseId}
                            remaining={available}
                            due={total}
                            pinnedPromo={pinnedPromo}
                            paymentOpen={paymentOpen}
                            triggerVariant="link"
                        />
                    </div>
                )}
            </div>
        );
    }

    if (hasPending) {
        if (available <= 0 || !paymentOpen) return null;
        return (
            <div className={wrapCls}>
                <PurchasePaymentDialog
                    purchaseId={purchaseId}
                    remaining={available}
                    due={total}
                    pinnedPromo={pinnedPromo}
                    paymentOpen={paymentOpen}
                    triggerVariant="link"
                />
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

    if (available > 0 && paymentOpen) {
        return (
            <div className={wrapCls}>
                {available !== total && (
                    <span className="whitespace-nowrap text-fg-secondary">
                        К оплате: <span className={amountCls}>{formatRub(available)}</span>
                    </span>
                )}
                <PurchasePaymentDialog
                    purchaseId={purchaseId}
                    remaining={available}
                    due={total}
                    pinnedPromo={pinnedPromo}
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
                        {orderCount} {pluralPositions(orderCount)}
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

function pluralPositions(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиция';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиции';
    return 'позиций';
}
