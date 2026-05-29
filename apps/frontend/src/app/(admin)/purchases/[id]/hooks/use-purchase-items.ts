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

export function useRemovePurchaseItem(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.removeItem.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Товар удалён из закупки');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useActivateAndPublish(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.activateAndPublish.useMutation({
        onSuccess: (data) => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success(`Закупка активирована. ${data.queued} товаров опубликовано.`);
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useCompletePurchase(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.complete.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.purchases.list.invalidate();
            toast.success('Закупка завершена');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useDeleteDraftPurchase() {
    const utils = trpc.useUtils();

    return trpc.purchases.deleteDraft.useMutation({
        onSuccess: () => {
            void utils.purchases.list.invalidate();
            toast.success('Черновик удалён');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useToggleShouldPublish(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.toggleShouldPublish.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
    });
}
