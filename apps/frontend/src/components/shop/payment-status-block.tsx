'use client';

import { CircleCheck, Clock, CreditCard } from 'lucide-react';
import { PurchasePaymentDialog } from '@/components/shop/purchase-payment-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaymentStatusBlockProps {
    /** Итого к оплате (сумма всех orderLine) */
    total: number;
    /** Сколько осталось оплатить (без учёта pending) */
    remaining: number;
    hasPending: boolean;
    isFullyPaid: boolean;
    /** Завершённая закупка — показываем «К оплате было» */
    isPast?: boolean;
    /** Этап оплаты открыт (PAYMENT+) */
    paymentOpen: boolean;
    purchaseId: number;
    /** Кол-во позиций (для варианта «Итого N позиций») */
    orderCount?: number;
    /** Compact = корзина, default = orders page */
    size?: 'default' | 'compact';
}

/**
 * Единый компонент для отображения статуса оплаты.
 *
 * 6 состояний:
 * 1. isFullyPaid → «Оплачено» (зелёный)
 * 2. hasPending → «Ожидает подтверждения» (жёлтый)
 * 3. isPast → «Итого» + «К оплате было X₽» (серый)
 * 4. remaining > 0 && paymentOpen → «К оплате» + кнопка оплатить
 * 5. paymentOpen → «Итого» + кол-во позиций
 * 6. else → сумма + «Ждём начала оплаты» (disabled)
 */
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
    const wrapCls = compact ? 'rounded-lg bg-muted/50 p-2 text-xs' : 'rounded-lg bg-muted/50 p-3 text-sm';

    if (isFullyPaid) {
        return (
            <div className={wrapCls}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-success">
                        <CircleCheck className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                        <span className="font-medium">Оплачено</span>
                    </div>
                    <span className="font-semibold">{total.toLocaleString('ru-RU')} ₽</span>
                </div>
            </div>
        );
    }

    if (hasPending) {
        return (
            <div className={wrapCls}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-warning">
                        <Clock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                        <span className="font-medium">Ожидает подтверждения</span>
                    </div>
                    <span className="font-semibold">{total.toLocaleString('ru-RU')} ₽</span>
                </div>
            </div>
        );
    }

    if (isPast) {
        return (
            <div className={wrapCls}>
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                        Итого: <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                    </span>
                    {remaining > 0 && (
                        <span className="text-xs text-muted-foreground">
                            К оплате было {remaining.toLocaleString('ru-RU')} ₽
                        </span>
                    )}
                </div>
            </div>
        );
    }

    if (remaining > 0 && paymentOpen) {
        return (
            <div className={wrapCls}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span>
                            К оплате:{' '}
                            <span className="font-medium text-foreground">{remaining.toLocaleString('ru-RU')} ₽</span>
                        </span>
                    </div>
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
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                        Итого: <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                    </span>
                    {orderCount != null && (
                        <span className="text-xs text-muted-foreground">
                            {orderCount} {orderCount === 1 ? 'позиция' : 'позиции'}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Не открыт этап оплаты
    return (
        <div className={wrapCls}>
            <div>
                <span className="font-medium text-foreground">{total.toLocaleString('ru-RU')} ₽</span>
                <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    className={cn(
                        'mt-1 h-auto w-full cursor-not-allowed gap-1 px-3 text-12-medium',
                        compact ? 'py-1.5' : 'py-1.5',
                    )}
                >
                    <CreditCard className="size-3" />
                    Ждём начала оплаты
                </Button>
            </div>
        </div>
    );
}
