'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CircleCheck, Clock, CircleX, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';
import type { usePurchasePaymentDetail } from '../../../hooks';

type PaymentDetail = ReturnType<typeof usePurchasePaymentDetail>;

interface OrdersSummaryCardProps {
    paymentDetail: PaymentDetail;
    paymentDialog: React.ReactNode;
}

export function OrdersSummaryCard({ paymentDetail, paymentDialog }: OrdersSummaryCardProps) {
    const {
        myOrdersInPurchase,
        totalDue,
        purchasePayments,
        hasPending,
        totalPaid,
        remaining,
    } = paymentDetail;

    return (
        <Card>
            <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Ваши заказы</h3>

                <div className="space-y-2">
                    {myOrdersInPurchase.map((order) => (
                        <div key={order.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                            <span className="text-sm">{order.purchaseItem?.product?.name}</span>
                            <span className="text-sm font-medium">
                                {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                {order.purchaseItem?.product?.unit?.shortName ?? ''} · {Number(order.amountDue).toLocaleString('ru-RU')} ₽
                            </span>
                        </div>
                    ))}
                </div>

                {/* Payment balance */}
                <div className="rounded-xl border p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground">К оплате</p>
                            <p className="text-lg font-bold">{totalDue.toLocaleString('ru-RU')} ₽</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Покрыто</p>
                            <p className="text-lg font-bold text-success">{totalPaid.toLocaleString('ru-RU')} ₽</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Осталось</p>
                            <p className={cn('text-lg font-bold', remaining > 0 ? 'text-warning' : 'text-success')}>
                                {remaining.toLocaleString('ru-RU')} ₽
                            </p>
                        </div>
                    </div>

                    {/* Existing payments list */}
                    {purchasePayments.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                            {purchasePayments.map((p) => (
                                <PaymentRow key={p.id} payment={p} />
                            ))}
                        </div>
                    )}

                    {/* Pay button or fully paid */}
                    {remaining > 0 && paymentDialog}
                    {remaining <= 0 && purchasePayments.length > 0 && (
                        <div className="flex items-center justify-center gap-2 rounded-lg bg-success-50 py-2 text-success">
                            <CircleCheck className="h-4 w-4" />
                            <span className="text-sm font-medium">Полностью оплачено</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function PaymentRow({ payment }: { payment: any }) {
    const status = payment.status as string;
    const children = (payment.children ?? []) as { amount: unknown; promoCode: { code: string } | null }[];
    const child = children[0];
    const childAmount = child ? Number(child.amount) : 0;
    const promoCode = child?.promoCode;

    const statusCfg = {
        PENDING: { label: 'Ожидает проверки', icon: Clock, cls: 'text-warning' },
        CONFIRMED: { label: 'Подтверждено', icon: CircleCheck, cls: 'text-success' },
        REJECTED: { label: 'Отклонено', icon: CircleX, cls: 'text-error' },
    }[status] ?? { label: status, icon: AlertCircle, cls: 'text-muted-foreground' };
    const StatusIcon = statusCfg.icon;

    return (
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
                <StatusIcon className={cn('h-4 w-4', statusCfg.cls)} />
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                            {(Number(payment.amount) + childAmount).toLocaleString('ru-RU')} ₽
                        </span>
                        <span className={cn('text-xs font-medium', statusCfg.cls)}>{statusCfg.label}</span>
                    </div>
                    {childAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Оплачено {Number(payment.amount).toLocaleString('ru-RU')} ₽
                            <span className="text-success"> + промокод {promoCode?.code ?? ''} {childAmount.toLocaleString('ru-RU')} ₽</span>
                        </p>
                    )}
                </div>
            </div>
            {status === 'PENDING' && <CancelPaymentButton paymentId={payment.id} />}
        </div>
    );
}

function CancelPaymentButton({ paymentId }: { paymentId: number }) {
    const utils = trpc.useUtils();
    const mutation = trpc.payments.cancel.useMutation({
        onSuccess: () => {
            void utils.payments.getMyPayments.invalidate();
            void utils.orders.getMyOrders.invalidate();
            toast.success('Оплата отменена');
        },
        onError: (err) => toast.error(err.message),
    });

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => mutation.mutate({ id: paymentId })}
            disabled={mutation.isPending}
        >
            <Trash2 className="h-3 w-3" />
            Отменить
        </Button>
    );
}
