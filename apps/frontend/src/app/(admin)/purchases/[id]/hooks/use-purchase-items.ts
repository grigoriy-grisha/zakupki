'use client';

import { useMutation } from '@tanstack/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';
import type { AppRouter } from '@/server/routers/_app';

type AddItemsInput = inferRouterInputs<AppRouter>['purchases']['addItems'];
type AddItemsOutput = inferRouterOutputs<AppRouter>['purchases']['addItems'];

export function useAddPurchaseItems(purchaseId: number) {
    const utils = trpc.useUtils();

    return useMutation<AddItemsOutput, Error, AddItemsInput>({
        mutationFn: (input) => utils.client.purchases.addItems.mutate(input),
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

    // @ts-ignore TS2589 deep instantiation on removeItem.useMutation
    return trpc.purchases.removeItem.useMutation(
        mutationOptions({
            invalidate: () => {
                void utils.purchases.getById.invalidate({ id: purchaseId });
                void utils.orders.getAllByPurchase.invalidate({ purchaseId });
                void utils.purchases.list.invalidate();
            },
            success: 'Товар удалён из закупки',
        }),
    );
}

export function usePublishItemToTg(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.publishItemToTg.useMutation(
        mutationOptions({
            invalidate: () => void utils.purchases.getById.invalidate({ id: purchaseId }),
            success: 'В очереди на публикацию в Telegram',
        }),
    );
}

export function useDeleteItemPost(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.deleteItemPost.useMutation(
        mutationOptions({
            invalidate: () => void utils.purchases.getById.invalidate({ id: purchaseId }),
            success: 'Пост удалён из Telegram',
        }),
    );
}

export function useUpdateItemProduct(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.updateItemProduct.useMutation(
        mutationOptions({
            invalidate: () => {
                void utils.purchases.getById.invalidate({ id: purchaseId });
                void utils.products.list.invalidate();
            },
            success: 'Товар обновлён',
        }),
    );
}

export function useInlineUpdateItem(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.updateItemProduct.useMutation({
        onMutate: async (vars) => {
            await utils.purchases.getById.cancel({ id: purchaseId });
            const prev = utils.purchases.getById.getData({ id: purchaseId });
            if (prev) {
                utils.purchases.getById.setData(
                    { id: purchaseId },
                    {
                        ...prev,
                        items: prev.items.map((it) =>
                            it.id === vars.purchaseItemId ? ({ ...it, ...vars.product } as typeof it) : it,
                        ),
                    },
                );
            }
            return { prev };
        },
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prev) {
                utils.purchases.getById.setData({ id: purchaseId }, ctx.prev);
            }
            toast.error(err.message);
        },
    });
}

export function useRegenerateItemDescription(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.regenerateItemDescription.useMutation(
        mutationOptions({
            invalidate: () => void utils.purchases.getById.invalidate({ id: purchaseId }),
            success: 'Пост обновлён в Telegram',
        }),
    );
}
