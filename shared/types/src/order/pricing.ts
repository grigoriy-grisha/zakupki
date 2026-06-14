/**
 * Расчёт суммы заказа — обёртка над calculateOrderAmount,
 * адаптированная под PurchaseItem (number, не Decimal).
 */
import { calculateOrderAmount } from '../pricing/calculation';
import type { PurchaseItem } from './types';

/**
 * Сумма заказа по количеству и ценовым ступеням товара.
 * Чистая функция: берёт прайсинг из PurchaseItem.
 */
export function computeAmountDue(quantity: number, item: PurchaseItem): number {
    return calculateOrderAmount(quantity, {
        priceTiers: item.priceTiers,
        pricePerUnit: item.pricePerUnit,
        priceOverride: item.priceOverride,
        supplierPackageAmount: item.supplierPackageAmount,
        supplierPackageUnit: item.supplierPackageUnit,
        supplierPackagePrice: item.supplierPackagePrice,
        packDiscountPercent: item.packDiscountPercent,
    });
}

/**
 * Цена одной упаковки поставщика: явная supplierPackagePrice,
 * иначе pricePerUnit * supplierPackageAmount.
 */
export function computePackagePrice(item: PurchaseItem): number {
    if (item.supplierPackagePrice != null && item.supplierPackagePrice > 0) {
        return item.supplierPackagePrice;
    }
    return item.pricePerUnit * (item.supplierPackageAmount ?? 0);
}

/**
 * Сумма заказа с учётом упаковок: amountDue(qty) + packageCount * packagePrice.
 */
export function computeAmountDueWithPackages(quantity: number, packageCount: number, item: PurchaseItem): number {
    return computeAmountDue(quantity, item) + packageCount * computePackagePrice(item);
}
