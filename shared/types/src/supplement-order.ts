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
 * — с остатка: не больше свободного остатка (кроме ровно одной пачки);
 * — остаток меньше пачки (напр. 11 при пачке 12): только до остатка или ровно одна пачка, не 13+;
 * — если уже есть заказ (currentQuantity > 0): итоговое количество не должно быть
 *   больше остатка и меньше пачки — иначе создаётся «промежуточный» заказ;
 * — остаток 0: только ровно одна пачка (размер фасовки поставщика).
 */
export function getSupplementOrderQuantityValidationError(
    quantity: number,
    options: OrderQuantityOptions,
    bounds: SupplementOrderBounds,
): string | null {
    if (!isPositive(quantity)) return 'Укажите положительное количество';

    const max = getSupplementMaxQuantity(bounds);
    if (max == null) {
        if (quantity > bounds.currentQuantity + 1e-9 && quantity + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
            const unit = options.unitShort ?? 'ед.';
            return `Минимальный заказ на добор: ${formatQtyLabel(SUPPLEMENT_MIN_ORDER_QTY)} ${unit}`;
        }
        return getOrderQuantityValidationError(quantity, options);
    }

    const unit =
        positiveOrNull(options.minPackageAmount) != null && options.minPackageUnit
            ? options.minPackageUnit
            : (options.unitShort ?? 'ед.');

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    const packSize = bounds.supplierPackageAmount;
    const packLabel = positiveOrNull(packSize);
    const delta = quantity - bounds.currentQuantity;
    // Разрешаем ровно одну пачку: итог = пачка ИЛИ добавляемое количество = пачка
    const exactPack =
        isExactSupplierPackOrder(quantity, packSize) ||
        (packLabel != null && delta > 1e-9 && Math.abs(delta - packLabel) < 1e-6);

    if (remainderPool <= 0) {
        // Уменьшение существующего заказа — всегда разрешено
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return getOrderQuantityValidationError(quantity, options);
        }
        if (!exactPack) {
            return packLabel != null
                ? `Свободный остаток закончился. На добор можно заказать только одну пачку — ровно ${formatQtyLabel(packLabel)} ${unit}.`
                : 'Свободный остаток закончился. На добор можно заказать только одну целую пачку.';
        }
        return null;
    }

    if (exactPack) {
        return null;
    }

    // Когда остаток < пачки: итоговое количество не должно быть между max и пачкой
    // (иначе получается «промежуточная» сумма между остатком и пачкой).
    if (
        packLabel != null &&
        remainderPool > 0 &&
        remainderPool < packLabel &&
        quantity > max + 1e-9
    ) {
        return `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} или ровно одну пачку — ${formatQtyLabel(packLabel)} ${unit} (чтобы не появился новый остаток)`;
    }

    if (quantity > max + 1e-9) {
        return `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} (свободный остаток)`;
    }

    // Минимальный заказ на добор при увеличении
    if (quantity > bounds.currentQuantity + 1e-9 && quantity + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
        return `Минимальный заказ на добор: ${formatQtyLabel(SUPPLEMENT_MIN_ORDER_QTY)} ${unit}`;
    }

    // Взять весь остаток: разрешаем без проверки шага
    if (remainderPool > 0 && Math.abs(quantity - remainderPool) < 1e-6) {
        return null;
    }

    // Забрать всё (current + stock): разрешаем когда stock >= pack
    if (Math.abs(quantity - max) < 1e-6) {
        return null;
    }

    return getOrderQuantityValidationError(quantity, options);
}

export function isValidSupplementOrderQuantity(
    quantity: number,
    options: OrderQuantityOptions,
    bounds: SupplementOrderBounds,
): boolean {
    return getSupplementOrderQuantityValidationError(quantity, options, bounds) === null;
}

/** Списывать остаток только при заказе «с россыпи», не при ровно одной пачке. */
export function shouldDecrementSupplementStock(
    newQuantity: number,
    delta: number,
    availableQty: number,
    packSize?: number | null,
): boolean {
    if (delta <= 0 || availableQty <= 0) return false;
    if (isExactSupplierPackOrder(newQuantity, packSize)) return false;
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
        const qty = quantity > bounds.currentQuantity + 1e-9 && quantity + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY
            ? SUPPLEMENT_MIN_ORDER_QTY
            : quantity;
        return snapOrderQuantity(qty, options);
    }

    if (quantity <= 0) return 0;

    // При увеличении заказа — не меньше минимального на добор
    if (quantity > bounds.currentQuantity + 1e-9 && quantity + 1e-9 < SUPPLEMENT_MIN_ORDER_QTY) {
        quantity = SUPPLEMENT_MIN_ORDER_QTY;
    }

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    const packSize = bounds.supplierPackageAmount;

    if (remainderPool <= 0) {
        // Уменьшение заказа: snap до валидного шага в пределах currentQuantity
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return snapOrderQuantity(quantity, options, { max: bounds.currentQuantity });
        }
        const pack = positiveOrNull(packSize);
        if (pack != null) {
            return pack;
        }
        return 0;
    }

    if (isExactSupplierPackOrder(quantity, packSize)) {
        return quantity;
    }

    // Ограничиваем max (= current + stock), но разрешаем ровно одну пачку
    const effectiveCap = max;

    const capped = Math.min(quantity, effectiveCap);
    if (Math.abs(capped - effectiveCap) < 1e-6) {
        return max;
    }

    const snapped = snapOrderQuantity(capped, options, { max: effectiveCap });
    if (snapped > 0) {
        return snapped;
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
            ? `Добор: остаток закончился · только одна пачка ${formatQtyLabel(packSize)} ${unit}`
            : 'Добор: остаток закончился · только одна целая пачка';
    }

    const displayMax = getSupplementDisplayMax(bounds) ?? max!;
    const parts = [`мин. ${formatQtyLabel(SUPPLEMENT_MIN_ORDER_QTY)} ${unit}`];
    parts.push(`можно до ${formatQtyLabel(displayMax)} ${unit}`);
    if (packSize != null) {
        parts.push(`или одну пачку — ${formatQtyLabel(packSize)} ${unit}`);
    }
    return `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · ${parts.join(', ')}`;
}
