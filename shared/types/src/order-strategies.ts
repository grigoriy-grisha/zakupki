/**
 * Точные проверки прав на заказы по статусу закупки.
 *
 * Таблица разрешений (из plan):
 *
 * | Действие              | COLLECTION | REORDER | PAYMENT | После PAYMENT |
 * |-----------------------|------------|---------|---------|---------------|
 * | Добавить новый товар  | ✅         | ❌      | ❌      | ❌            |
 * | Убавить существующий  | ✅         | ✅      | ❌      | ❌            |
 * | Убрать полностью      | ✅         | ✅      | ❌      | ❌            |
 * | Добрать из остатка    | ❌         | ✅      | ✅      | ✅            |
 * | Отменить весь заказ   | ✅         | ✅      | ✅      | ❌            |
 */

/** Статусы, на которых можно добавлять НОВЫЙ товар (создавать OrderLine). */
export function canAddNewItem(fulfillmentStatus: string): boolean {
    return fulfillmentStatus === 'COLLECTION';
}

/**
 * Статусы, на которых можно УМЕНЬШИТЬ существующий заказ.
 * На PAYMENT+ — можно убавить только ДОБОРНУЮ часть (не ниже baseQuantity).
 */
export function canDecreaseOrder(fulfillmentStatus: string): boolean {
    if (fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER') return true;
    // На PAYMENT+ тоже разрешаем убавку, но service-слой проверит baseQuantity
    const idx = ALL_STATUSES.indexOf(fulfillmentStatus as any);
    const paymentIdx = ALL_STATUSES.indexOf('PAYMENT');
    return idx >= 0 && idx >= paymentIdx;
}

/** Статусы, на которых можно УВЕЛИЧИТЬ заказ. COLLECTION — свободно, REORDER+ — добор из остатка. */
export function canIncreaseFromRemainder(fulfillmentStatus: string): boolean {
    if (fulfillmentStatus === 'COLLECTION') return true;
    const idx = ALL_STATUSES.indexOf(fulfillmentStatus as any);
    const reorderIdx = ALL_STATUSES.indexOf('REORDER');
    return idx >= 0 && idx >= reorderIdx;
}

/** Статусы, на которых можно ОТМЕНИТЬ заказ. */
export function canCancelOrder(fulfillmentStatus: string): boolean {
    return (
        fulfillmentStatus === 'COLLECTION' ||
        fulfillmentStatus === 'REORDER' ||
        fulfillmentStatus === 'PAYMENT'
    );
}

/** Обратная совместимость — можно ли вообще менять заказ. */
export function canAdjustOrder(fulfillmentStatus: string): boolean {
    return (
        canAddNewItem(fulfillmentStatus) ||
        canDecreaseOrder(fulfillmentStatus) ||
        canIncreaseFromRemainder(fulfillmentStatus)
    );
}

/** Доступен ли пул добора (REORDER и все последующие стадии). */
export function isSupplementPhase(fulfillmentStatus: string): boolean {
    const idx = ALL_STATUSES.indexOf(fulfillmentStatus as any);
    const reorderIdx = ALL_STATUSES.indexOf('REORDER');
    return idx >= 0 && idx >= reorderIdx;
}

const ALL_STATUSES = [
    'COLLECTION',
    'REORDER',
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP',
] as const;
