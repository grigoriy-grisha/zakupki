/**
 * Упрощённые функции проверки прав на заказ по статусу закупки.
 *
 * COLLECTION — свободное добавление/удаление товара
 * REORDER — тоже можно добавлять/убирать товар
 * PAYMENT…IN_TRANSIT_TO_ORGANIZER — только просмотр, ничего менровать нельзя
 * PACKAGING, READY_FOR_PICKUP — полностью заморожено
 */
export function canAdjustOrder(fulfillmentStatus: string): boolean {
    return fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';
}

export function canCancelOrder(fulfillmentStatus: string): boolean {
    return fulfillmentStatus === 'COLLECTION';
}