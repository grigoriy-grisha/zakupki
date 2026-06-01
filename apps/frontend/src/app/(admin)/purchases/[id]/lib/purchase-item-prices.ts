import {
    computeDiscountedPackPrice,
    isGramSupplierPackProduct,
    parsePriceTiers,
    type PriceTier,
} from '@zakupki/types';

export function getProductPriceTiers(priceTiers: unknown): PriceTier[] {
    return parsePriceTiers(priceTiers);
}

export function tierPrice(tiers: PriceTier[], amount: number): number | null {
    const tier = tiers.find((entry) => Math.abs(entry.amount - amount) < 1e-6);
    return tier ? tier.price : null;
}

export function getPackPriceRub(product: { supplierPackagePrice?: unknown }): number | null {
    if (product.supplierPackagePrice == null) return null;
    const price = Number(product.supplierPackagePrice);
    return Number.isFinite(price) && price > 0 ? price : null;
}

export function getDiscountedPackPriceRub(
    product: {
        supplierPackageAmount?: unknown;
        supplierPackageUnit?: string | null;
        supplierPackagePrice?: unknown;
    },
    discountPercent: number,
): number | null {
    if (!isGramSupplierPackProduct(product)) return null;
    const packPrice = getPackPriceRub(product);
    if (packPrice == null) return null;
    return computeDiscountedPackPrice(packPrice, discountPercent);
}

export function formatPrice510Cell(tiers: PriceTier[]): string {
    const price5 = tierPrice(tiers, 5);
    const price10 = tierPrice(tiers, 10);
    if (price5 != null && price10 != null) {
        return `${price5.toLocaleString('ru-RU')} / ${price10.toLocaleString('ru-RU')} ₽`;
    }
    if (price5 != null) return formatRubPrice(price5);
    if (price10 != null) return formatRubPrice(price10);
    return '—';
}

export function getPurchaseItemPrice1Gr(item: {
    priceOverride?: unknown;
    product: { pricePerUnit?: unknown; priceTiers?: unknown };
}): number | null {
    const tiers = getProductPriceTiers(item.product.priceTiers);
    const tier1 = tierPrice(tiers, 1);
    if (tier1 != null) return tier1;

    const perUnit = item.priceOverride ?? item.product.pricePerUnit;
    if (perUnit == null) return null;
    const price = Number(perUnit);
    return Number.isFinite(price) && price > 0 ? price : null;
}

export function formatRubPrice(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${value.toLocaleString('ru-RU')} ₽`;
}
