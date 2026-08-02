import { dbClient } from '@zakupki/database';

const db = dbClient;

export interface NotificationCreateInput {
    userId: number;
    type: string;
    payload: unknown; // stored as JSONB; callers pass the typed payload
    title: string;
    body: string;
    url: string | null;
}

export interface NotificationListInput {
    cursor?: number;
    limit: number;
}

/** Prisma Notification row shape, inferred from the create payload. */
export type NotificationRow = Awaited<ReturnType<NotificationRepository['findById']>>;

/**
 * Data access for the Notification model. No business logic — Prisma queries only.
 *
 * Pagination is keyset by `id DESC` (the cursor is the last seen `id`).
 * `userId` is always scoped on every read/write of an individual row so a user
 * can never touch another user's notifications.
 */
export class NotificationRepository {
    async create(data: NotificationCreateInput) {
        return db.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
                payload: data.payload as Parameters<typeof db.notification.create>[0]['data']['payload'],
                title: data.title,
                body: data.body,
                url: data.url,
            },
        });
    }

    async findById(id: number) {
        return db.notification.findUnique({ where: { id } });
    }

    /**
     * Find the most recent undelivered notification of a given type for a user,
     * created within the last `windowMs` milliseconds. Used by the service to
     * coalesce a burst of admin clicks into a single row instead of producing
     * one notification per click.
     *
     * Key shape is `(userId, type)`; the caller further narrows by reading
     * `payload.purchaseItemId` from the returned rows. We fetch the few recent
     * candidates (cheaper than pushing the JSON predicate into SQL) and the
     * service picks the one that matches the coalesce key.
     */
    async findRecentUndelivered(
        userId: number,
        type: string,
        windowMs: number,
    ): Promise<Array<{ id: number; payload: unknown; createdAt: Date }>> {
        const since = new Date(Date.now() - windowMs);
        return db.notification.findMany({
            where: {
                userId,
                type,
                tgDeliveredAt: null,
                createdAt: { gte: since },
            },
            orderBy: { id: 'desc' },
            take: 5,
            select: { id: true, payload: true, createdAt: true },
        });
    }

    /**
     * Overwrite the rendered content of an existing notification row in place.
     * Used by coalescing: same row id, fresh `payload`/`title`/`body`/`url`.
     *
     * Refuses to touch a row that has already been delivered to Telegram
     * (`tgDeliveredAt` set) — once a DM has been sent we don't mutate its body,
     * or the web and Telegram copies would diverge. Returns true if the update
     * happened, false if the row was already delivered (the caller should then
     * fall back to creating a fresh notification for the remaining changes).
     */
    async updateContent(
        id: number,
        data: { payload: unknown; title: string; body: string; url: string | null },
    ): Promise<boolean> {
        const result = await db.notification.updateMany({
            where: { id, tgDeliveredAt: null },
            data: {
                payload: data.payload as Parameters<typeof db.notification.create>[0]['data']['payload'],
                title: data.title,
                body: data.body,
                url: data.url,
            },
        });
        return result.count > 0;
    }

    async listForUser(userId: number, opts: NotificationListInput) {
        return db.notification.findMany({
            where: {
                userId,
                ...(opts.cursor != null ? { id: { lt: opts.cursor } } : {}),
            },
            orderBy: { id: 'desc' },
            take: opts.limit,
        });
    }

    async unreadCount(userId: number): Promise<number> {
        return db.notification.count({ where: { userId, readAt: null } });
    }

    /** Mark a single notification as read. Scoped by userId so users can't touch each other's rows. */
    async markRead(id: number, userId: number): Promise<void> {
        await db.notification.updateMany({
            where: { id, userId, readAt: null },
            data: { readAt: new Date() },
        });
    }

    async markAllRead(userId: number): Promise<void> {
        await db.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
    }

    /**
     * Mark a notification as delivered to Telegram (or skipped for VK-only users
     * / permanently failed). Idempotent — the worker checks `tgDeliveredAt`
     * before attempting delivery.
     */
    async markTgDelivered(id: number): Promise<void> {
        await db.notification.updateMany({
            where: { id, tgDeliveredAt: null },
            data: { tgDeliveredAt: new Date() },
        });
    }
}
