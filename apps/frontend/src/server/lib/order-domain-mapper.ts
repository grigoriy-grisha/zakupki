/**
 * Маппер Prisma → доменные типы заказа.
 *
 * Граница приложения: конвертирует Prisma-объекты (с Decimal) в чистые
 * доменные объекты (с number) для OrderBook.
 */
import { OrderLine, parsePriceTiers } from '@zakupki/types';
import type {
    OrderLineStatus,
    PriceTier,
    PurchaseFulfillmentStatus,
    PurchaseItem,
} from '@zakupki/types';

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
export function mapToPurchaseItem(
    item: {
        id: number;
        targetRemainder?: unknown;
        supplementStep?: unknown;
        product: {
            pricePerUnit: unknown;
            priceTiers?: unknown;
            supplierPackageAmount?: unknown;
            supplierPackageUnit?: string | null;
            supplierPackagePrice?: unknown;
            unitCode?: string;
            multiplicity?: unknown;
            minPackageAmount?: unknown;
            minPackageUnit?: string | null;
        };
        priceOverride?: unknown;
        purchase: {
            fulfillmentStatus?: string | null;
        };
    },
    packDiscountPercent: number,
): PurchaseItem {
    return {
        purchaseItemId: item.id,
        pricePerUnit: Number(item.product.pricePerUnit),
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
        priceTiers: (parsePriceTiers(item.product.priceTiers) as PriceTier[]) ?? null,
        packDiscountPercent,
        supplierPackageAmount:
            item.product.supplierPackageAmount != null ? Number(item.product.supplierPackageAmount) : null,
        supplierPackageUnit: item.product.supplierPackageUnit ?? null,
        supplierPackagePrice:
            item.product.supplierPackagePrice != null ? Number(item.product.supplierPackagePrice) : null,
        unitCode: item.product.unitCode ?? 'piece',
        multiplicity: Number(item.product.multiplicity ?? 1),
        minPackageAmount:
            item.product.minPackageAmount != null ? Number(item.product.minPackageAmount) : null,
        minPackageUnit: item.product.minPackageUnit ?? null,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        fulfillmentStatus: (item.purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus,
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
    };
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
