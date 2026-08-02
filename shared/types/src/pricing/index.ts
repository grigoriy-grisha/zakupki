import type { OrderQuantityOptions } from './types';
export type { PriceTier, OrderQuantityOptions } from './types';
export type { CurrencyRate } from './currency-pricing';
export { parsePriceTiers } from './parsing';
export {
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    computeUnitPriceRubFromItem,
    computeAmountDueNewModel,
    resolveOrgFeePercent,
    resolveCurrencyRate,
} from './currency-pricing';
export { getOrderQuantityStep, getSupplementStep, getActiveStep } from './quantity-rules';
export { formatActiveStepHint } from './formatting';

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
