/**
 * Маппер Prisma → доменные типы заказа.
 *
 * Граница приложения: конвертирует Prisma-объекты (с Decimal) в чистые
 * доменные объекты (с number) для OrderBook.
 *
 * Логика маппинга PurchaseItem живёт в shared (`mapToPurchaseItem`),
 * здесь — тонкая обёртка для удобства вызова.
 */
import { mapToPurchaseItem as sharedMapToPurchaseItem, OrderLine } from '@zakupki/types';
import type { OrderLineStatus, PurchaseFulfillmentStatus, PurchaseItem } from '@zakupki/types';

export { mapToPurchaseItem } from '@zakupki/types';

/** Минимальный интерфейс строки, совместимый с Prisma orderLine. */
interface OrderLineRow {
    id: number;
    purchaseItemId: number;
    userId?: number;
    quantity?: unknown;
    amountDue?: unknown;
    packageCount?: unknown;
    status?: string | null;
    createdOnStage?: string | null;
    baseQuantity?: unknown;
    basePackageCount?: unknown;
}

/**
 * Конвертация Prisma findItemWithPrice → PurchaseItem (без orderLines).
 * Для OrderBook: строки передаются отдельно через toOrderLines.
 */
export function mapPurchaseItem(
    item: Parameters<typeof sharedMapToPurchaseItem>[0],
    packDiscountPercent: number,
): PurchaseItem {
    return sharedMapToPurchaseItem(item, packDiscountPercent);
}

/** Конвертация Prisma orderLines → OrderLine[] (immutable entities) — один шаг без VO-прослойки. */
export function toOrderLines(orderLines: OrderLineRow[] | null | undefined): OrderLine[] {
    return (orderLines ?? []).map((l) =>
        OrderLine.create({
            id: l.id,
            purchaseItemId: l.purchaseItemId,
            userId: l.userId ?? 0,
            quantity: Number(l.quantity ?? 0),
            amountDue: Number(l.amountDue ?? 0),
            packageCount: Number(l.packageCount ?? 0),
            status: (l.status ?? 'ACTIVE') as OrderLineStatus,
            createdOnStage: (l.createdOnStage ?? 'COLLECTION') as PurchaseFulfillmentStatus,
            baseQuantity: l.baseQuantity != null ? Number(l.baseQuantity) : null,
            basePackageCount: l.basePackageCount != null ? Number(l.basePackageCount) : null,
        }),
    );
}
