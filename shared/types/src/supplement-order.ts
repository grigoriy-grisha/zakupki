import {
    getOrderQuantityStep,
    getOrderQuantityValidationError,
    snapOrderQuantity,
    type OrderQuantityOptions,
} from './pricing';

/** Минимальный заказ на доборе (гр / ед.). */
export const SUPPLEMENT_MIN_ORDER_QTY = 10;

function isPositive(n: number): boolean {
    return Number.isFinite(n) && n > 0;
}

function positiveOrNull(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function formatQtyLabel(quantity: number): string {
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
}

/**
 * Свободный остаток из пачек: заказанные пачки × размер пачки − суммарный заказ.
 * Используется как fallback, когда availableQty не задан администратором.
 */
export function calculateFreeRemainder(
    orderLines: { quantity: unknown }[],
    supplierPackageAmount: number | null | undefined,
): number {
    const packSize = positiveOrNull(supplierPackageAmount);
    if (packSize == null) return 0;
    const totalOrdered = orderLines.reduce((sum, line) => {
        const qty = Number(line.quantity);
        return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);
    if (totalOrdered <= 0) return 0;
    const orderedPacks = Math.ceil(totalOrdered / packSize);
    return orderedPacks * packSize - totalOrdered;
}

export type SupplementOrderBounds = {
    /** Свободный остаток в БД (не включает текущий заказ пользователя). */
    availableQty: number | null;
    currentQuantity: number;
    supplierPackageAmount?: number | null;
};

export function getSupplementMaxQuantity(bounds: SupplementOrderBounds): number | null {
    if (bounds.availableQty == null) return null;
    return bounds.currentQuantity + Math.max(0, bounds.availableQty);
}

/**
 * Эффективный максимум для UI: текущий заказ + свободный остаток.
 */
export function getSupplementDisplayMax(bounds: SupplementOrderBounds): number | null {
    return getSupplementMaxQuantity(bounds);
}

/** Ровно одна пачка поставщика (10 гр, не 20 и не 60). */
export function isExactSupplierPackOrder(quantity: number, supplierPackageAmount?: number | null): boolean {
    const packSize = positiveOrNull(supplierPackageAmount);
    return packSize != null && Math.abs(quantity - packSize) < 1e-6;
}

/** Количество кратно размеру пачки (1, 2, 3… пачки). */
export function isWholePackMultiple(quantity: number, supplierPackageAmount?: number | null): boolean {
    const packSize = positiveOrNull(supplierPackageAmount);
    if (packSize == null) return false;
    return quantity > 1e-9 && Math.abs(quantity % packSize) < 1e-6;
}

/** @deprecated используйте isExactSupplierPackOrder */
export function isWholePackOrder(quantity: number, supplierPackageAmount?: number | null): boolean {
    return isExactSupplierPackOrder(quantity, supplierPackageAmount);
}

export function isFullSupplierPackOrder(quantity: number, supplierPackageAmount?: number | null): boolean {
    return isExactSupplierPackOrder(quantity, supplierPackageAmount);
}

export function getSupplementRemainderPool(bounds: SupplementOrderBounds): number | null {
    if (bounds.availableQty == null) return null;
    return Math.max(0, bounds.availableQty);
}

/**
 * Добор:
 * — минимум SUPPLEMENT_MIN_ORDER_QTY (от 10, не кратно);
 * — с остатка: не больше свободного остатка (кроме целых пачек);
 * — остаток меньше пачки (напр. 11 при пачке 12): только до остатка или целые пачки;
 * — остаток 0 или < минималки: только целые пачки (кратно размеру поставщика).
 */
export function getSupplementOrderQuantityValidationError(
    quantity: number,
    options: OrderQuantityOptions,
    bounds: SupplementOrderBounds,
): string | null {
    if (!isPositive(quantity)) return 'Укажите положительное количество';

    const unit =
        positiveOrNull(options.minPackageAmount) != null && options.minPackageUnit
            ? options.minPackageUnit
            : (options.unitShort ?? 'ед.');
    const minLabel = `${formatQtyLabel(SUPPLEMENT_MIN_ORDER_QTY)} ${unit}`;

    const max = getSupplementMaxQuantity(bounds);
    if (max == null) {
        const delta = quantity - bounds.currentQuantity;
        if (delta > 1e-9 && delta + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
            return `На доборе можно заказывать от ${minLabel}`;
        }
        return null;
    }

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    const packSize = bounds.supplierPackageAmount;
    const packLabel = positiveOrNull(packSize);
    const delta = quantity - bounds.currentQuantity;
    // Целые пачки: итог или добавка кратна размеру пачки
    const wholePack =
        isWholePackMultiple(quantity, packSize) ||
        (packLabel != null && delta > 1e-9 && isWholePackMultiple(delta, packSize));

    if (remainderPool <= 0) {
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return null;
        }
        if (!wholePack) {
            return packLabel != null
                ? `Свободный остаток закончился. На добор можно заказать только целыми пачками — ${formatQtyLabel(packLabel)} ${unit}.`
                : 'Свободный остаток закончился. На добор можно заказать только целыми пачками.';
        }
        return null;
    }

    // Остаток меньше минималки — с остатка не заказать, только пачки
    if (remainderPool + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return null;
        }
        if (!wholePack) {
            return packLabel != null
                ? `Остаток ${formatQtyLabel(remainderPool)} ${unit} — меньше минимального заказа. Можно только целыми пачками — ${formatQtyLabel(packLabel)} ${unit}.`
                : `Остаток ${formatQtyLabel(remainderPool)} ${unit} — меньше минимального заказа. Можно заказать только целыми пачками.`;
        }
        return null;
    }

    if (wholePack) {
        return null;
    }

    // Когда остаток < пачки: не больше остатка или целые пачки
    if (
        packLabel != null &&
        remainderPool < packLabel &&
        quantity > max + 1e-9
    ) {
        return `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} или целыми пачками — ${formatQtyLabel(packLabel)} ${unit}`;
    }

    if (quantity > max + 1e-9) {
        return `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} (свободный остаток) или целыми пачками`;
    }

    // Минимальный заказ на добор при увеличении (проверяем добавку, не итог)
    if (delta > 1e-9 && delta + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
        return `На доборе можно заказывать от ${minLabel}`;
    }

    return null;
}

