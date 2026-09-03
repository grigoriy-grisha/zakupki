'use client';

import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function usePurchaseActions(purchaseId: number) {
    const utils = trpc.useUtils();

    const invalidatePurchase = () => {
        void utils.purchases.getById.invalidate({ id: purchaseId });
        void utils.purchases.list.invalidate();
    };

    const activate = trpc.purchases.activate.useMutation(
        mutationOptions({ invalidate: invalidatePurchase, success: 'Закупка активирована' }),
    );

    const complete = trpc.purchases.complete.useMutation(
        mutationOptions({ invalidate: invalidatePurchase, success: 'Закупка завершена' }),
    );

    const deleteDraft = trpc.purchases.deleteDraft.useMutation(
        mutationOptions({
            invalidate: () => void utils.purchases.list.invalidate(),
            success: 'Черновик удалён',
        }),
    );

    const softDelete = trpc.purchases.softDelete.useMutation(
        mutationOptions({
            invalidate: invalidatePurchase,
            success: 'Закупка удалена',
        }),
    );

    const publishAll = trpc.purchases.publishToTelegram.useMutation({
        onSuccess: (data) => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            if (data.queued > 0) {
                toast.success(
                    data.queued === 1
                        ? '1 товар в очереди на публикацию в Telegram'
                        : `${data.queued} товаров в очереди на публикацию в Telegram`,
                );
            } else {
                toast.message('Нет товаров для публикации', {
                    description: 'Отметьте галочкой товары, которые нужно опубликовать',
                });
            }
        },
        onError: (err) => toast.error(err.message),
    });

    const updateFulfillmentStatus = trpc.purchases.updateFulfillmentStatus.useMutation(
        mutationOptions({ invalidate: invalidatePurchase, success: 'Этап закупки обновлён' }),
    );

    const setAvailableQuantities = trpc.purchases.setAvailableQuantities.useMutation(
        mutationOptions({
            invalidate: () => void utils.purchases.getById.invalidate({ id: purchaseId }),
            success: 'Остатки обновлены',
        }),
    );

    return {
        activate,
        complete,
        deleteDraft,
        softDelete,
        publishAll,
        updateFulfillmentStatus,
        setAvailableQuantities,
    };
}
