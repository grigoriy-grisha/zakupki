'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '@/app/shop/hooks/use-notifications';
import { NotificationCard, type NotificationRowData } from '@/components/shop/notification-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { pluralRu } from '@/lib/format/plural';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;

function NotificationsSkeleton() {
    return (
        <div className="flex flex-col gap-2.5">
            {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
        </div>
    );
}

export default function NotificationsPage() {
    return (
        <Suspense fallback={<NotificationsSkeleton />}>
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

    useEffect(() => {
        if (targetId == null || isLoading || isFetching) return;
        const onPage = page.some((n) => n.id === targetId);
        if (!onPage && hasMore && lastId !== null) {
            setCursor(lastId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetId, isLoading, isFetching, hasMore, lastId]);

    const targetRef = useRef<HTMLDivElement | null>(null);
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    useEffect(() => {
        if (targetId == null) return;
        const onPage = page.some((n) => n.id === targetId);
        if (!onPage) return;
        const t = window.setTimeout(() => {
            targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedId(targetId);
            const row = page.find((n) => n.id === targetId);
            if (row && !row.readAt) markRead.mutate({ id: targetId });
        }, 50);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetId, page.length]);

    useEffect(() => {
        if (highlightedId == null) return;
        const t = window.setTimeout(() => {
            setHighlightedId(null);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('id');
            const qs = params.toString();
            router.replace(qs ? `/shop/notifications?${qs}` : '/shop/notifications');
        }, 3000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedId]);

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-h1 text-secondary">Уведомления</h1>
                    {(unread ?? 0) > 0 && (
                        <Badge type="subtle" variant="accent">
                            {unread ?? 0} {pluralRu(unread ?? 0, ['непрочитанное', 'непрочитанных', 'непрочитанных'])}
                        </Badge>
                    )}
                </div>
                {(unread ?? 0) > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => markAllRead.mutate()}
                        disabled={markAllRead.isPending}
                    >
                        <CheckCheck className="size-3.5" />
                        Прочитать все
                    </Button>
                )}
            </header>

            {isLoading ? (
                <NotificationsSkeleton />
            ) : page.length === 0 ? (
                <div className="rounded-2xl bg-bg-soft">
                    <EmptyState
                        variant="plain"
                        icon={Bell}
                        title="Нет новых уведомлений"
                        description="Здесь будет актуальная информация по закупкам"
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
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

                    {hasMore && (
                        <Button
                            variant="outline"
                            className={cn('mx-auto mt-1.5 rounded-full', 'w-full sm:w-auto')}
                            onClick={() => setCursor(lastId ?? undefined)}
                            disabled={isFetching}
                        >
                            {isFetching ? 'Загрузка…' : 'Показать ещё'}
                        </Button>
                    )}

                    {cursor !== undefined && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mx-auto rounded-full text-fg-secondary"
                            onClick={() => setCursor(undefined)}
                            disabled={isFetching}
                        >
                            К началу
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
