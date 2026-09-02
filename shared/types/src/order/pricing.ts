/**
 * Расчёт суммы заказа — чистая новая модель цен (валюта × курс × оргсбор).
 *
 * Старая модель (priceTiers + supplierPackagePrice + priceOverride + packDiscount)
 * полностью удалена. Все цены считаются через unitPriceRub.
 */
import {
    computeAmountDueNewModel,
    computeUnitPriceRubFromItem,
    resolveCurrencyRate,
    resolveOrgFeePercent,
} from '../pricing/currency-pricing';
import type { PurchaseItem } from './types';

/**
 * Цена за 1ед по новой модели (валюта × курс × оргсбор / вес), либо null,
 * если новая модель не активна для этого товара (нет валюты/курса/веса).
 */
export function computeUnitPriceRubNewModel(item: PurchaseItem): number | null {
    if (item.pricePerPackCurrency == null || item.currencyId == null || item.packAmount == null) {
        return null;
    }
    const rateToRub = resolveCurrencyRate(item.currencyRates, item.currencyId);
    if (rateToRub == null) return null;
    const orgFeePercent = resolveOrgFeePercent(item.orgFeePercentOverride, item.orgFeeDefaultPercent);
    return computeUnitPriceRubFromItem({
        pricePerPackCurrency: item.pricePerPackCurrency,
        rateToRub,
        orgFeePercent,
        deliveryPercent: item.deliveryPercent,
        packSize: item.packAmount,
    });
}

/**
 * Сумма заказа по количеству. Новая модель: quantity × unitPriceRub.
 * Возвращает 0, если новая модель не активна (нет данных для расчёта цены).
 */
export function computeAmountDue(quantity: number, item: PurchaseItem): number {
    const unitPriceRub = computeUnitPriceRubNewModel(item);
    if (unitPriceRub != null) {
        return (
            computeAmountDueNewModel({
                quantity,
                packageCount: 0,
                packSize: item.packAmount,
                unitPriceRub,
            }) ?? 0
        );
    }
    return 0;
}

/**
 * Цена одной упаковки в ₽: packAmount × unitPriceRub.
 * Возвращает 0, если новая модель не активна.
 */
export function computePackagePrice(item: PurchaseItem): number {
    const unitPriceRub = computeUnitPriceRubNewModel(item);
    if (unitPriceRub == null || item.packAmount == null) return 0;
    return unitPriceRub * item.packAmount;
}

/**
 * Сумма заказа с учётом упаковок: (quantity + packageCount × packAmount) × unitPriceRub.
 * Возвращает 0, если новая модель не активна.
 */
export function computeAmountDueWithPackages(quantity: number, packageCount: number, item: PurchaseItem): number {
    const unitPriceRub = computeUnitPriceRubNewModel(item);
    if (unitPriceRub != null) {
        return (
            computeAmountDueNewModel({
                quantity,
                packageCount,
                packSize: item.packAmount,
                unitPriceRub,
            }) ?? 0
        );
    }
    return 0;
}
