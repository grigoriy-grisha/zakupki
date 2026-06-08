'use client';

import { AppLink } from '@/components/app-link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CircleCheck, CircleX, CreditCard, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daysLeftUntil } from '@/lib/utils/date';
import { PURCHASE_FULFILLMENT_LABELS, isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';
import type { ShopMyPurchaseCardProps } from '../lib/types';
import { PaymentActionButton } from './payment-action-button';

export function PurchaseCard({ purchase, payment }: ShopMyPurchaseCardProps) {
    const isDone = purchase.status === 'DONE';
    const isPaid = payment.isFullyPaid;
    const daysLeft = daysLeftUntil(purchase.deadline);
    const fulfillmentStatus = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];
    const paymentOpen = isPurchasePaymentOpen(fulfillmentStatus);

    const statusBadge =
        purchase.status === 'DONE'
            ? { label: 'Завершена', className: 'bg-muted text-muted-foreground hover:bg-muted' }
            : fulfillmentStatus === 'REORDER'
              ? { label: 'Добор', className: 'bg-warning-50 text-warning hover:bg-warning-50' }
              : { label: 'Активна', className: 'bg-success-50 text-success hover:bg-success-50' };

    return (
        <Card
            className={cn(
                'group h-full transition-all hover:shadow-md',
                isPaid ? 'hover:border-success/30' : 'hover:border-primary/30',
            )}
        >
            <CardContent className="p-5">
                <AppLink href={`/shop/purchase/${purchase.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                                <Badge variant="outline" className="font-normal">
                                    <Package className="mr-1 h-3 w-3 shrink-0" />
                                    {fulfillmentLabel}
                                </Badge>
                            </div>
                            <h3 className="mt-2 text-lg font-semibold group-hover:text-primary transition-colors">
                                {purchase.supplier}
                            </h3>
                            <p className="text-sm text-muted-foreground">{purchase.tag}</p>
                        </div>
                        {!isDone && (
                            <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 text-warning" />
                                <span className={daysLeft <= 3 ? 'font-medium text-warning' : ''}>
                                    {daysLeft > 0 ? `${daysLeft} дн.` : 'Скоро'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Сумма заказа</span>
                            <span className="font-medium">{payment.due.toLocaleString('ru-RU')} ₽</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Покрыто</span>
                            <span className={cn('font-medium', isPaid && 'text-success')}>
                                {payment.paid.toLocaleString('ru-RU')} ₽
                            </span>
                        </div>
                        {payment.remaining > 0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Осталось</span>
                                <span
                                    className={cn(
                                        'font-medium',
                                        !paymentOpen
                                            ? 'text-muted-foreground'
                                            : payment.hasPending
                                              ? 'text-warning'
                                              : 'text-error',
                                    )}
                                >
                                    {payment.remaining.toLocaleString('ru-RU')} ₽
                                </span>
                            </div>
                        )}
                        <div className="pt-1">
                            {isPaid ? (
                                <div className="flex items-center gap-1.5 text-success">
                                    <CircleCheck className="h-4 w-4" />
                                    <span className="text-xs font-medium">Полностью покрыто</span>
                                </div>
                            ) : payment.hasPending ? (
                                <div className="flex items-center gap-1.5 text-warning">
                                    <CreditCard className="h-4 w-4" />
                                    <span className="text-xs font-medium">Ожидает подтверждения</span>
                                </div>
                            ) : !paymentOpen ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-xs font-medium">Ждём начала оплаты</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-error">
                                    <CircleX className="h-4 w-4" />
                                    <span className="text-xs font-medium">Требуется оплата</span>
                                </div>
                            )}
                        </div>
                    </div>
                </AppLink>

                <PaymentActionButton
                    purchaseId={purchase.id}
                    remaining={payment.remaining}
                    paymentOpen={paymentOpen}
                    hasPending={payment.hasPending}
                    isPaid={isPaid}
                    isDone={isDone}
                />
            </CardContent>
        </Card>
    );
}
