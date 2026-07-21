'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AppLink } from '@/components/app-link';
import { NotificationCard, type NotificationRowData } from '@/components/shop/notification-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarkRead, useNotifications, useUnreadCount } from '@/app/shop/hooks/use-notifications';

/**
 * Bell icon with an unread badge and a popover listing the latest notifications
 * in compact form. Mounted in the shop header. Clicking a notification marks
 * it read and routes to /shop/notifications?id=<id> so the page can scroll to
 * and highlight the just-clicked row — this mirrors how the user expects "I
 * clicked something" to behave even when the notification itself doesn't have
 * a natural deep link of its own.
 */
export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { data: count, isLoading: countLoading } = useUnreadCount();
    const { data, isLoading: listLoading } = useNotifications();
    const markRead = useMarkRead();
    const unread = count ?? 0;

    const activate = (n: NotificationRowData) => {
        if (!n.readAt) markRead.mutate({ id: n.id });
        setOpen(false);
        // Always route to the notifications page with ?id= so the page can
        // scroll to + highlight the clicked row. The page itself surfaces the
        // purchase deep link inside the card.
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
                    <Bell className="h-4 w-4" />
                    {!countLoading && unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-2">
                <div className="flex items-center justify-between px-2 py-2">
                    <span className="text-14-medium text-fg-primary">Уведомления</span>
                    {unread > 0 && (
                        <Badge variant="neutral" type="subtle">
                            {unread} непрочитан.
                        </Badge>
                    )}
                </div>

                {listLoading ? (
                    <div className="space-y-2 p-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : data && data.length > 0 ? (
                    <div className="max-h-96 space-y-1.5 overflow-y-auto px-1 pb-1">
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
                    <div className="px-4 py-8 text-center text-13 text-fg-tertiary">Нет уведомлений</div>
                )}

                <div className="p-1 pt-2">
                    <AppLink
                        href="/shop/notifications"
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-3 py-2 text-center text-13-medium text-primary transition-colors hover:bg-bg-soft"
                    >
                        Показать все
                    </AppLink>
                </div>
            </PopoverContent>
        </Popover>
    );
}
