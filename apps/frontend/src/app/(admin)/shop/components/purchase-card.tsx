'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CircleCheck, CircleX, CreditCard, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PurchasePaymentInfo } from '../hooks';

interface PurchaseCardProps {
    purchase: {
        id: number;
        title: string;
        tag: string;
        status: string;
        deadline: string | Date;
    };
    payment: PurchasePaymentInfo;
}

export function PurchaseCard({ purchase, payment }: PurchaseCardProps) {
    const isPaid = payment.remaining === 0;
    const deadline = new Date(purchase.deadline);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return (
        <Link href={`/shop/purchase/${purchase.id}`}>
            <Card className={cn(
                'group h-full transition-all hover:shadow-md',
                isPaid ? 'hover:border-success/30' : 'hover:border-primary/30',
            )}>
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <Badge className={purchase.status === 'SUPPLEMENT' ? 'bg-warning-50 text-warning hover:bg-warning-50' : 'bg-success-50 text-success hover:bg-success-50'}>
                                {purchase.status === 'SUPPLEMENT' ? 'Добор' : 'Активна'}
                            </Badge>
                            <h3 className="mt-2 text-lg font-semibold group-hover:text-primary transition-colors">
                                {purchase.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">{purchase.tag}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 text-warning" />
                            <span className={daysLeft <= 3 ? 'font-medium text-warning' : ''}>
                                {daysLeft > 0 ? `${daysLeft} дн.` : 'Скоро'}
                            </span>
                        </div>
                    </div>

                    {/* Payment status */}
                    <div className="mt-4 rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">К оплате</span>
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
                                <span className={cn('font-medium', payment.hasPending ? 'text-warning' : 'text-error')}>
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
                            ) : (
                                <div className="flex items-center gap-1.5 text-error">
                                    <CircleX className="h-4 w-4" />
                                    <span className="text-xs font-medium">Требуется оплата</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button variant={isPaid ? 'outline' : 'default'} className="mt-4 w-full">
                        {isPaid ? 'Перейти' : 'Оплатить'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        </Link>
    );
}
