'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { NotificationCard, type NotificationRowData } from '@/components/shop/notification-card';
import { Button } from '@/components/ui/button';
import { PageContent } from '@/components/ui/page-content';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useMarkAllRead,
    useMarkRead,
    useNotifications,
    useUnreadCount,
} from '@/app/shop/hooks/use-notifications';

const PAGE_SIZE = 30;

/**
 * Notification history with keyset pagination. Only the current page is shown;
 * "Показать ещё" advances the cursor and replaces the list. Cards are
 * structured (icon tile + colored border + labeled field rows) so the user
 * sees exactly what changed — payment amount, product name, prev/new quantity,
 * fulfillment stage — instead of a single run-on sentence.
 *
 * Deep-link target: /shop/notifications?id=<id> (from the bell popover).
 * The page reads `id`, scrolls the matching card into view, and briefly
 * highlights it with a primary ring so the user can see which notification
 * they clicked. The highlight fades after ~3s and the query param is cleared
 * so the URL stays clean on refresh.
 *
 * `useSearchParams` must be wrapped in <Suspense> in the App Router — otherwise
 * the whole page opts out of static rendering. The wrapper is a thin shell;
 * the real logic lives in <NotificationsPageInner>.
 */
export default function NotificationsPage() {
    return (
        <Suspense
            fallback={
                <>
                    <PageHeader title="Уведомления" />
                    <PageContent>
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-xl" />
                            ))}
                        </div>
                    </PageContent>
                </>
            }
        >
            <NotificationsPageInner />
        </Suspense>
    );
}

function NotificationsPageInner() {
    const [cursor, setCursor] = useState<number | undefined>(undefined);
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetIdRaw = searchParams.get('id');
    const targetId = targetIdRaw ? Number(targetIdRaw) : null;

    const { data, isLoading, isFetching } = useNotifications(cursor);
    const { data: unread } = useUnreadCount();
    const markRead = useMarkRead();
    const markAllRead = useMarkAllRead();

    const page = (data ?? []) as NotificationRowData[];
    const lastId = page.length > 0 ? page[page.length - 1]!.id : null;
    const hasMore = page.length === PAGE_SIZE && lastId !== null;

    // Auto-load more pages until the target notification is on the current page,
    // or until we run out of pages. This handles the case where the user clicked
    // an old notification in the bell (which only shows the latest 8) and the
    // row is buried deeper in history.
    useEffect(() => {
        if (targetId == null || isLoading || isFetching) return;
        const onPage = page.some((n) => n.id === targetId);
        if (!onPage && hasMore && lastId !== null) {
            setCursor(lastId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetId, isLoading, isFetching, hasMore, lastId]);

    // Scroll the target card into view + mark it read once it lands on the page.
    const targetRef = useRef<HTMLDivElement | null>(null);
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    useEffect(() => {
        if (targetId == null) return;
        const onPage = page.some((n) => n.id === targetId);
        if (!onPage) return;
        // Defer the scroll one tick so the DOM is committed.
        const t = window.setTimeout(() => {
            targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedId(targetId);
            // Auto-mark-as-read when arriving via deep link so the unread badge
            // reflects "what the user has actually seen".
            const row = page.find((n) => n.id === targetId);
            if (row && !row.readAt) markRead.mutate({ id: targetId });
        }, 50);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetId, page.length]);

    // Fade the highlight ring after ~3s and drop the ?id param so refresh
    // doesn't re-trigger scroll.
    useEffect(() => {
        if (highlightedId == null) return;
        const t = window.setTimeout(() => {
            setHighlightedId(null);
            // Replace, not push — we don't want a new history entry.
            const params = new URLSearchParams(searchParams.toString());
            params.delete('id');
            const qs = params.toString();
            router.replace(qs ? `/shop/notifications?${qs}` : '/shop/notifications');
        }, 3000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedId]);

    return (
        <>
            <PageHeader
                title="Уведомления"
                actions={
                    (unread ?? 0) > 0 ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAllRead.mutate()}
                            disabled={markAllRead.isPending}
                        >
                            Прочитать все
                        </Button>
                    ) : undefined
                }
            />
            <PageContent>
                {isLoading ? (
                    <div className="space-y-3">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-xl" />
                        ))}
                    </div>
                ) : page.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <span className="text-fg-secondary">Нет уведомлений</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {page.map((n) => (
                            <div key={n.id} ref={n.id === targetId ? targetRef : undefined}>
                                <NotificationCard
                                    notification={n}
                                    density="full"
                                    highlighted={highlightedId === n.id}
                                    onActivate={() => {
                                        if (!n.readAt) markRead.mutate({ id: n.id });
                                    }}
                                />
                            </div>
                        ))}

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCursor(undefined)}
                                disabled={cursor === undefined}
                            >
                                К началу
                            </Button>
                            {hasMore && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCursor(lastId ?? undefined)}
                                    disabled={isFetching}
                                >
                                    {isFetching ? 'Загрузка…' : 'Показать ещё'}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </PageContent>
        </>
    );
}
