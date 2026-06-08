import type { CalculateOrderAmountOptions } from './types';
import { parsePriceTiers } from './parsing';
import { getSupplierPackSize, normalizeSupplierPackUnit } from '../pack-discount';
import { computeDiscountedPackPrice } from '../settings';
import { isPositive, positiveOrNull } from '../utils';

/**
 * Округление денежного значения до 2 знаков после запятой
 */
export function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Сумма заказа по количеству и ценовым ступеням.
 * Ступени — фасовки: 10 гр → 340 ₽. Сначала крупные фасовки, остаток — по цене мелкой.
 */
export function calculateOrderAmount(quantity: number, options: CalculateOrderAmountOptions): number {
    if (!isPositive(quantity)) return 0;

    if (options.priceOverride != null && isPositive(Number(options.priceOverride))) {
        return roundMoney(quantity * Number(options.priceOverride));
    }

    const packSize = getSupplierPackSize(options);
    const packPrice = positiveOrNull(options.supplierPackagePrice);
    const packUnit = normalizeSupplierPackUnit(options.supplierPackageUnit);
    const discountPercent = options.packDiscountPercent;

    if (
        packSize != null &&
        packUnit === 'гр' &&
        packPrice != null &&
        discountPercent != null &&
        Number.isFinite(discountPercent) &&
        discountPercent >= 0 &&
        discountPercent <= 100
    ) {
        const fullPacks = Math.floor((quantity + 1e-9) / packSize);
        if (fullPacks > 0) {
            const remainder = quantity - fullPacks * packSize;
            const discountedPack = computeDiscountedPackPrice(packPrice, discountPercent);
            let total = fullPacks * discountedPack;
            if (remainder > 1e-6) {
                total += calculateOrderAmount(remainder, {
                    priceTiers: options.priceTiers,
                    pricePerUnit: options.pricePerUnit,
                });
            }
            return roundMoney(total);
        }
    }

    const tiers = parsePriceTiers(options.priceTiers).sort((a, b) => b.amount - a.amount);

    if (tiers.length === 0) {
        return roundMoney(quantity * options.pricePerUnit);
    }

    const exact = tiers.find((tier) => Math.abs(tier.amount - quantity) < 1e-6);
    if (exact) return roundMoney(exact.price);

    let remaining = quantity;
    let total = 0;

    for (const tier of tiers) {
        const packages = Math.floor((remaining + 1e-9) / tier.amount);
        if (packages <= 0) continue;
        total += packages * tier.price;
        remaining -= packages * tier.amount;
    }

    if (remaining > 1e-6) {
        const smallest = tiers[tiers.length - 1]!;
        total += remaining * (smallest.price / smallest.amount);
    }

    return roundMoney(total);
}
