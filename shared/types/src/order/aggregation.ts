/**
 * Агрегация строк заказа.
 *
 * Объединяет COLLECTION + supplement строки в единое представление
 * для отображения (корзина, список заказов, детали).
 */
import type { AggregatedOrder, OrderLineVO } from './types';

/** Только ACTIVE строки. */
function active(lines: OrderLineVO[]): OrderLineVO[] {
    return lines.filter((l) => l.status !== 'CANCELLED');
}

/**
 * Объединяет набор строк (предположительно одного пользователя + purchaseItem)
 * в один AggregatedOrder: quantity/amountDue/packageCount суммируются, baseQuantity/basePackageCount
 * берутся из COLLECTION-строки.
 */
export function mergeLines(lines: OrderLineVO[]): AggregatedOrder {
    let quantity = 0;
    let amountDue = 0;
    let packageCount = 0;
    let baseQuantity = 0;
    let basePackageCount = 0;
    let purchaseItemId = 0;
    const lineIds: number[] = [];

    for (const line of active(lines)) {
        quantity += line.quantity;
        amountDue += line.amountDue;
        packageCount += line.packageCount;
        lineIds.push(line.id);
        purchaseItemId = line.purchaseItemId;
        if (line.createdOnStage === 'COLLECTION') {
            baseQuantity = line.baseQuantity ?? 0;
            basePackageCount = line.basePackageCount ?? 0;
        }
    }

    return { purchaseItemId, quantity, amountDue, packageCount, baseQuantity, basePackageCount, lineIds };
}
