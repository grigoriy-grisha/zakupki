import { dbClient } from '@zakupki/database';

const db = dbClient;

export interface NotificationCreateInput {
    userId: number;
    type: string;
    payload: unknown;
    title: string;
    body: string;
    url: string | null;
}

export interface NotificationListInput {
    cursor?: number;
    limit: number;
}

export type NotificationRow = Awaited<ReturnType<NotificationRepository['findById']>>;

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

    async findUndeliveredIds(limit = 200): Promise<number[]> {
        const rows = await db.notification.findMany({
            where: { tgDeliveredAt: null },
            orderBy: { id: 'asc' },
            take: limit,
            select: { id: true },
        });
        return rows.map((row) => row.id);
    }

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

    async markTgDelivered(id: number): Promise<void> {
        await db.notification.updateMany({
            where: { id, tgDeliveredAt: null },
            data: { tgDeliveredAt: new Date() },
        });
    }
}
