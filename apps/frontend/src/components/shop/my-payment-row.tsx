'use client';

import { useState } from 'react';
import { CircleCheck, Clock, CircleX, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MyPaymentProofDialog } from '@/components/shop/my-payment-proof-dialog';
import { paymentHasProof, SHOP_PAYMENT_STATUS, type ShopPaymentView } from '@/components/shop/payment-proof';
import { paymentTotal } from '@/lib/payment-utils';

type MyPaymentRowProps = {
    payment: ShopPaymentView;
    trailing?: React.ReactNode;
};

export function MyPaymentRow({ payment, trailing }: MyPaymentRowProps) {
    const [proofOpen, setProofOpen] = useState(false);
    const status = payment.status;
    const statusCfg = SHOP_PAYMENT_STATUS[status] ?? {
        label: status,
        className: 'text-muted-foreground',
    };
    const StatusIcon = status === 'CONFIRMED' ? CircleCheck : status === 'REJECTED' ? CircleX : Clock;
    const iconCls = statusCfg.className;

    const children = payment.children ?? [];
    const child = children[0];
    const childAmount = child ? Number(child.amount) : 0;
    const promoCode = child?.promoCode;
    const total = paymentTotal(payment);
    const hasProof = paymentHasProof(payment);

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                className={cn(
                    'flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 transition-colors',
                    'cursor-pointer hover:bg-muted/60',
                    status === 'PENDING' && 'ring-1 ring-warning/20',
                )}
                onClick={() => setProofOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setProofOpen(true);
                    }
                }}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <StatusIcon className={cn('h-4 w-4 shrink-0', iconCls)} />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{total.toLocaleString('ru-RU')} ₽</span>
                            <span className={cn('text-xs font-medium', iconCls)}>{statusCfg.label}</span>
                            {hasProof ? (
                                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <Eye className="h-3 w-3" />
                                    чек
                                </span>
                            ) : null}
                        </div>
                        {childAmount > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Оплачено {Number(payment.amount).toLocaleString('ru-RU')} ₽
                                <span className="text-success">
                                    {' '}
                                    + промокод {promoCode?.code ?? ''} {childAmount.toLocaleString('ru-RU')} ₽
                                </span>
                            </p>
                        )}
                    </div>
                </div>
                {trailing ? (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {trailing}
                    </div>
                ) : null}
            </div>
            <MyPaymentProofDialog payment={payment} open={proofOpen} onOpenChange={setProofOpen} />
        </>
    );
}
