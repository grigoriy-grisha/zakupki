/**
 * Маппинг «рыхлых» строк (Prisma / tRPC-сериализованные, с Decimal/string)
 * в чистые доменные объекты (с number).
 *
 * Живёт в shared, чтобы и frontend (order-domain-mapper), и бот могли
 * переиспользовать одну конвертацию.
 */
import { parsePriceTiers } from '../pricing/parsing';
import type { PriceTier } from '../pricing/types';
import type { PurchaseFulfillmentStatus } from '../index';
import type { OrderLineVO, PurchaseItem } from './types';

/** Минимальная форма строки, которую умеет конвертировать маппер. */
export interface OrderLineRowLike {
    id: number;
    purchaseItemId: number;
    /** Опционален — нужен только для агрегации по пользователю; mergeLines не использует. */
    userId?: number;
    /** Опционален — дефолт 0 (некоторые формы с tRPC не включают quantity/amountDue). */
    quantity?: unknown;
    amountDue?: unknown;
    packageCount?: unknown;
    status?: unknown;
    createdOnStage?: unknown;
    baseQuantity?: unknown;
    basePackageCount?: unknown;
}

/** Конвертация одной строки. */
export function toOrderLineVO(line: OrderLineRowLike): OrderLineVO {
    return {
        id: line.id,
        purchaseItemId: line.purchaseItemId,
        userId: line.userId ?? 0,
        quantity: Number(line.quantity ?? 0),
        amountDue: Number(line.amountDue ?? 0),
        packageCount: Number(line.packageCount ?? 0),
        status: (line.status ?? 'ACTIVE') as OrderLineVO['status'],
        createdOnStage: (line.createdOnStage ?? 'COLLECTION') as PurchaseFulfillmentStatus,
        baseQuantity: line.baseQuantity != null ? Number(line.baseQuantity) : null,
        basePackageCount: line.basePackageCount != null ? Number(line.basePackageCount) : null,
    };
}

/** Конвертация массива строк. */
export function toOrderLinesVO(lines: readonly OrderLineRowLike[] | null | undefined): OrderLineVO[] {
    return (lines ?? []).map(toOrderLineVO);
}

/** Минимальная форма PurchaseItem, которую умеет конвертировать маппер. */
export interface PurchaseItemRowLike {
    id: number;
    priceOverride?: unknown;
    targetRemainder?: unknown;
    supplementStep?: unknown;
    supplierLimit?: unknown;
    supplierLimitUnit?: string | null;
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
    purchase: { fulfillmentStatus?: string | null };
}

/**
 * Конвертация Prisma/tRPC PurchaseItem → чистый доменный PurchaseItem (number).
 * Decimal/string → number, с дефолтами для null/undefined.
 */
export function mapToPurchaseItem(item: PurchaseItemRowLike, packDiscountPercent: number): PurchaseItem {
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
        minPackageAmount: item.product.minPackageAmount != null ? Number(item.product.minPackageAmount) : null,
        minPackageUnit: item.product.minPackageUnit ?? null,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        fulfillmentStatus: (item.purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus,
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        supplierLimit: item.supplierLimit != null ? Number(item.supplierLimit) : null,
        supplierLimitUnit: item.supplierLimitUnit ?? null,
    };
}
