import {
    COALESCABLE_NOTIFICATION_TYPES,
    COALESCE_DELIVERY_DELAY_MS,
    COALESCE_WINDOW_MS,
    renderNotificationTelegramBody,
    renderNotificationTitle,
    renderNotificationUrl,
    type NotificationPayload,
    type NotificationType,
    type NotifyInput,
} from '@zakupki/types';
import { createLogger } from '@zakupki/logger';
import type { UserDmJobsQueue } from '@zakupki/queue';

import { NotificationRepository } from '../domain/notification.repository';

const log = createLogger('notification-service');

/**
 * Single entry point for production-side code to push a user-facing
 * notification. Owns:
 *   1. rendering the (type, payload) into title/body/url (denormalized once),
 *   2. persisting the Notification row (drives the web bell + history),
 *   3. enqueuing a DM delivery job for the bot worker.
 *
 * Rendered `body` is the Telegram-HTML variant (emoji + bold labels + multi-
 * line). The web bell does NOT read `body` — it renders structured fields from
 * the payload via getNotificationFields, so storing the HTML form is safe and
 * lets the worker send the DM without any further escaping.
 *
 * Coalescing + debounced delivery: for types in `COALESCABLE_NOTIFICATION_TYPES`
 * a burst of admin clicks on the same target (e.g. `purchaseItemId`) within
 * `COALESCE_WINDOW_MS` collapses into a single notification row. The most
 * recent undelivered row is updated in place: its `payload.newQty` is replaced
 * with the latest value while `payload.prevQty` is preserved, so the final row
 * reads as one summary ("было 15, стало 40") instead of N noisy deltas.
 *
 * The DM job is enqueued with `delay: COALESCE_DELIVERY_DELAY_MS` (debounced,
 * not immediate) and re-enqueued on every coalesce hit — BullMQ's jobId dedup
 * (via `addDebounced`) replaces the waiting/delayed job and restarts the
 * timer. This is what actually keeps the burst from producing intermediate
 * pushes: the worker doesn't fire until `COALESCE_DELIVERY_DELAY_MS` after the
 * LAST edit, by which time `payload` holds the final values. The worker reads
 * `body` from the row at processing time, so any payload update during the
 * delay is picked up automatically.
 *
 * Contract: if the row write succeeds but the enqueue fails, the web bell
 * still shows the notification — only the Telegram push is lost. We log the
 * enqueue failure but never throw out of `notify`, because notifications are
 * best-effort and must not break the parent admin mutation that called it.
 */
export class NotificationService {
    constructor(
        private repo: NotificationRepository,
        private dmQueue: UserDmJobsQueue,
    ) {}

    async notify<T extends NotificationType>(input: NotifyInput<T>): Promise<void> {
        const payload = input.payload as NotificationPayload<T>;
        const title = renderNotificationTitle(input.type);
        // The `body` column is read ONLY by the Telegram worker (the web bell
        // renders structured fields from the payload via getNotificationFields).
        // We therefore store the rich Telegram-HTML variant — bold labels,
        // per-type emoji, multi-line layout — so the worker just sends it as-is
        // with parse_mode=HTML, no extra escaping.
        const body = renderNotificationTelegramBody(input.type, payload);
        const url = renderNotificationUrl(input.type, payload);
        const coalescable = COALESCABLE_NOTIFICATION_TYPES.has(input.type);

        // Coalesce a burst of identical-target notifications into one row.
        // Returns the existing row id if we updated it; `null` means "no
        // candidate found, create a fresh row".
        const coalescedId = await this.tryCoalesce(input, title, body, url);

        let notificationId: number;
        if (coalescedId != null) {
            notificationId = coalescedId;
        } else {
            const row = await this.repo.create({
                userId: input.userId,
                type: input.type,
                payload,
                title,
                body,
                url,
            });
            notificationId = row.id;
        }

        try {
            // For coalescable types we always enqueue (or re-enqueue) the DM
            // job with a debounce delay — both on a fresh row and on a coalesce
            // hit. addDebounced replaces any existing waiting/delayed job with
            // the same id and restarts the delay timer, so the worker fires
            // exactly once, COALESCE_DELIVERY_DELAY_MS after the LAST edit.
            if (coalescable) {
                await this.dmQueue.addDebounced(
                    { type: 'SEND_DM', notificationId },
                    COALESCE_DELIVERY_DELAY_MS,
                );
            } else {
                await this.dmQueue.addImmediate({ type: 'SEND_DM', notificationId });
            }
        } catch (err) {
            // Web bell still works — only the push is lost. Don't rethrow.
            log.warn({ notificationId, userId: input.userId, err }, 'failed to enqueue DM delivery');
        }
    }

