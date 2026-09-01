'use client';

import type { CurrencyRate } from '@zakupki/types';
import { useMemo } from 'react';

import { buildItemOrderContext } from '../lib/order-context';
import type { ShopPurchaseItem } from '../lib/types';
import { useOrderMutations } from './use-order-mutations';

interface UseItemOrderControlsInput {
    purchaseId: number;
    purchaseItemId: number;
    /** PurchaseItem данные — могут приходить из tRPC с Decimal→string полями */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    currentQuantity: number;
    currentPackageCount: number;
    baseQuantity: number;
    fulfillmentStatus: string;
    packDiscountPercent: number;
    orgFeeDefaultPercent: number;
    currencyRates: CurrencyRate[];
}

export function useItemOrderControls(input: UseItemOrderControlsInput) {
    const mutations = useOrderMutations(input.purchaseId, input.purchaseItemId);

    const ctx = useMemo(
        () =>
            buildItemOrderContext({
                item: input.item as ShopPurchaseItem,
                currentQuantity: input.currentQuantity,
                currentPackageCount: input.currentPackageCount,
                baseQuantity: input.baseQuantity,
                fulfillmentStatus: input.fulfillmentStatus,
                packDiscountPercent: input.packDiscountPercent,
                orgFeeDefaultPercent: input.orgFeeDefaultPercent,
                currencyRates: input.currencyRates,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps — item объект стабильный из tRPC
        [
            input.item,
            input.currentQuantity,
            input.currentPackageCount,
            input.baseQuantity,
            input.fulfillmentStatus,
            input.packDiscountPercent,
            input.orgFeeDefaultPercent,
            input.currencyRates,
        ],
    );

    function handleAdd() {
        if (mutations.isPending) return;
        if (input.currentQuantity >= ctx.maxAllowed) return;
        const remaining = ctx.maxAllowed - input.currentQuantity;
        const delta = remaining < ctx.activeStep ? remaining : ctx.activeStep;
        mutations.adjust.mutate({ purchaseItemId: input.purchaseItemId, delta });
    }

    function handleRemove() {
        if (mutations.isPending || input.currentQuantity <= 0) return;
        const removableQty = input.currentQuantity - ctx.minAllowed;
        if (removableQty <= 0) return;
        const delta = removableQty < ctx.activeStep ? removableQty : ctx.activeStep;
        mutations.adjust.mutate({ purchaseItemId: input.purchaseItemId, delta: -delta });
    }

    function handleAddPackage() {
        mutations.adjustPackage.mutate({ purchaseItemId: input.purchaseItemId, delta: 1 });
    }

    function handleRemovePackage() {
        mutations.adjustPackage.mutate({ purchaseItemId: input.purchaseItemId, delta: -1 });
    }

    return {
        ...ctx,
        canAdd: ctx.canAdd && !mutations.isPending,
        canDecrease: ctx.canDecrease && !mutations.isPending,
        handleAdd,
        handleRemove,
        handleAddPackage,
        handleRemovePackage,
        isPending: mutations.isPending,
    };
}
