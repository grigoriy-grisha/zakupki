import type { OrderQuantityOptions } from './types';
export type { PriceTier, CalculateOrderAmountOptions, OrderQuantityOptions } from './types';
export { parsePriceTiers } from './parsing';
export { calculateOrderAmount, roundMoney } from './calculation';
export {
    getOrderQuantityStep,
    getMinOrderQuantity,
    snapOrderQuantity,
    roundUpToStep,
    isMultipleOf,
} from './quantity-rules';
export { getOrderQuantityValidationError, isValidOrderQuantity } from './validation';
export { formatMinPackageHint, formatMinPackageOrderHint } from './formatting';

/**
 * Строит OrderQuantityOptions из полей товара.
 * Используется в UI для передачи параметров количества в хелперы расчёта.
 */
export function buildOrderQtyOptions(input: {
    multiplicity: number;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    purchaseItemMinQty?: number | null;
    unitShort?: string | null;
}): OrderQuantityOptions {
    return {
        multiplicity: input.multiplicity,
        minPackageAmount: input.minPackageAmount,
        minPackageUnit: input.minPackageUnit,
        purchaseItemMinQty: input.purchaseItemMinQty ?? null,
        unitShort: input.unitShort ?? null,
    };
}
