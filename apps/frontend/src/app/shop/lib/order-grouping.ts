/**
 * Группировка заказов по закупкам. Используется в orders/page.tsx.
 *
 * Агрегация строк (COLLECTION + supplement → одна запись) делегируется в доменную
 * mergeLines (shared) — единая логика с ботом и админкой.
 */
import { mergeLines, toOrderLinesVO } from '@zakupki/types';

/** Минимальный интерфейс orderLine для группировки. Поля приходят из tRPC (Decimal→string). */
export interface GroupableOrderLine {
    id: number;
    purchaseItemId: number;
    quantity?: unknown;
    amountDue: unknown;
    packageCount?: unknown;
    baseQuantity?: unknown;
    createdOnStage?: string | null;
    purchaseOrderId?: number | null;
    purchaseOrder?: { handoffStatus?: string | null } | null;
    /** Резолвнутые цена/курс/проценты для расшифровки цены (прикрепляет OrderService). */
    priceInfo?: {
        pricePerPackCurrency: number | null;
        rateToRub: number | null;
        packSize: number | null;
        orgFeePercent: number;
        deliveryPercent: number;
    } | null;
    purchaseItem?: {
        purchase?: {
            id: number;
            tag: string;
            fulfillmentStatus: string | null;
            status: string;
        };
    };
}

export interface OrderPurchaseGroup {
    id: number;
    orderNumber: number | null;
    tag: string;
    status: string;
    fulfillmentStatus: string | null;
    handoffStatus: string | null;
    /** Сгруппированные строки — по одной на purchaseItemId (COLLECTION + supplement объединены) */
    orders: MergedOrderLine[];
    total: number;
}

/** Объединённая строка заказа — COLLECTION + supplement для одного purchaseItem */
export interface MergedOrderLine {
    purchaseItemId: number;
    /** Сумма qty всех строк (COLLECTION + supplement) */
    quantity: number;
    /** Сумма amountDue всех строк */
    amountDue: number;
    /** packageCount из COLLECTION-строки */
    packageCount: number;
    /** baseQuantity из COLLECTION-строки */
    baseQuantity: number;
    /** Оригинальные ID строк */
    ids: number[];
    /** Первая строка — для доступа к purchaseItem/product (any, т.к. каждый компонент кастит под себя) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source: any;
}

export function groupOrdersByPurchase(orders: GroupableOrderLine[]): OrderPurchaseGroup[] {
    // Группируем по purchase, внутри — по purchaseItemId (накапливаем строки для mergeLines)
    const byPurchase = new Map<
        number,
        {
            group: Omit<OrderPurchaseGroup, 'orders' | 'total'>;
            total: number;
            byItem: Map<number, { source: GroupableOrderLine; lines: GroupableOrderLine[] }>;
        }
    >();

    for (const order of orders) {
        const purchase = order.purchaseItem?.purchase;
        if (!purchase) continue;
        const pid = purchase.id;

        let entry = byPurchase.get(pid);
        if (!entry) {
            entry = {
                group: {
                    id: pid,
                    orderNumber: order.purchaseOrderId ?? null,
                    tag: purchase.tag,
                    status: purchase.status,
                    fulfillmentStatus: purchase.fulfillmentStatus ?? null,
                    handoffStatus: order.purchaseOrder?.handoffStatus ?? null,
                },
                total: 0,
                byItem: new Map(),
            };
            byPurchase.set(pid, entry);
        }
        if (entry.group.orderNumber == null && order.purchaseOrderId != null) {
            entry.group.orderNumber = order.purchaseOrderId;
        }

        const piId = order.purchaseItemId;
        let itemEntry = entry.byItem.get(piId);
        if (!itemEntry) {
            itemEntry = { source: order, lines: [] };
            entry.byItem.set(piId, itemEntry);
        }
        itemEntry.lines.push(order);
        entry.total += Number(order.amountDue ?? 0);
    }

    // Сборка результата: mergeLines по каждому purchaseItem
    return Array.from(byPurchase.values()).map(({ group, total, byItem }) => ({
        ...group,
        total,
        orders: Array.from(byItem.values()).map(({ source, lines }) => {
            const aggregated = mergeLines(toOrderLinesVO(lines));
            return {
                purchaseItemId: source.purchaseItemId,
                quantity: aggregated.quantity,
                amountDue: aggregated.amountDue,
                packageCount: aggregated.packageCount,
                baseQuantity: aggregated.baseQuantity,
                ids: aggregated.lineIds,
                source,
            };
        }),
    }));
}
