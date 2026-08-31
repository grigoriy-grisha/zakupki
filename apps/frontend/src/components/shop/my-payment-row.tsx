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
        className: 'text-fg-tertiary',
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
                    'flex items-center justify-between gap-2 rounded-xl bg-bg-soft/50 px-3 py-2.5',
                    'cursor-pointer transition-colors hover:bg-bg-soft',
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
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <StatusIcon className={cn('size-4 shrink-0', iconCls)} />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-14-semibold text-fg-primary tabular-nums">
                                {total.toLocaleString('ru-RU')} ₽
                            </span>
                            <span className={cn('text-12-medium', iconCls)}>{statusCfg.label}</span>
                            {hasProof ? (
                                <span className="inline-flex items-center gap-0.5 text-12-regular text-fg-tertiary">
                                    <Eye className="size-3" />
                                    чек
                                </span>
                            ) : null}
                        </div>
                        {childAmount > 0 && (
                            <p className="mt-0.5 text-12-regular text-fg-tertiary tabular-nums">
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
