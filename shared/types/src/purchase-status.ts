import type { PurchaseStatus } from './index';

export const PURCHASE_STATUS_TRANSITIONS: Record<PurchaseStatus, readonly PurchaseStatus[]> = {
    DRAFT: ['ACTIVE'],
    ACTIVE: ['DONE'],
    DONE: ['ACTIVE'],
    CLOSED: [],
    ARRIVED: [],
};

export function canTransitionPurchaseStatus(from: PurchaseStatus, to: PurchaseStatus): boolean {
    return (PURCHASE_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
