'use client';

import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

export function useAddPurchaseItems(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.addItems.useMutation({
        onSuccess: (data) => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Товары добавлены');

            const queued = data?.tgPublish?.queued ?? 0;
            if (queued > 0) {
                toast.success(
                    queued === 1
                        ? 'Товар в очереди на публикацию в Telegram'
                        : `${queued} товаров в очереди на публикацию в Telegram`,
                );
            }
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useRemovePurchaseItem(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.removeItem.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.orders.getAllByPurchase.invalidate({ purchaseId });
            void utils.purchases.list.invalidate();
            toast.success('Товар удалён из закупки');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function usePublishItemToTg(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.publishItemToTg.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('В очереди на публикацию в Telegram');
        },
        onError: (err) => toast.error(err.message),
    });
}
