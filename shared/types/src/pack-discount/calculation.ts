import type { SupplierPackProductFields, PackDiscountPricingInfo } from './types';
import { computeDiscountedPackPrice } from '../settings';
import { positiveOrNull } from '../utils';

/**
 * Нормализует единицу фасовки поставщика
 */
export function normalizeSupplierPackUnit(unit: string | null | undefined): 'гр' | 'шт' | null {
    if (!unit) return null;
    const normalized = unit.trim().toLowerCase().replace(/\./g, '');
    if (normalized === 'гр' || normalized === 'g') return 'гр';
    if (normalized === 'шт') return 'шт';
    return null;
}

/**
 * Получает размер пачки поставщика (только для граммовых товаров)
 */
export function getSupplierPackSize(product: SupplierPackProductFields): number | null {
    const unit = normalizeSupplierPackUnit(product.supplierPackageUnit);
    if (unit !== 'гр') return null;
    return positiveOrNull(product.supplierPackageAmount);
}

/**
 * Проверяет, является ли товар весовым с ценой за пачку
 */
export function isGramSupplierPackProduct(product: SupplierPackProductFields): boolean {
    return getSupplierPackSize(product) != null && positiveOrNull(product.supplierPackagePrice) != null;
}

/**
 * Получает информацию о скидке на пачку
 */
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

/**
 * Считает количество целых пачек поставщика в заказе
 */
export function countFullSupplierPacks(quantity: number, packSize: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0 || packSize <= 0) return 0;
    return Math.floor((quantity + 1e-9) / packSize);
}