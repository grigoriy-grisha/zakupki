import { calculateOrderAmount } from '@zakupki/types';

/** All price-related data needed to compute an order line's amountDue */
export interface PriceContext {
    priceTiers: unknown;
    pricePerUnit: number;
    priceOverride: number | null;
    packDiscountPercent: number;
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;
}

/** Total quantity = base + packs × packSize + remainder */
export function orderQuantity(base: number, packs: number, packSize: number | null, remainder: number): number {
    return base + packs * (packSize ?? 0) + remainder;
}

/** Amount due for a given quantity and price context */
export function orderAmountDue(quantity: number, ctx: PriceContext): number {
    return calculateOrderAmount(quantity, {
        priceTiers: ctx.priceTiers,
        pricePerUnit: ctx.pricePerUnit,
        priceOverride: ctx.priceOverride,
        supplierPackageAmount: ctx.supplierPackageAmount,
        supplierPackageUnit: ctx.supplierPackageUnit,
        supplierPackagePrice: ctx.supplierPackagePrice,
        packDiscountPercent: ctx.packDiscountPercent,
    });
}

/** Safe Prisma Decimal → number | null */
export function num(value: unknown): number | null {
    return value == null ? null : Number(value);
}
