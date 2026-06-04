import { computeDiscountedPackPrice } from './app-settings';
import { getSupplierPackSize, normalizeSupplierPackUnit } from './pack-discount-pricing';

export type PriceTier = {
    amount: number;
    unit?: string;
    price: number;
};

function isPositive(n: number): boolean {
    return Number.isFinite(n) && n > 0;
}

export function parsePriceTiers(raw: unknown): PriceTier[] {
    if (!Array.isArray(raw)) return [];

    const tiers: PriceTier[] = [];
    for (const tier of raw) {
        if (tier == null || typeof tier !== 'object') continue;
        const record = tier as Record<string, unknown>;
        const amount = Number(record.amount);
        const price = Number(record.price);
        if (!isPositive(amount) || !isPositive(price)) continue;
        tiers.push({
            amount,
            price,
            unit: typeof record.unit === 'string' ? record.unit : undefined,
        });
    }
    return tiers;
}

/**
 * Сумма заказа по количеству и ценовым ступеням.
 * Ступени — фасовки: 10 гр → 340 ₽. Сначала крупные фасовки, остаток — по цене мелкой.
 */
export type CalculateOrderAmountOptions = {
    priceTiers?: unknown;
    pricePerUnit: number;
    priceOverride?: number | null;
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
    packDiscountPercent?: number | null;
};

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

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

function positiveOrNull(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function roundUpToStep(value: number, step: number): number {
    if (step <= 0) return value;
    return Math.ceil((value - 1e-9) / step) * step;
}

function isMultipleOf(quantity: number, step: number): boolean {
    const remainder = quantity % step;
    return remainder < 1e-6 || Math.abs(remainder - step) < 1e-6;
}

function formatQtyLabel(quantity: number): string {
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
}

export type OrderQuantityOptions = {
    multiplicity?: number | null;
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    purchaseItemMinQty?: number | null;
    unitShort?: string | null;
};

/** Шаг заказа: мин. фасовка товара, иначе кратность единицы измерения. */
export function getOrderQuantityStep(options: OrderQuantityOptions): number {
    return positiveOrNull(options.minPackageAmount) ?? positiveOrNull(options.multiplicity) ?? 1;
}

/** Минимальное количество заказа: мин. фасовка товара, иначе minQty позиции, иначе шаг. */
export function getMinOrderQuantity(options: OrderQuantityOptions): number {
    const step = getOrderQuantityStep(options);
    const base =
        positiveOrNull(options.minPackageAmount) ??
        positiveOrNull(options.purchaseItemMinQty) ??
        step;
    return roundUpToStep(base, step);
}

export function getOrderQuantityValidationError(quantity: number, options: OrderQuantityOptions): string | null {
    if (!isPositive(quantity)) return 'Укажите положительное количество';

    const step = getOrderQuantityStep(options);
    const min = getMinOrderQuantity(options);
    const unit =
        positiveOrNull(options.minPackageAmount) != null && options.minPackageUnit
            ? options.minPackageUnit
            : (options.unitShort ?? 'ед.');
    const stepLabel = formatQtyLabel(step);
    const minLabel = formatQtyLabel(min);

    if (quantity + 1e-9 < min) {
        if (positiveOrNull(options.minPackageAmount) != null) {
            return `Мин. фасовка: ${stepLabel} ${unit}`;
        }
        return `Минимальный заказ: ${minLabel} ${unit}`;
    }

    if (!isMultipleOf(quantity, step)) {
        if (positiveOrNull(options.minPackageAmount) != null) {
            return `Можно заказать только кратно ${stepLabel} ${unit}: ${stepLabel}, ${formatQtyLabel(step * 2)}, ${formatQtyLabel(step * 3)}…`;
        }
        return `Количество должно быть кратно ${stepLabel} ${unit}`;
    }

    return null;
}

export function isValidOrderQuantity(quantity: number, options: OrderQuantityOptions): boolean {
    return getOrderQuantityValidationError(quantity, options) === null;
}

/** Приводит количество к допустимому: не ниже мин., не выше max, кратно шагу. */
export function snapOrderQuantity(
    quantity: number,
    options: OrderQuantityOptions,
    bounds?: { max?: number | null },
): number {
    const step = getOrderQuantityStep(options);
    const min = getMinOrderQuantity(options);
    let qty = Math.max(min, quantity);

    if (bounds?.max != null) {
        qty = Math.min(qty, bounds.max);
        if (!isMultipleOf(qty, step)) {
            qty = Math.floor((qty + 1e-9) / step) * step;
        }
        return qty < min ? 0 : qty;
    }

    if (!isMultipleOf(qty, step)) {
        qty = roundUpToStep(qty, step);
    }
    return qty;
}

/** Только «Мин. фасовка: …» — для превью карточки в каталоге. */
export function formatMinPackageHint(options: OrderQuantityOptions): string | null {
    const step = positiveOrNull(options.minPackageAmount);
    if (step == null) return null;
    const unit = options.minPackageUnit ?? options.unitShort ?? 'ед.';
    return `Мин. фасовка: ${formatQtyLabel(step)} ${unit}`;
}

export function formatMinPackageOrderHint(options: OrderQuantityOptions): string | null {
    const hint = formatMinPackageHint(options);
    if (!hint) return null;
    const step = positiveOrNull(options.minPackageAmount)!;
    const unit = options.minPackageUnit ?? options.unitShort ?? 'ед.';
    return `${hint} · заказ кратно ${formatQtyLabel(step)} ${unit}`;
}
