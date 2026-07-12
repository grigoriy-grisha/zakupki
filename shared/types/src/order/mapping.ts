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
    // Per-purchase поля теперь на самом PurchaseItem (миграция Supplier):
    pricePerUnit?: unknown;
    priceOverride?: unknown;
    priceTiers?: unknown;
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
    supplierPackageTiers?: unknown;
    minPackageAmount?: unknown;
    minPackageUnit?: string | null;
    supplementStep?: unknown;
    targetRemainder?: unknown;
    supplierLimit?: unknown;
    supplierLimitUnit?: string | null;
    supplierId?: number | null;
    supplier?: { id: number; name: string } | null;
    // Product — только каталожные данные (unit, multiplicity):
    product: {
        unitCode?: string;
        multiplicity?: unknown;
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
        pricePerUnit: item.pricePerUnit != null ? Number(item.pricePerUnit) : 0,
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
        priceTiers: (parsePriceTiers(item.priceTiers) as PriceTier[]) ?? null,
        packDiscountPercent,
        supplierPackageAmount:
            item.supplierPackageAmount != null ? Number(item.supplierPackageAmount) : null,
        supplierPackageUnit: item.supplierPackageUnit ?? null,
        supplierPackagePrice:
            item.supplierPackagePrice != null ? Number(item.supplierPackagePrice) : null,
        supplierPackageTiers: (parsePriceTiers(item.supplierPackageTiers) as PriceTier[]) ?? null,
        unitCode: item.product.unitCode ?? 'piece',
        multiplicity: Number(item.product.multiplicity ?? 1),
        minPackageAmount: item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
        minPackageUnit: item.minPackageUnit ?? null,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        fulfillmentStatus: (item.purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus,
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        supplierLimit: item.supplierLimit != null ? Number(item.supplierLimit) : null,
        supplierLimitUnit: item.supplierLimitUnit ?? null,
        supplierId: item.supplierId ?? item.supplier?.id ?? null,
        supplierName: item.supplier?.name ?? null,
    };
}
