'use client';

import { Eye } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PAYMENT_STATUS } from '../../../../lib/constants';
import { paymentTotal } from '../../../lib/utils';
import type { PaymentRef } from '../../lib/types';

interface ParticipantPaymentsPanelProps {
    payments: PaymentRef[];
    onPaymentClick: (id: number) => void;
}

export function ParticipantPaymentsPanel({ payments, onPaymentClick }: ParticipantPaymentsPanelProps) {
    return (
        <div className="rounded-2xl border border-border bg-bg-card">
            <div className="border-b border-border-soft px-3 py-2 text-12-medium uppercase tracking-wide text-fg-tertiary">
                Оплаты · {payments.length}
            </div>
            {payments.length === 0 ? (
                <div className="px-3 py-6 text-center text-13-regular text-fg-tertiary">Оплат пока нет</div>
            ) : (
                <div className="divide-y divide-border-soft">
                    {payments.map((p) => {
                        const status = p.status;
                        const cfg = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING;
                        const total = paymentTotal(p);
                        const children = p.children ?? [];
                        const child = children[0];
                        const childAmount = child ? Number(child.amount) : 0;
                        const promoCode = child?.promoCode;
                        const hasProof = Boolean(p.proofObjectKey);
                        return (
                            <Button
                                key={p.id}
                                variant="ghost"
                                size="default"
                                onClick={() => onPaymentClick(p.id)}
                                className={cn(
                                    'h-auto w-full justify-between rounded-none px-3 py-2 text-left',
                                    status === 'PENDING' && 'border-l-2 border-warning',
                                )}
                            >
                                <div className="min-w-0">
                                    <span className="text-14-semibold tabular-nums text-fg-primary">
                                        {total.toLocaleString('ru-RU')} ₽
                                    </span>
                                    {childAmount > 0 && (
                                        <p className="truncate text-12-regular text-fg-tertiary">
                                            {Number(p.amount).toLocaleString('ru-RU')} + промокод{' '}
                                            {promoCode?.code}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {hasProof && <Eye className="size-3.5 text-fg-tertiary" />}
                                    <Badge className={cn('text-12-medium', cfg.className)}>
                                        {cfg.label}
                                    </Badge>
                                </div>
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
