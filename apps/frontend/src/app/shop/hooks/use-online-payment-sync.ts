'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';

const POLL_INTERVAL_MS = 10_000;

/**
 * Пока у клиента есть незавершённая онлайн-оплата, сверяет её статус с банком:
 * при открытии страницы, при возврате на вкладку (клиент вернулся с формы банка) и периодически.
 * Страхует от недошедшего уведомления банка — статус обновится и без вебхука.
 */
export function useOnlinePaymentSync(hasAwaiting: boolean): void {
    const utils = trpc.useUtils();
    const inFlight = useRef(false);

    const sync = trpc.payments.syncOnline.useMutation({
        onSuccess: async ({ changed }) => {
            if (changed > 0) {
                await Promise.all([utils.payments.getMyPayments.invalidate(), utils.orders.getMyOrders.invalidate()]);
            }
        },
        onSettled: () => {
            inFlight.current = false;
        },
    });
    const syncRef = useRef(sync.mutate);
    syncRef.current = sync.mutate;

    useEffect(() => {
        if (!hasAwaiting) return;
        const run = () => {
            if (inFlight.current || document.visibilityState !== 'visible') return;
            inFlight.current = true;
            syncRef.current();
        };
        run();
        const timer = window.setInterval(run, POLL_INTERVAL_MS);
        document.addEventListener('visibilitychange', run);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', run);
        };
    }, [hasAwaiting]);
}

/** Сообщение после возврата с формы банка (`?payment=success|fail`), один раз. */
export function usePaymentReturnToast(): void {
    useEffect(() => {
        const url = new URL(window.location.href);
        const result = url.searchParams.get('payment');
        if (result !== 'success' && result !== 'fail') return;
        if (result === 'success') {
            toast.success('Спасибо! Оплата прошла.');
        } else {
            toast.error('Оплата не прошла. Попробуйте ещё раз.');
        }
        url.searchParams.delete('payment');
        window.history.replaceState(window.history.state, '', url.toString());
    }, []);
}
