import { computeDiscountedPackPrice } from './app-settings';

export type SupplierPackProductFields = {
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
};

function positiveOrNull(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeSupplierPackUnit(unit: string | null | undefined): 'гр' | 'шт' | null {
    if (!unit) return null;
    const normalized = unit.trim().toLowerCase().replace(/\./g, '');
    if (normalized === 'гр' || normalized === 'g') return 'гр';
    if (normalized === 'шт') return 'шт';
    return null;
}

export function getSupplierPackSize(product: SupplierPackProductFields): number | null {
    const unit = normalizeSupplierPackUnit(product.supplierPackageUnit);
    if (unit !== 'гр') return null;
    return positiveOrNull(product.supplierPackageAmount);
}

export function isGramSupplierPackProduct(product: SupplierPackProductFields): boolean {
    return getSupplierPackSize(product) != null && positiveOrNull(product.supplierPackagePrice) != null;
}

export type PackDiscountPricingInfo = {
    packSize: number;
    packPrice: number;
    discountedPackPrice: number;
    discountPercent: number;
};

export function getPackDiscountPricingInfo(
    product: SupplierPackProductFields,
    discountPercent: number,
): PackDiscountPricingInfo | null {
    const packSize = getSupplierPackSize(product);
    const packPrice = positiveOrNull(product.supplierPackagePrice);
    if (packSize == null || packPrice == null) return null;
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;

    return {
        packSize,
        packPrice,
        discountedPackPrice: computeDiscountedPackPrice(packPrice, discountPercent),
        discountPercent,
    };
}

export function countFullSupplierPacks(quantity: number, packSize: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0 || packSize <= 0) return 0;
    return Math.floor((quantity + 1e-9) / packSize);
}

export function formatPackDiscountHint(info: PackDiscountPricingInfo): string {
    return `Целая пачка ${info.packSize} гр — ${info.discountedPackPrice.toLocaleString('ru-RU')} ₽ (скидка ${info.discountPercent}% от цены за пачку)`;
}

export function formatPackDiscountBanner(discountPercent: number): string {
    return `Для бисера в граммах при заказе целой пачки поставщика действует скидка ${discountPercent}% от цены за пачку.`;
}
