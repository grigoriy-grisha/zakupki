'use client';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentActionButtonProps {
    purchaseId: number;
    remaining: number;
    paymentOpen: boolean;
    hasPending: boolean;
    isPaid: boolean;
    isDone?: boolean;
    /** На карточке списка — кнопка-ссылка; в диалоге — только триггер оплаты */
    variant?: 'card' | 'inline';
    onOpenDialog?: () => void;
    className?: string;
}

export function PaymentActionButton({
    purchaseId,
    remaining,
    paymentOpen,
    hasPending,
    isPaid,
    isDone = false,
    variant = 'card',
    onOpenDialog,
    className,
}: PaymentActionButtonProps) {
    const showPayCta = !isPaid && !isDone && remaining > 0;

    if (showPayCta && !paymentOpen) {
        return (
            <div className={cn('relative mt-4 w-full', className)}>
                <Button variant="default" disabled className="w-full blur-[3px] opacity-50 pointer-events-none">
                    <CreditCard className="h-4 w-4" />
                    Оплатить {remaining.toLocaleString('ru-RU')} ₽
                </Button>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
                    <span className="rounded-md bg-background/90 px-2 py-1 text-center text-xs font-medium text-muted-foreground shadow-sm">
                        Ждём начала оплаты
                    </span>
                </div>
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <Button
                size="sm"
                className={cn('w-full', className)}
                disabled={hasPending || !paymentOpen}
                onClick={onOpenDialog}
            >
                <CreditCard className="h-4 w-4" />
                {hasPending ? 'Ожидает подтверждения' : `Оплатить ${remaining.toLocaleString('ru-RU')} ₽`}
            </Button>
        );
    }

    if (isPaid || isDone || !showPayCta) {
        return (
            <Button variant="outline" className={cn('mt-4 w-full', className)} asChild>
                <AppLink href={`/shop/purchase/${purchaseId}`}>
                    Перейти
                    <ArrowRight className="ml-2 h-4 w-4" />
                </AppLink>
            </Button>
        );
    }

    return (
        <Button variant="default" className={cn('mt-4 w-full', className)} asChild>
            <AppLink href={`/shop/purchase/${purchaseId}`}>
                {hasPending ? 'Ожидает подтверждения' : `Оплатить ${remaining.toLocaleString('ru-RU')} ₽`}
                <ArrowRight className="ml-2 h-4 w-4" />
            </AppLink>
        </Button>
    );
}
