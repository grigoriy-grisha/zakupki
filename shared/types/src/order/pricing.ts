/**
 * Расчёт суммы заказа — чистая новая модель цен (валюта × курс × оргсбор).
 *
 * Старая модель (priceTiers + supplierPackagePrice + priceOverride + packDiscount)
 * полностью удалена. Все цены считаются через unitPriceRub. Единственная скидка —
 * за целые пачки весового товара (packDiscountPercent): целая пачка стоит
 * packPrice × (1 − d/100), россыпь — полная цена за единицу.
 */
import { computeDiscountedPackPrice, countFullSupplierPacks } from '../pack-discount/calculation';
import {
    computeAmountDueNewModel,
    computeUnitPriceRubFromItem,
    resolveCurrencyRate,
    resolveOrgFeePercent,
    roundMoney,
} from '../pricing/currency-pricing';
import { isWeightUnit } from '../units/normalize';
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
 * Скидка за целые пачки применима: включена (d > 0), товар весовой
 * и есть положительный размер пачки. Штучные/тубы не дисконтируются.
 * Type-guard: в positive-ветке packAmount сужается до number.
 */
function hasActivePackDiscount(item: PurchaseItem): item is PurchaseItem & { packAmount: number } {
    return (
        item.packDiscountPercent > 0 && isWeightUnit(item.unitCode) && item.packAmount != null && item.packAmount > 0
    );
}

/**
 * Сумма заказа по количеству. Новая модель: quantity × unitPriceRub
 * (скидка за пачки не возникает — упаковок нет).
 * Возвращает 0, если новая модель не активна (нет данных для расчёта цены).
 */
export function computeAmountDue(quantity: number, item: PurchaseItem): number {
    return computeAmountDueWithPackages(quantity, 0, item);
}

/**
 * Цена одной упаковки в ₽ — фактическая к оплате: packAmount × unitPriceRub,
 * для весового товара со скидкой — со скидкой за пачку.
 * Возвращает 0, если новая модель не активна.
 */
export function computePackagePrice(item: PurchaseItem): number {
    const unitPriceRub = computeUnitPriceRubNewModel(item);
    if (unitPriceRub == null || item.packAmount == null) return 0;
    const packPrice = unitPriceRub * item.packAmount;
    if (!hasActivePackDiscount(item)) return packPrice;
    return computeDiscountedPackPrice(packPrice, item.packDiscountPercent);
}

/**
 * Сумма заказа с учётом упаковок и скидки за целые пачки:
 * россыпь × цена/ед + целые пачки × цена пачки со скидкой.
 * Возвращает 0, если новая модель не активна.
 */
export function computeAmountDueWithPackages(quantity: number, packageCount: number, item: PurchaseItem): number {
    const unitPriceRub = computeUnitPriceRubNewModel(item);
    if (unitPriceRub == null) return 0;
    if (!hasActivePackDiscount(item)) {
        return (
            computeAmountDueNewModel({
                quantity,
                packageCount,
                packSize: item.packAmount,
                unitPriceRub,
            }) ?? 0
        );
    }
    const packSize = item.packAmount;
    const effectiveQty = quantity + packageCount * packSize;
    const fullPacks = countFullSupplierPacks(effectiveQty, packSize);
    const remainder = Math.max(0, effectiveQty - fullPacks * packSize);
    const discountedPackPrice = computeDiscountedPackPrice(unitPriceRub * packSize, item.packDiscountPercent);
    return roundMoney(remainder * unitPriceRub + fullPacks * discountedPackPrice);
}