export function isValidSupplementOrderQuantity(
    quantity: number,
    options: OrderQuantityOptions,
    bounds: SupplementOrderBounds,
): boolean {
    return getSupplementOrderQuantityValidationError(quantity, options, bounds) === null;
}

/** Списывать остаток только при заказе «с россыпи», не при ровно одной пачке. */
/** Списывать остаток только при заказе «с россыпи», не при целых пачках. */
export function shouldDecrementSupplementStock(
    newQuantity: number,
    delta: number,
    availableQty: number,
    packSize?: number | null,
): boolean {
    if (delta <= 0 || availableQty <= 0) return false;
    if (isWholePackMultiple(delta, packSize)) return false;
    return true;
}

export function getSupplementStockDecrement(delta: number, availableQty: number): number {
    return Math.min(delta, Math.max(0, availableQty));
}

export function snapSupplementOrderQuantity(
    quantity: number,
    options: OrderQuantityOptions,
    bounds: SupplementOrderBounds,
): number {
    const max = getSupplementMaxQuantity(bounds);
    if (max == null) {
        // Для добора — только минимальный порог на добавку, без привязки к шагу
        const delta = quantity - bounds.currentQuantity;
        if (delta > 1e-9 && delta + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
            return bounds.currentQuantity + SUPPLEMENT_MIN_ORDER_QTY;
        }
        return quantity;
    }

    if (quantity <= 0) return 0;

    // При увеличении заказа — добавка не меньше минимального на добор
    {
        const delta = quantity - bounds.currentQuantity;
        if (delta > 1e-9 && delta + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
            quantity = bounds.currentQuantity + SUPPLEMENT_MIN_ORDER_QTY;
        }
    }

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    const packSize = bounds.supplierPackageAmount;

    if (remainderPool <= 0) {
        // Уменьшение заказа: возвращаем как есть в пределах currentQuantity
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return quantity;
        }
        const pack = positiveOrNull(packSize);
        if (pack != null) {
            return pack;
        }
        return 0;
    }

    if (isWholePackMultiple(quantity, packSize)) {
        return quantity;
    }

    // Ограничиваем max (= current + stock), но разрешаем ровно одну пачку
    const capped = Math.min(quantity, max);
    if (Math.abs(capped - max) < 1e-6) {
        return max;
    }

    if (isValidSupplementOrderQuantity(capped, options, bounds)) {
        return capped;
    }

    return 0;
}

export function formatSupplementOrderHint(bounds: SupplementOrderBounds, options: OrderQuantityOptions): string {
    const max = getSupplementMaxQuantity(bounds);
    const unit = options.unitShort ?? 'ед.';
    const step = getOrderQuantityStep(options);
    const packSize = positiveOrNull(bounds.supplierPackageAmount);
    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;

    if (remainderPool <= 0) {
        return packSize != null
            ? `Добор: остаток закончился · целыми пачками по ${formatQtyLabel(packSize)} ${unit}`
            : 'Добор: остаток закончился · только целыми пачками';
    }

    if (remainderPool + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
        return packSize != null
            ? `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · целыми пачками по ${formatQtyLabel(packSize)} ${unit}`
            : `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · только целыми пачками`;
    }

    const displayMax = getSupplementDisplayMax(bounds) ?? max!;
    const parts = [`мин. ${formatQtyLabel(SUPPLEMENT_MIN_ORDER_QTY)} ${unit}`];
    parts.push(`можно до ${formatQtyLabel(displayMax)} ${unit}`);
    if (packSize != null) {
        parts.push(`или пачками по ${formatQtyLabel(packSize)} ${unit}`);
    }
    return `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · ${parts.join(', ')}`;
}
