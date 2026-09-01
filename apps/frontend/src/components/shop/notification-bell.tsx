'use client';

import { Bell, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ComponentType,useState } from 'react';

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '@/app/shop/hooks/use-notifications';
import { AppLink } from '@/components/app-link';
import { NotificationCard, type NotificationRowData } from '@/components/shop/notification-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function NotificationBell({
    icon: BellGlyph = Bell,
    iconClassName,
}: {
    icon?: ComponentType<{ className?: string }>;
    iconClassName?: string;
} = {}) {
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
                    <BellGlyph className={cn('size-5', iconClassName)} />
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
                    'w-[445px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px]',
                    'border-2 border-gold bg-bg-soft p-0 shadow-xl',
                )}
            >
                <div className="flex items-start justify-between gap-3 px-7 pt-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <p className="font-display text-30-semibold leading-none text-primary">Уведомления</p>
                        {unread > 0 && (
                            <Badge type="subtle" variant="accent" size="sm">
                                {unread}
                            </Badge>
                        )}
                    </div>
                    {unread > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 rounded-full px-2 text-12-medium text-secondary hover:bg-bg-card/60"
                            onClick={() => markAllRead.mutate()}
                            disabled={markAllRead.isPending}
                        >
                            Прочитать все
                        </Button>
                    )}
                </div>

                {listLoading ? (
                    <div className="flex flex-col gap-2 px-4 pb-3 pt-4">
                        <Skeleton className="h-16 w-full rounded-xl bg-bg-card/80" />
                        <Skeleton className="h-16 w-full rounded-xl bg-bg-card/80" />
                    </div>
                ) : data && data.length > 0 ? (
                    <div className="mt-4 flex max-h-96 flex-col gap-2 overflow-y-auto px-4 pb-2">
                        {(data as NotificationRowData[]).slice(0, 8).map((n) => (
                            <NotificationCard
                                key={n.id}
                                notification={n}
                                density="compact"
                                onActivate={() => activate(n)}
                                className="border-border-soft/60 bg-bg-card/80 hover:bg-bg-card"
                            />
                        ))}
                    </div>
                ) : (
                    <p className="mb-[52px] mt-12 text-center text-20-regular text-fg-primary">
                        Нет новых уведомлений
                    </p>
                )}

                <div className="flex justify-center pb-5 pt-1">
                    <AppLink
                        href="/shop/notifications"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 text-18-regular text-fg-primary transition-colors hover:text-primary"
                    >
                        <Eye className="size-5" />
                        Показать все
                    </AppLink>
                </div>
            </PopoverContent>
        </Popover>
    );
}
