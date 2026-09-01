'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '@/app/shop/hooks/use-notifications';
import { AppLink } from '@/components/app-link';
import { NotificationCard, type NotificationRowData } from '@/components/shop/notification-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { pluralRu } from '@/lib/format/plural';
import { cn } from '@/lib/utils';

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { data: count, isLoading: countLoading } = useUnreadCount();
    const { data, isLoading: listLoading } = useNotifications();
    const markRead = useMarkRead();
    const markAllRead = useMarkAllRead();
    const unread = count ?? 0;

    const activate = (n: NotificationRowData) => {
        if (!n.readAt) markRead.mutate({ id: n.id });
        setOpen(false);
        router.push(`/shop/notifications?id=${n.id}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="relative rounded-full text-fg-secondary"
                    aria-label="Уведомления"
                >
                    <Bell className="size-4" />
                    {!countLoading && unread > 0 && (
                        <span
                            className={cn(
                                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center',
                                'justify-center rounded-full bg-error px-1',
                                'text-[10px] font-semibold leading-none text-white',
                            )}
                        >
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className={cn(
                    'w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl',
                    'border border-border bg-bg-card p-0 shadow-xl ring-1 ring-black/5',
                )}
            >
                <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="text-14-semibold text-fg-primary">Уведомления</span>
                        {unread > 0 && (
                            <Badge type="subtle" variant="accent" size="sm">
                                {unread} {pluralRu(unread, ['непрочитанное', 'непрочитанных', 'непрочитанных'])}
                            </Badge>
                        )}
                    </div>
                    {unread > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 rounded-full px-2 text-12-medium"
                            onClick={() => markAllRead.mutate()}
                            disabled={markAllRead.isPending}
                        >
                            Прочитать все
                        </Button>
                    )}
                </div>

                {listLoading ? (
                    <div className="flex flex-col gap-2 p-2">
                        <Skeleton className="h-16 w-full rounded-xl" />
                        <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                ) : data && data.length > 0 ? (
                    <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto p-2">
                        {(data as NotificationRowData[]).slice(0, 8).map((n) => (
                            <NotificationCard
                                key={n.id}
                                notification={n}
                                density="compact"
                                onActivate={() => activate(n)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <div
                            className={cn(
                                'flex size-10 items-center justify-center rounded-full',
                                'bg-bg-soft text-fg-tertiary',
                            )}
                        >
                            <Bell className="size-4" />
                        </div>
                        <p className="text-13-regular text-fg-tertiary">Нет новых уведомлений</p>
                    </div>
                )}

                <div className="border-t border-border-soft p-1">
                    <AppLink
                        href="/shop/notifications"
                        onClick={() => setOpen(false)}
                        className={cn(
                            'block rounded-lg px-3 py-2 text-center text-13-medium text-primary',
                            'transition-colors hover:bg-bg-soft',
                        )}
                    >
                        Показать все
                    </AppLink>
                </div>
            </PopoverContent>
        </Popover>
    );
}
