import type { HandoffStatus, PurchaseFulfillmentStatus, PurchaseStatus } from '../index';

/**
 * All notification types triggered by admin-side mutations.
 * Order types are intentionally hybrid (3 grouped by user mental model):
 * - ORDER_QTY_CHANGED: admin changed the quantity (covers add/decrease/set-qty>0)
 * - ORDER_LINE_DELETED: admin removed an item line (set-qty=0, or single delete)
 * - ORDER_CLEARED: admin wiped all user's lines in a purchase
 */
export const NOTIFICATION_TYPES = [
    'PAYMENT_CONFIRMED',
    'PAYMENT_REJECTED',
    'ORDER_QTY_CHANGED',
    'ORDER_LINE_DELETED',
    'ORDER_CLEARED',
    'ORDER_HANDOFF_STATUS',
    'PURCHASE_FULFILLMENT_STAGE',
    'PURCHASE_STATUS_CHANGED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Strongly-typed payload per notification type (discriminated union by `type`).
 *
 * Every payload carries `purchaseId` (numeric key for deep links) and
 * `purchaseTag` (display-only). Order payloads additionally carry `prevQty`
 * so the UI can show Было/Стало. `prevQty=0` means "the user had nothing on
 * this item before the admin action" — different from a missing field.
 */
export interface NotificationPayloads {
    PAYMENT_CONFIRMED: {
        purchaseId: number;
        purchaseTag: string;
        amount: number;
        adminNote?: string | null;
    };
    PAYMENT_REJECTED: {
        purchaseId: number;
        purchaseTag: string;
        amount: number;
        adminNote?: string | null;
    };
    ORDER_QTY_CHANGED: {
        purchaseId: number;
        purchaseTag: string;
        // Service-only key used to coalesce a burst of admin clicks on the
        // same item into a single notification. Not surfaced in the UI.
        purchaseItemId: number;
        productLabel: string;
        prevQty: number;
        newQty: number;
        unitShort: string;
    };
    ORDER_LINE_DELETED: {
        purchaseId: number;
        purchaseTag: string;
        purchaseItemId: number;
        productLabel: string;
    };
    ORDER_CLEARED: {
        purchaseId: number;
        purchaseTag: string;
    };
    ORDER_HANDOFF_STATUS: {
        purchaseId: number;
        purchaseTag: string;
        status: HandoffStatus | null;
    };
    PURCHASE_FULFILLMENT_STAGE: {
        purchaseId: number;
        purchaseTag: string;
        stage: PurchaseFulfillmentStatus;
    };
    PURCHASE_STATUS_CHANGED: {
        purchaseId: number;
        purchaseTag: string;
        status: PurchaseStatus;
    };
}

/** Payload type for a specific notification type. Defaults to the union. */
export type NotificationPayload<T extends NotificationType = NotificationType> =
    NotificationPayloads[T];

/** Input accepted by NotificationService.notify<T>. */
export interface NotifyInput<T extends NotificationType = NotificationType> {
    userId: number;
    type: T;
    payload: NotificationPayload<T>;
}

/**
 * Only these fulfillment stages trigger a notification. Keeping the set small
 * avoids spamming users on every internal transition (9 stages total).
 * - REORDER: "доборы открылись, можно дозаказать"
 * - PAYMENT: "время оплачивать"
 * - READY_FOR_PICKUP: "заказ готов к выдаче"
 */
export const NOTIFIABLE_FULFILLMENT_STAGES: ReadonlySet<PurchaseFulfillmentStatus> = new Set([
    'REORDER',
    'PAYMENT',
    'READY_FOR_PICKUP',
]);

/**
 * Types whose notifications can be coalesced — i.e. a rapid burst of admin
 * clicks on the same target collapses into a single notification row.
 *
 * Today this is only ORDER_QTY_CHANGED (admin taps −1, −1, −1 on the same
 * PurchaseItem). Payment / lifecycle notifications are one-shot by nature —
 * no benefit in coalescing.
 *
 * The coalesce key is `(userId, type, payload.purchaseItemId)`.
 */
export const COALESCABLE_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
    'ORDER_QTY_CHANGED',
]);

/**
 * Delivery delay for coalescable notifications. The DM job is enqueued with
 * `delay: COALESCE_DELIVERY_DELAY_MS` instead of firing immediately, so a burst
 * of admin clicks (e.g. 15 → 20 → 30 → 40 within 30s) all merge into one
 * notification ("было 15, стало 40") instead of producing a separate push for
 * every intermediate value. The worker still reads `body` from the row at the
 * moment of processing, so any payload update during the delay is picked up.
 *
 * Must be strictly less than COALESCE_WINDOW_MS — otherwise the candidate row
 * would age out of the coalesce lookup before the debounced delivery fires.
 */
export const COALESCE_DELIVERY_DELAY_MS = 30_000;

/**
 * How long after creation an undelivered notification stays eligible for
 * coalescing. Tuned to cover a typical admin editing burst (multiple clicks
 * in quick succession) without silently merging edits the user has already
 * seen into one row. After delivery (`tgDeliveredAt` set) the row is never
 * touched again, so the next change starts a fresh notification.
 *
 * Kept larger than COALESCE_DELIVERY_DELAY_MS so that even if a delayed job
 * fails and gets re-enqueued, the candidate row is still in the lookup window.
 */
export const COALESCE_WINDOW_MS = 2 * 60_000;

/**
 * Identifies a candidate row for coalescing. `purchaseItemId` is read from
 * the candidate's stored payload. `tgDeliveredAt IS NULL` guarantees the row
 * hasn't been pushed to Telegram yet — a delivered row is immutable.
 */
export interface CoalesceCandidate {
    id: number;
    payload: {
        purchaseItemId?: number;
        prevQty?: number;
    };
}
