'use client';

import { trpc } from '@/lib/client/trpc';

/**
 * Unread notification count for the bell badge. Polled every 30s and refreshed
 * on window focus so the badge stays fresh without long-lived subscriptions.
 */
export function useUnreadCount() {
    return trpc.notifications.unreadCount.useQuery(undefined, {
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    });
}

/** Paginated list of the current user's notifications (newest first). */
export function useNotifications(cursor?: number) {
    return trpc.notifications.list.useQuery({ cursor: cursor ?? undefined });
}

/** Mark a single notification as read and invalidate the unread count. */
export function useMarkRead() {
    const utils = trpc.useUtils();
    return trpc.notifications.markRead.useMutation({
        onSuccess: () => {
            utils.notifications.unreadCount.invalidate();
            utils.notifications.list.invalidate();
        },
    });
}

/** Mark all notifications as read and invalidate both queries. */
export function useMarkAllRead() {
    const utils = trpc.useUtils();
    return trpc.notifications.markAllRead.useMutation({
        onSuccess: () => {
            utils.notifications.unreadCount.invalidate();
            utils.notifications.list.invalidate();
        },
    });
}
