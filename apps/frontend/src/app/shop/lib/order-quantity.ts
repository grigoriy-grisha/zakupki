import {
    calculateFreeRemainder,
    getMinOrderQuantity,
    getOrderQuantityStep,
    getSupplementEffectiveMinQty,
    getSupplementUiOrderStep,
    isSupplementOnlyPacksOrder,
    isSupplementPacksAllowed,
    isSupplementRemainderOnlyPhase,
    isValidOrderQuantity,
    isValidSupplementOrderQuantity,
    snapOrderQuantity,
    snapSupplementOrderQuantity,
    type OrderQuantityOptions,
    type PurchaseFulfillmentStatus,
    type SupplementOrderBounds,
} from '@zakupki/types';

export type ShopOrderQuantityContext = {
    orderQtyOptions: OrderQuantityOptions;
    orderStep: number;
    minOrderQty: number;
    uiStep: number;
    effectiveMinQty: number;
    supplementBounds: SupplementOrderBounds | null;
    /** На доборе: остаток 0 или < мин. — «+» по шагу выключен; на REORDER ещё +пачка. */
    supplementOnlyPacks: boolean;
    /** На доборе: кнопки ±пачка (этап «Доборы»). */
    supplementPacksAllowed: boolean;
    snap: (qty: number) => number;
    isValid: (qty: number) => boolean;
};

export function buildShopOrderQuantityContext(input: {
    isSupplement: boolean;
    fulfillmentStatus?: PurchaseFulfillmentStatus | string | null;
    orderQtyOptions: OrderQuantityOptions;
    currentQuantity: number;
    availableQty: number | null | undefined;
    packSize: number | null;
    orderLines?: { quantity: unknown }[];
}): ShopOrderQuantityContext {
    const orderStep = getOrderQuantityStep(input.orderQtyOptions);
    const minOrderQty = getMinOrderQuantity(input.orderQtyOptions);
    const uiStep = input.isSupplement
        ? getSupplementUiOrderStep(orderStep, input.orderQtyOptions)
        : orderStep;
    const effectiveMinQty = input.isSupplement
        ? getSupplementEffectiveMinQty(minOrderQty, input.orderQtyOptions)
        : minOrderQty;

    let supplementBounds: SupplementOrderBounds | null = null;
    if (input.isSupplement) {
        const rawAvailableQty =
            input.availableQty !== null && input.availableQty !== undefined
                ? Number(input.availableQty)
                : null;
        const freeRemainder = calculateFreeRemainder(input.orderLines ?? [], input.packSize);
        const effectiveAvailableQty =
            rawAvailableQty != null ? rawAvailableQty : freeRemainder > 0 ? freeRemainder : null;
        const remainderOnly =
            isSupplementRemainderOnlyPhase(input.fulfillmentStatus);
        supplementBounds = {
            availableQty: effectiveAvailableQty,
            currentQuantity: input.currentQuantity,
            supplierPackageAmount: input.packSize,
            remainderOnly,
        };
    }

    function snap(qty: number): number {
        if (supplementBounds) {
            return snapSupplementOrderQuantity(qty, input.orderQtyOptions, supplementBounds);
        }
        return snapOrderQuantity(qty, input.orderQtyOptions);
    }

    function isValid(qty: number): boolean {
        if (supplementBounds) {
            return isValidSupplementOrderQuantity(qty, input.orderQtyOptions, supplementBounds);
        }
        return isValidOrderQuantity(qty, input.orderQtyOptions);
    }

    const supplementOnlyPacks =
        supplementBounds != null &&
        isSupplementOnlyPacksOrder(supplementBounds, input.orderQtyOptions);

    const supplementPacksAllowed =
        supplementBounds != null && isSupplementPacksAllowed(supplementBounds);

    return {
        orderQtyOptions: input.orderQtyOptions,
        orderStep,
        minOrderQty,
        uiStep,
        effectiveMinQty,
        supplementBounds,
        supplementOnlyPacks,
        supplementPacksAllowed,
        snap,
        isValid,
    };
}
