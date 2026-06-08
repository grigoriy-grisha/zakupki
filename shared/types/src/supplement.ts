/**
 * Упрощённый модуль для расчёта пула добора (supplement).
 *
 * Логика:
 *  1. Если админ явно задал targetRemainder — pool = targetRemainder.
 *  2. Авторасчёт: pool = ceil(totalOrdered / packSize) * packSize - totalOrdered.
 *     Пример: пачка 100гр, заказано 350гр → ceil(350/100)*100 = 400, pool = 50гр.
 *
 * Возвращает null если ограничений нет (нет ни targetRemainder, ни packSize).
 */
export function getSupplementPool(input: {
    targetRemainder: number | null | undefined;
    totalOrderedQuantity: number;
    totalReservedRemainder: number;
    packSize: number | null | undefined;
}): number | null {
    const { targetRemainder, totalOrderedQuantity, totalReservedRemainder, packSize } = input;

    // Путь 1: админский лимит
    if (targetRemainder != null) {
        const pool = Number(targetRemainder);
        const claimed = Math.max(0, totalReservedRemainder);
        return Math.max(0, pool - claimed);
    }

    // Путь 2: авторасчёт по остатку последней пачки
    if (packSize == null || packSize <= 0) return null;

    const sumQty = totalOrderedQuantity;
    // Округление вверх до пачки — вычитаем epsilon чтобы избежать float-погрешности
    const packsNeeded = Math.max(1, Math.ceil(sumQty / packSize - 1e-9));
    const pool = Math.max(0, packsNeeded * packSize - sumQty);

    const claimed = Math.max(0, totalReservedRemainder);
    return Math.max(0, pool - claimed);
}