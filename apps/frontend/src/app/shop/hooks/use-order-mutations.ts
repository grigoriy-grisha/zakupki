'use client';

import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

export function useOrderMutations(purchaseId: number, _purchaseItemId: number) {
    const utils = trpc.useUtils();

    const invalidate = () => {
        void utils.orders.getMyOrders.invalidate();
        void utils.purchases.getById.invalidate({ id: purchaseId });
    };

    const adjust = trpc.orders.adjustQuantity.useMutation(mutationOptions({ invalidate }));

    const adjustPackage = trpc.orders.adjustPackageCount.useMutation(mutationOptions({ invalidate }));

    return {
        adjust,
        adjustPackage,
        isPending: adjust.isPending || adjustPackage.isPending,
    };
}
