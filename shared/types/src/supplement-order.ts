import { normalizeSupplierPackUnit } from './pack-discount-pricing';
import {
    getOrderQuantityStep,
    getOrderQuantityValidationError,
    snapOrderQuantity,
    type OrderQuantityOptions,
} from './pricing';

/** Минимальный заказ на доборе для весовых товаров (гр). */
export const SUPPLEMENT_MIN_ORDER_QTY = 10;

/** Минимальный заказ на доборе для штучных товаров. */
export const SUPPLEMENT_MIN_ORDER_QTY_PIECES = 1;

function isPieceOrderUnit(unit: string | null | undefined): boolean {
    if (!unit) return false;
    const n = unit.trim().toLowerCase().replace(/\./g, '');
    if (n === 'шт' || n.startsWith('шт')) return true;
    if (n.includes('туб')) return true;
    return false;
}

/** Минимальная добавка на доборе: 1 шт (штучный товар) или 10 гр. */
export function getSupplementMinOrderQty(options: OrderQuantityOptions): number {
    if (isPieceOrderUnit(options.minPackageUnit) || isPieceOrderUnit(options.unitShort)) {
        return SUPPLEMENT_MIN_ORDER_QTY_PIECES;
    }
    if (
        normalizeSupplierPackUnit(options.minPackageUnit) === 'гр' ||
        normalizeSupplierPackUnit(options.unitShort) === 'гр'
    ) {
        return SUPPLEMENT_MIN_ORDER_QTY;
    }
    const raw = (options.unitShort ?? options.minPackageUnit ?? '').trim().toLowerCase();
    if (raw.startsWith('гр') || raw === 'g') return SUPPLEMENT_MIN_ORDER_QTY;
    if (isPieceOrderUnit(options.unitShort) || isPieceOrderUnit(options.minPackageUnit)) {
        return SUPPLEMENT_MIN_ORDER_QTY_PIECES;
    }
    return SUPPLEMENT_MIN_ORDER_QTY;
}

/** Минимальное количество в заказе на доборе (не ниже каталожного минимума). */
export function getSupplementEffectiveMinQty(
    catalogMinQty: number,
    options: OrderQuantityOptions,
): number {
    return Math.max(catalogMinQty, getSupplementMinOrderQty(options));
}

/** Шаг на кнопках ± в UI на доборе. */
export function getSupplementUiOrderStep(catalogStep: number, options: OrderQuantityOptions): number {
    return Math.max(catalogStep, getSupplementMinOrderQty(options));
}

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
    /** С «Оплаты» до «Фасовки»: добор только из остатка, пачки запрещены. */
    remainderOnly?: boolean;
};

/** Информация о защищённых пачках, добавленных на доборе. */
export type SupplementPackProtection = {
    /** Сколько целых пачек было добавлено на этапе добора. */
    supplementPacksAdded: number;
    /** Размер пачки поставщика. */
    packSize: number;
};

