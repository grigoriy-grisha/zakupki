import type { OrderQuantityOptions } from './types';
export type { CurrencyRate } from './currency-pricing';
export {
    computeAmountDueNewModel,
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    computeUnitPriceRubFromItem,
    resolveCurrencyRate,
    resolveDeliveryPercent,
    resolveOrgFeePercent,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromUnitRub,
} from './currency-pricing';
export { formatActiveStepHint } from './formatting';
export { parsePriceTiers } from './parsing';
export { getActiveStep,getOrderQuantityStep, getSupplementStep } from './quantity-rules';
export type { OrderQuantityOptions,PriceTier } from './types';

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
    unitCode?: string | null;
}): OrderQuantityOptions {
    return {
        multiplicity: input.multiplicity,
        minPackageAmount: input.minPackageAmount,
        minPackageUnit: input.minPackageUnit,
        purchaseItemMinQty: input.purchaseItemMinQty ?? null,
        unitShort: input.unitShort ?? null,
        unitCode: input.unitCode ?? null,
    };
}
