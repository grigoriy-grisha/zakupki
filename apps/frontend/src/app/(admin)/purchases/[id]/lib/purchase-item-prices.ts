import {
    computeDiscountedPackPrice,
    isGramSupplierPackProduct,
    parsePriceTiers,
    type PriceTier,
} from '@zakupki/types';

import { formatRubPrice, tierPrice } from './price-format';

/** Общий тип: всё per-purchase читается с PurchaseItem (а не с item.product). */
interface ItemLike {
    priceOverride?: unknown;
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
    priceTiers?: unknown;
}

export function getProductPriceTiers(priceTiers: unknown): PriceTier[] {
    return parsePriceTiers(priceTiers);
}

export function getPackPriceRub(item: { supplierPackagePrice?: unknown }): number | null {
    if (item.supplierPackagePrice == null) return null;
    const price = Number(item.supplierPackagePrice);
    return Number.isFinite(price) && price > 0 ? price : null;
}

export function getDiscountedPackPriceRub(
    item: {
        supplierPackageAmount?: unknown;
        supplierPackageUnit?: string | null;
        supplierPackagePrice?: unknown;
    },
    discountPercent: number,
): number | null {
    if (!isGramSupplierPackProduct(item)) return null;
    const packPrice = getPackPriceRub(item);
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

/** Цена за 1 единицу (для отображения «66 ₽/гр»). Берёт первый тир. */
export function getPurchaseItemPrice1Gr(item: ItemLike): number | null {
    const tiers = getProductPriceTiers(item.priceTiers);
    const tier1 = tierPrice(tiers, 1);
    if (tier1 != null) return tier1;

    const perUnit = item.priceOverride;
    if (perUnit == null) return null;
    const price = Number(perUnit);
    return Number.isFinite(price) && price > 0 ? price : null;
}
