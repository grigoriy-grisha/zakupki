/** PurchaseFulfillmentStatus is defined in index.ts — re-export via type to avoid circular import */
import type { PurchaseFulfillmentStatus } from './index';

export const FULFILLMENT_TRANSITIONS: Record<PurchaseFulfillmentStatus, readonly PurchaseFulfillmentStatus[]> = {
    COLLECTION: ['REORDER'],
    REORDER: ['COLLECTION', 'PAYMENT'],
    PAYMENT: ['REORDER', 'SUPPLIER_ASSEMBLY'],
    SUPPLIER_ASSEMBLY: ['PREPARING_SHIPMENT_RF'],
    PREPARING_SHIPMENT_RF: ['IN_TRANSIT_RF'],
    IN_TRANSIT_RF: ['IN_TRANSIT_TO_ORGANIZER'],
    IN_TRANSIT_TO_ORGANIZER: ['PACKAGING'],
    PACKAGING: ['READY_FOR_PICKUP'],
    READY_FOR_PICKUP: [],
};

export function canTransitionFulfillment(from: PurchaseFulfillmentStatus, to: PurchaseFulfillmentStatus): boolean {
    return (FULFILLMENT_TRANSITIONS[from] ?? []).includes(to);
}

/** States where baseQuantity should be frozen (COLLECTION → REORDER) */
export const FULFILLMENT_FREEZE_POINT: PurchaseFulfillmentStatus = 'REORDER';

/** States where baseQuantity should be unfrozen (REORDER → COLLECTION) */
export const FULFILLMENT_UNFREEZE_POINT: PurchaseFulfillmentStatus = 'COLLECTION';

/**
 * PAYMENT+ этапы (нужна повторная заморозка COLLECTION-строк, удалённых/пересозданных на REORDER).
 * Idempotent: freezeBaseQuantities фильтрует `baseQuantity: null` — повторный вызов no-op.
 */
export const PAYMENT_PLUS_FREEZE_POINTS: ReadonlySet<PurchaseFulfillmentStatus> = new Set([
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP',
]);

export function isFreezePoint(status: PurchaseFulfillmentStatus): boolean {
    return status === FULFILLMENT_FREEZE_POINT;
}

export function isPaymentPlusFreezePoint(status: PurchaseFulfillmentStatus): boolean {
    return PAYMENT_PLUS_FREEZE_POINTS.has(status);
}

export function isUnfreezePoint(status: PurchaseFulfillmentStatus): boolean {
    return status === FULFILLMENT_UNFREEZE_POINT;
}

const ITEM_ADD_BLOCKED_STAGES: ReadonlySet<PurchaseFulfillmentStatus> = new Set([
    'PACKAGING',
    'READY_FOR_PICKUP',
]);

export function canAddItemsAtStage(status: string | null | undefined): boolean {
    return !ITEM_ADD_BLOCKED_STAGES.has((status ?? 'COLLECTION') as PurchaseFulfillmentStatus);
}
