import {
    getSupplementPool,
    getOrderQuantityStep,
    getMinOrderQuantity,
    isValidOrderQuantity,
    type OrderQuantityOptions,
} from '@zakupki/types';

export type ShopOrderQuantityContext = {
    /** Минимальная фасовка — шаг кнопок +/− */
    minPackaging: number;
    /** Пул добора: сколько осталось доступно для добора */
    availablePool: number | null;
    /** Привести quantity к допустимому диапазону */
    snap: (quantity: number) => number;
    /** Проверить, валидно ли quantity */
    isValid: (quantity: number) => boolean;
};

/**
 * Строит контекст для UI заказа.
 *
 * @param input.isSupplement — закупка в фазе SUPPLEMENT/REORDER
 * @param input.baseQuantity — quantity, зафиксированный при входе в SUPPLEMENT (для расчёта пула)
 * @param input.currentQuantity — текущее quantity этого пользователя
 * @param input.availableRemainder — явно заданный админом пул добора (targetRemainder)
 * @param input.packSize — размер пачки поставщика (для авторасчёта пула)
 * @param input.sumOtherRemainders — Σ(quantity - baseQuantity) других пользователей (сколько они добрали)
 * @param input.totalOrderedQuantity — сумма quantity ВСЕХ пользователей
 * @param input.orderQtyOptions — параметры валидации количества
 */
export function buildShopOrderQuantityContext(input: {
    isSupplement: boolean;
    baseQuantity: number;
    currentQuantity: number;
    availableRemainder: number | null;
    packSize: number | null;
    sumOtherRemainders: number;
    totalOrderedQuantity: number;
    /** Σ(baseQuantity) по всем ACTIVE строкам — для фиксации количества пачек */
    totalBaseQuantity: number;
    orderQtyOptions: OrderQuantityOptions;
}): ShopOrderQuantityContext {
    const minPackaging = getOrderQuantityStep(input.orderQtyOptions);

    // Пул добора: сколько остатка доступно для добора
    const availablePool = input.isSupplement
        ? getSupplementPool({
              targetRemainder: input.availableRemainder,
              totalOrderedQuantity: input.totalOrderedQuantity,
              supplementClaimed: input.sumOtherRemainders,
              packSize: input.packSize,
              totalBaseQuantity: input.totalBaseQuantity,
          })
        : null;

    function snap(quantity: number): number {
        if (quantity <= 0) return 0;
        const min = getMinOrderQuantity(input.orderQtyOptions);
        const step = minPackaging;
        // Округляем вверх до шага
        const snapped = Math.ceil((quantity - 1e-9) / step) * step;
        return Math.max(min, snapped);
    }

    function isValid(quantity: number): boolean {
        if (quantity === 0) return true;
        return isValidOrderQuantity(quantity, input.orderQtyOptions);
    }

    return { minPackaging, availablePool, snap, isValid };
}