/** Результат валидации уменьшения заказа с учётом защиты пачек. */
export type PackReductionResult = {
    valid: boolean;
    /** Новое количество защищённых пачек (−1 если невалидно). */
    newPacks: number;
    /** Сообщение об ошибке или null. */
    error: string | null;
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

/** Остаток на доборе закончился или меньше мин. — кнопка «+» по шагу недоступна; на этапе REORDER ещё +пачка. */
export function isSupplementOnlyPacksOrder(
    bounds: SupplementOrderBounds,
    options: OrderQuantityOptions,
): boolean {
    if (bounds.availableQty == null) return false;

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    if (remainderPool <= 0) {
        if (bounds.remainderOnly) return true;
        return positiveOrNull(bounds.supplierPackageAmount) != null;
    }

    if (remainderPool + 1e-9 < getSupplementMinOrderQty(options)) {
        if (bounds.remainderOnly) return true;
        return positiveOrNull(bounds.supplierPackageAmount) != null;
    }

    return false;
}

/** Целые пачки на доборе разрешены (этап «Доборы»). */
export function isSupplementPacksAllowed(bounds: SupplementOrderBounds): boolean {
    return !bounds.remainderOnly;
}

/**
 * Добор:
 * — минимум на добавку: 10 гр или 1 шт (штучный товар);
 * — с остатка: не больше свободного остатка (кроме целых пачек);
 * — остаток меньше пачки (напр. 11 при пачке 12): только до остатка или целые пачки;
 * — остаток 0 или < минималки: только целые пачки (кратно размеру поставщика).
 */
export function getSupplementOrderQuantityValidationError(
    quantity: number,
    options: OrderQuantityOptions,
    bounds: SupplementOrderBounds,
    packProtection?: SupplementPackProtection | null,
): string | null {
    if (!isPositive(quantity)) return 'Укажите положительное количество';

    // Проверяем защиту пачек ДО остальных проверок
    if (packProtection && bounds.currentQuantity > 0) {
        const packResult = validateSupplementPackReduction(quantity, bounds.currentQuantity, packProtection);
        if (!packResult.valid) return packResult.error;
    }

    const unit =
        positiveOrNull(options.minPackageAmount) != null && options.minPackageUnit
            ? options.minPackageUnit
            : (options.unitShort ?? 'ед.');
    const supplementMin = getSupplementMinOrderQty(options);
    const minLabel = `${formatQtyLabel(supplementMin)} ${unit}`;

    const max = getSupplementMaxQuantity(bounds);
    if (max == null) {
        const delta = quantity - bounds.currentQuantity;
        if (delta > 1e-9 && delta + 1e-9 < supplementMin) {
            return `На доборе можно заказывать от ${minLabel}`;
        }
        return null;
    }

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    const packSize = bounds.supplierPackageAmount;
    const packLabel = positiveOrNull(packSize);
    const delta = quantity - bounds.currentQuantity;
    const remainderOnly = Boolean(bounds.remainderOnly);
    // Целые пачки: итог или добавка кратна размеру пачки
    const wholePack =
        isWholePackMultiple(quantity, packSize) ||
        (packLabel != null && delta > 1e-9 && isWholePackMultiple(delta, packSize));

    if (remainderOnly && wholePack && delta > 1e-9) {
        return 'На этом этапе добор только из свободного остатка, целыми пачками заказать нельзя';
    }

    if (remainderPool <= 0) {
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return null;
        }
        if (remainderOnly) {
            return 'Свободный остаток закончился';
        }
        if (!wholePack) {
            return packLabel != null
                ? `Свободный остаток закончился. На добор можно заказать только целыми пачками — ${formatQtyLabel(packLabel)} ${unit}.`
                : 'Свободный остаток закончился. На добор можно заказать только целыми пачками.';
        }
        return null;
    }

    // Остаток меньше минималки — с остатка не заказать; на REORDER ещё пачки
    if (remainderPool + 1e-9 < supplementMin) {
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return null;
        }
        if (remainderOnly) {
            return `Остаток ${formatQtyLabel(remainderPool)} ${unit} — меньше минимального заказа (${minLabel})`;
        }
        if (!wholePack) {
            return packLabel != null
                ? `Остаток ${formatQtyLabel(remainderPool)} ${unit} — меньше минимального заказа. Можно только целыми пачками — ${formatQtyLabel(packLabel)} ${unit}.`
                : `Остаток ${formatQtyLabel(remainderPool)} ${unit} — меньше минимального заказа. Можно заказать только целыми пачками.`;
        }
        return null;
    }

    if (wholePack && !remainderOnly) {
        return null;
    }

    if (remainderOnly && quantity > max + 1e-9) {
        return `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} (свободный остаток)`;
    }

    // Когда остаток < пачки: не больше остатка или целые пачки (только REORDER)
    if (
        !remainderOnly &&
        packLabel != null &&
        remainderPool < packLabel &&
        quantity > max + 1e-9
    ) {
        return `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} или целыми пачками — ${formatQtyLabel(packLabel)} ${unit}`;
    }

    if (quantity > max + 1e-9) {
        return remainderOnly
            ? `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} (свободный остаток)`
            : `На добор можно заказать не более ${formatQtyLabel(remainderPool)} ${unit} (свободный остаток) или целыми пачками`;
    }

    // Минимальный заказ на добор при увеличении (проверяем добавку, не итог)
    if (delta > 1e-9 && delta + 1e-9 < supplementMin) {
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

/**
 * Валидация уменьшения заказа на доборе с учётом защищённых пачек.
 *
 * Пачки, добавленные на доборе (supplementPacksAdded), можно удалить только целиком.
 * Свободную часть заказа (оригинал + россыпь) можно уменьшать как угодно.
 *
 * Пример: qty=280, packs=1, packSize=200, free=80
 *   280→200 (−80 free)  ✓
 *   280→80  (−1 pack)   ✓
 *   280→180 (−100 pack) ✗ — частичное удаление пачки
 */
export function validateSupplementPackReduction(
    newQuantity: number,
    oldQuantity: number,
    protection: SupplementPackProtection,
): PackReductionResult {
    const { supplementPacksAdded, packSize } = protection;

    // Нет защищённых пачек — любая сумма OK
    if (supplementPacksAdded <= 0 || packSize <= 0) {
        return { valid: true, newPacks: 0, error: null };
    }

    // Увеличение или без изменений — не влияет на защиту
    if (newQuantity >= oldQuantity) {
        return { valid: true, newPacks: supplementPacksAdded, error: null };
    }

    const freePortion = oldQuantity - supplementPacksAdded * packSize;

    // Проверяем, попадает ли newQuantity в допустимую зону:
    // Для k от supplementPacksAdded до 0: [k*packSize, k*packSize + freePortion]
    for (let k = supplementPacksAdded; k >= 0; k--) {
        const lower = k * packSize;
        const upper = k * packSize + freePortion;
        if (newQuantity >= lower - 1e-9 && newQuantity <= upper + 1e-9) {
            return { valid: true, newPacks: k, error: null };
        }
    }

    const packLabel = `${formatQtyLabel(packSize)}`;
    return {
        valid: false,
        newPacks: -1,
        error: `Нельзя убрать часть пачки — можно удалить только целиком (${packLabel}) или оставить`,
    };
}

/**
 * Рассчитать изменение остатка при изменении заказа на доборе.
 * Остаток (availableQty) списывается/восстанавливается только для свободной части,
 * не для целых пачек (пачки не списываются из остатка).
 */
export function calcSupplementStockChange(
    oldQuantity: number,
    newQuantity: number,
    oldPacks: number,
    newPacks: number,
    packSize: number,
): number {
    const oldFree = oldQuantity - oldPacks * packSize;
    const newFree = newQuantity - newPacks * packSize;
    const freeDelta = newFree - oldFree;

    // positive = нужно списать из остатка, negative = вернуть в остаток
    if (Math.abs(freeDelta) < 1e-9) return 0;
    return freeDelta;
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
    const supplementMin = getSupplementMinOrderQty(options);
    const max = getSupplementMaxQuantity(bounds);
    if (max == null) {
        // Для добора — только минимальный порог на добавку, без привязки к шагу
        const delta = quantity - bounds.currentQuantity;
        if (delta > 1e-9 && delta + 1e-9 < supplementMin) {
            return bounds.currentQuantity + supplementMin;
        }
        return quantity;
    }

    if (quantity <= 0) return 0;

    // При увеличении заказа — добавка не меньше минимального на добор
    {
        const delta = quantity - bounds.currentQuantity;
        if (delta > 1e-9 && delta + 1e-9 < supplementMin) {
            quantity = bounds.currentQuantity + supplementMin;
        }
    }

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    const packSize = bounds.supplierPackageAmount;

    if (remainderPool <= 0) {
        if (quantity <= bounds.currentQuantity + 1e-9) {
            return quantity;
        }
        if (bounds.remainderOnly) {
            return bounds.currentQuantity;
        }
        const pack = positiveOrNull(packSize);
        if (pack != null) {
            return pack;
        }
        return 0;
    }

    if (bounds.remainderOnly && isWholePackMultiple(quantity, packSize) && quantity > bounds.currentQuantity + 1e-9) {
        const capped = Math.min(quantity, max);
        if (isValidSupplementOrderQuantity(capped, options, bounds)) {
            return capped;
        }
        return bounds.currentQuantity;
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

/** Подпись на миниатюре фото: сколько свободного остатка на доборе. */
export function formatSupplementPhotoRemainderBadge(
    bounds: SupplementOrderBounds,
    orderQtyOptions: OrderQuantityOptions,
): string | null {
    if (bounds.availableQty == null) return null;

    const unit = orderQtyOptions.minPackageUnit ?? orderQtyOptions.unitShort ?? 'ед.';
    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;
    if (remainderPool <= 0) {
        return bounds.remainderOnly ? 'остаток 0' : 'остаток 0 · пачки';
    }
    return `остаток ${formatQtyLabel(remainderPool)} ${unit}`;
}

/** Краткая строка превью карточки: добор, остаток, мин. заказ (не «Мин. фасовка»). */
export function formatSupplementCardPreviewHint(
    bounds: SupplementOrderBounds,
    orderQtyOptions: OrderQuantityOptions,
    options?: { soldOut?: boolean },
): string {
    const unit = orderQtyOptions.minPackageUnit ?? orderQtyOptions.unitShort ?? 'ед.';
    const supplementMin = getSupplementMinOrderQty(orderQtyOptions);
    const minLabel = `от ${formatQtyLabel(supplementMin)} ${unit}`;

    if (bounds.availableQty == null) {
        return `Добор · ${minLabel}`;
    }

    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;

    if (remainderPool <= 0) {
        return bounds.remainderOnly ? 'Добор · остаток закончился' : 'Добор · только пачками';
    }

    if (isSupplementOnlyPacksOrder(bounds, orderQtyOptions)) {
        return bounds.remainderOnly
            ? `Добор · остаток ${formatQtyLabel(remainderPool)} ${unit} · добавить нельзя`
            : `Добор · остаток ${formatQtyLabel(remainderPool)} ${unit} · только пачками`;
    }

    if (bounds.remainderOnly) {
        return `Добор · остаток ${formatQtyLabel(remainderPool)} ${unit} · ${minLabel}`;
    }

    if (options?.soldOut) {
        return 'Добор · разобрано';
    }

    return `Добор · остаток ${formatQtyLabel(remainderPool)} ${unit} · ${minLabel}`;
}

/** @deprecated используйте formatSupplementCardPreviewHint */
export function formatSupplementMinOrderPreviewHint(unitShort: string): string {
    return formatSupplementCardPreviewHint(
        { availableQty: null, currentQuantity: 0, supplierPackageAmount: null },
        { unitShort },
    );
}

export function formatSupplementOrderHint(bounds: SupplementOrderBounds, options: OrderQuantityOptions): string {
    const max = getSupplementMaxQuantity(bounds);
    const unit = options.unitShort ?? 'ед.';
    const step = getOrderQuantityStep(options);
    const packSize = positiveOrNull(bounds.supplierPackageAmount);
    const remainderPool = getSupplementRemainderPool(bounds) ?? 0;

    const supplementMin = getSupplementMinOrderQty(options);

    if (remainderPool <= 0) {
        return bounds.remainderOnly
            ? 'Добор: остаток закончился'
            : packSize != null
              ? `Добор: остаток закончился · целыми пачками по ${formatQtyLabel(packSize)} ${unit}`
              : 'Добор: остаток закончился · только целыми пачками';
    }

    if (remainderPool + 1e-9 < supplementMin) {
        return bounds.remainderOnly
            ? `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} — меньше мин. заказа (${formatQtyLabel(supplementMin)} ${unit})`
            : packSize != null
              ? `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · целыми пачками по ${formatQtyLabel(packSize)} ${unit}`
              : `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · только целыми пачками`;
    }

    const displayMax = getSupplementDisplayMax(bounds) ?? max!;
    const parts = [`заказ от ${formatQtyLabel(supplementMin)} ${unit}`];
    parts.push(`можно до ${formatQtyLabel(displayMax)} ${unit}`);
    if (packSize != null && !bounds.remainderOnly) {
        parts.push(`или пачками по ${formatQtyLabel(packSize)} ${unit}`);
    }
    return `Добор: остаток ${formatQtyLabel(remainderPool)} ${unit} · ${parts.join(', ')}`;
}
