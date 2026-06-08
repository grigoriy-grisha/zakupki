'use client';

import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

/**
 * Мутации adjustQuantity и adjustPackageCount с автоматическим
 * инвалидированием кэша. Один экземпляр на purchaseItem.
 */
export function useOrderMutations(purchaseId: number, purchaseItemId: number) {
    const utils = trpc.useUtils();

    const adjust = trpc.orders.adjustQuantity.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    const adjustPackage = trpc.orders.adjustPackageCount.useMutation({
        onSuccess: () => {
            void utils.orders.getMyOrders.invalidate();
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
        onError: (err) => toast.error(err.message),
    });

    return {
        adjust,
        adjustPackage,
        isPending: adjust.isPending || adjustPackage.isPending,
    };
}
