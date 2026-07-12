'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import { trpc } from '@/lib/client/trpc';
import type { AppRouter } from '@/server/routers/_app';

/**
 * `purchases.addItems` принимает массив объектов с per-purchase полями, и
 * стандартный `trpc.purchases.addItems.useMutation` упирается в лимит
 * «Type instantiation is excessively deep» в выводе типов `createTRPCReact`.
 *
 * Обход: `@tanstack/react-query.useMutation` + tRPC proxy-клиент
 * (`utils.client.purchases.addItems.mutate`). Типы input/output берём напрямую
 * из `inferRouterInputs/Outputs<AppRouter>` — они неглубокие.
 *
 * `removeItem` — стандартный хук, но его инстанциация типов тоже периодически
 * переполняет лимит TS2589 (глубокий AppRouter), поэтому глушим @ts-expect-error.
 * Остальные (`publishItemToTg`, `updateItemProduct`) — стандартные хуки без оговорок.
 */
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

    // TS2589: Type instantiation is excessively deep. tRPC React выводит типы
    // всей процедуры, и на `removeItem` это переполняет лимит при текущей
    // глубине AppRouter. Ошибка прерывистая (зависит от всего графа типов),
    // поэтому @ts-ignore, а не @ts-expect-error — иначе сборка падает на TS2578,
    // когда ошибки нет. Хук рабочий.
    // @ts-ignore TS2589 deep instantiation on removeItem.useMutation
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

export function useUpdateItemProduct(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.updateItemProduct.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.products.list.invalidate();
            toast.success('Товар обновлён');
        },
        onError: (err) => toast.error(err.message),
    });
}
