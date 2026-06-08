/**
 * Расчёт пула добора (supplement).
 *
 * Логика:
 *  1. Если админ явно задал targetRemainder — pool = targetRemainder - supplementClaimed.
 *     supplementClaimed = Σ(quantity - baseQuantity) по всем пользователям.
 *  2. Авторасчёт: пачки фиксируются по замороженному baseQuantity на момент COLLECTION→REORDER.
 *     packsNeeded = ceil(Σ(baseQuantity) / packSize) — сколько пачек уже заказано у поставщика.
 *     pool = packsNeeded * packSize - totalOrdered — сколько осталось в уже заказанных пачках.
 *
 *     Пример: пачка 100гр, на момент заморозки Σ(baseQuantity) = 120 → 2 пачки.
 *     Пользователь убавил до 70: pool = 200 - 70 = 130.
 *     Если baseQuantity ещё не заморожен (COLLECTION) — fallback на totalOrdered.
 *
 * Возвращает null если ограничений нет (нет ни targetRemainder, ни packSize).
 */
export function getSupplementPool(input: {
    targetRemainder: number | null | undefined;
    totalOrderedQuantity: number;
    /** Σ(quantity - baseQuantity) — сколько пользователи УЖЕ добрали сверх базового заказа */
    supplementClaimed: number;
    packSize: number | null | undefined;
    /** Σ(baseQuantity) по всем ACTIVE строкам — для фиксации количества пачек.
     *  0 или undefined = заморозки ещё не было (COLLECTION), fallback на totalOrdered. */
    totalBaseQuantity?: number;
}): number | null {
    const { targetRemainder, supplementClaimed, packSize } = input;
    const totalOrderedQuantity = input.totalOrderedQuantity;
    const totalBaseQuantity = input.totalBaseQuantity ?? 0;

    // Путь 1: админский лимит — вычитаем то, что уже добрали
    if (targetRemainder != null) {
        const pool = Number(targetRemainder);
        return Math.max(0, pool - Math.max(0, supplementClaimed));
    }

    // Путь 2: авторасчёт по остатку от замороженных пачек
    if (packSize == null || packSize <= 0) return null;

    // Пачки фиксируются по замороженному baseQuantity.
    // Если baseQuantity ещё не заморожен (COLLECTION) — считаем от текущего total.
    const baseForPacks = totalBaseQuantity > 0 ? totalBaseQuantity : totalOrderedQuantity;
    const packsNeeded = Math.max(1, Math.ceil(baseForPacks / packSize - 1e-9));
    return Math.max(0, packsNeeded * packSize - totalOrderedQuantity);
}
