'use client';

import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { useCallback } from 'react';

export function usePurchaseActions(purchaseId: number) {
    const utils = trpc.useUtils();

    const activate = trpc.purchases.activate.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.purchases.list.invalidate();
            toast.success('Закупка активирована');
        },
        onError: (err) => toast.error(err.message),
    });

    const complete = trpc.purchases.complete.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.purchases.list.invalidate();
            toast.success('Закупка завершена');
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteDraft = trpc.purchases.deleteDraft.useMutation({
        onSuccess: () => {
            void utils.purchases.list.invalidate();
            toast.success('Черновик удалён');
        },
        onError: (err) => toast.error(err.message),
    });

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

    const updateFulfillmentStatus = trpc.purchases.updateFulfillmentStatus.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.purchases.list.invalidate();
            toast.success('Этап закупки обновлён');
        },
        onError: (err) => toast.error(err.message),
    });

    const publishItem = trpc.purchases.publishItemToTg.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('В очереди на публикацию в Telegram');
        },
        onError: (err) => toast.error(err.message),
    });

    const removeItem = trpc.purchases.removeItem.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.orders.getAllByPurchase.invalidate({ purchaseId });
            void utils.purchases.list.invalidate();
            toast.success('Товар удалён из закупки');
        },
        onError: (err) => toast.error(err.message),
    });

    const setPublicationState = trpc.purchases.toggleShouldPublish.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const setTargetRemainder = trpc.purchases.setAvailableQuantities.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Остатки обновлены');
        },
        onError: (err) => toast.error(err.message),
    });

    return {
        activate: {
            mutate: (vars: { purchaseId: number }) => activate.mutate(vars),
            isPending: activate.isPending,
        },
        complete: {
            mutate: (vars: { id: number }) => complete.mutate(vars),
            isPending: complete.isPending,
        },
        deleteDraft: {
            mutate: (vars: { id: number }) => deleteDraft.mutate(vars),
            isPending: deleteDraft.isPending,
        },
        publishAll: {
            mutate: (vars: { purchaseId: number }) => publishAll.mutate(vars),
            isPending: publishAll.isPending,
        },
        updateFulfillmentStatus: {
            mutate: (vars: { id: number; fulfillmentStatus: import('@zakupki/types').PurchaseFulfillmentStatus }) =>
                updateFulfillmentStatus.mutate(vars as any),
            isPending: updateFulfillmentStatus.isPending,
        },
        publishItem: {
            mutate: (vars: { purchaseItemId: number }) => publishItem.mutate(vars),
            isPending: publishItem.isPending,
        },
        removeItem: {
            mutate: (vars: { purchaseItemId: number }) => removeItem.mutate(vars),
            isPending: removeItem.isPending,
        },
        setPublicationState: {
            mutate: (vars: { purchaseItemId: number; value: boolean }) => setPublicationState.mutate(vars),
            isPending: setPublicationState.isPending,
        },
        setTargetRemainder: {
            mutate: (vars: { purchaseId: number; items: { purchaseItemId: number; targetRemainder: number | null }[] }) =>
                setTargetRemainder.mutate(vars),
            isPending: setTargetRemainder.isPending,
        },
    };
}