    /**
     * For coalescable types, look up the most recent undelivered row matching
     * the coalesce key and update it in place. Returns the row id if updated,
     * `null` otherwise (caller should then create a fresh row). All errors are
     * swallowed + logged — coalescing is an optimization, not a guarantee; on
     * any failure we fall back to a fresh row.
     *
     * Race: between `findRecentUndelivered` and `updateContent` the worker may
     * have already delivered the candidate. `updateContent` refuses to touch a
     * delivered row and returns false — in that case we keep scanning the next
     * candidate; if none accept the update we return null so a fresh row is
     * created. This keeps the web and Telegram copies consistent.
     */
    private async tryCoalesce<T extends NotificationType>(
        input: NotifyInput<T>,
        title: string,
        body: string,
        url: string | null,
    ): Promise<number | null> {
        if (!COALESCABLE_NOTIFICATION_TYPES.has(input.type)) return null;
        const coalesceKey = readCoalesceKey(input);
        if (coalesceKey == null) return null;

        try {
            const candidates = await this.repo.findRecentUndelivered(
                input.userId,
                input.type,
                COALESCE_WINDOW_MS,
            );
            for (const c of candidates) {
                const cp = c.payload as { purchaseItemId?: number };
                if (cp.purchaseItemId !== coalesceKey) continue;

                // Merge: keep the candidate's original prevQty ("было"), replace
                // the rest of the payload with the latest input. This way the
                // final row reads as a single summary across the whole burst.
                const prevPayload = input.payload as NotificationPayload<T> & { prevQty?: number };
                const mergedPayload = { ...prevPayload, prevQty: readPreservedPrevQty(c.payload, prevPayload) };

                const updated = await this.repo.updateContent(c.id, {
                    payload: mergedPayload,
                    title,
                    body,
                    url,
                });
                if (!updated) {
                    // Row was delivered between our lookup and update — skip it
                    // and try the next candidate, or fall through to a fresh row.
                    continue;
                }
                log.debug(
                    { notificationId: c.id, type: input.type, coalesceKey },
                    'coalesced notification into existing row',
                );
                return c.id;
            }
        } catch (err) {
            log.warn({ input, err }, 'coalesce failed, falling back to fresh row');
        }
        return null;
    }

    async listForUser(userId: number, cursor?: number) {
        return this.repo.listForUser(userId, { cursor: cursor ?? undefined, limit: 30 });
    }

    async unreadCount(userId: number): Promise<number> {
        return this.repo.unreadCount(userId);
    }

    async markRead(id: number, userId: number): Promise<void> {
        return this.repo.markRead(id, userId);
    }

    async markAllRead(userId: number): Promise<void> {
        return this.repo.markAllRead(userId);
    }

    async markTgDelivered(id: number): Promise<void> {
        return this.repo.markTgDelivered(id);
    }
}

/**
 * Read the coalesce key from a NotifyInput. Currently the only coalescable
 * type is ORDER_QTY_CHANGED, keyed by `payload.purchaseItemId`. Returns null
 * for payloads without the key (defensive — should never happen for types in
 * COALESCABLE_NOTIFICATION_TYPES).
 */
function readCoalesceKey<T extends NotificationType>(input: NotifyInput<T>): number | null {
    if (input.type === 'ORDER_QTY_CHANGED') {
        const p = input.payload as NotificationPayload<'ORDER_QTY_CHANGED'>;
        return p.purchaseItemId ?? null;
    }
    return null;
}

/**
 * The candidate row's stored prevQty is the "было" we want to preserve across
 * the burst — it's the quantity before the FIRST edit in this window. The
 * fresh input's prevQty reflects the state just before the LATEST edit, so we
 * throw it away. If the candidate somehow lost its prevQty (legacy row), fall
 * back to the fresh input's value.
 */
function readPreservedPrevQty(
    candidatePayload: unknown,
    fresh: { prevQty?: number },
): number {
    const cp = candidatePayload as { prevQty?: number };
    if (typeof cp.prevQty === 'number' && Number.isFinite(cp.prevQty)) return cp.prevQty;
    return fresh.prevQty ?? 0;
}
