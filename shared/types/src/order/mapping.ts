/**
 * Маппинг «рыхлых» строк (Prisma / tRPC-сериализованные, с Decimal/string)
 * в чистые OrderLineVO (с number).
 *
 * Живёт в shared, чтобы и frontend (order-domain-mapper), и бот могли
 * переиспользовать одну конвертацию.
 */
import type { PurchaseFulfillmentStatus } from '../index';
import type { OrderLineVO } from './types';

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
