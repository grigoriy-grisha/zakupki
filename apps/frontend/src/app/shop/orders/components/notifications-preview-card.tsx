'use client';

import { Eye } from 'lucide-react';

import { useNotifications } from '@/app/shop/hooks/use-notifications';
import { AppLink } from '@/components/app-link';
import { formatRelative, type NotificationRowData } from '@/components/shop/notification-card';
import { cn } from '@/lib/utils';

export function NotificationsPreviewCard() {
    const { data } = useNotifications();
    const list = (data ?? []).slice(0, 3) as NotificationRowData[];

    return (
        <section className="rounded-2xl border-2 border-gold bg-bg-soft p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-20-bold text-primary sm:text-24-bold">Уведомления</h2>
                <AppLink
                    href="/shop/notifications"
                    className="flex items-center gap-1.5 text-13-medium text-secondary transition-colors hover:text-primary"
                >
                    <Eye className="size-4" />
                    Показать все
                </AppLink>
            </div>

            {list.length === 0 ? (
                <p className="mt-2 text-14-regular text-fg-secondary">Нет новых уведомлений</p>
            ) : (
                <ul className="mt-3 flex flex-col gap-2">
                    {list.map((n) => (
                        <li key={n.id} className="flex items-center gap-2.5">
                            {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                            <span
                                className={cn(
                                    'min-w-0 flex-1 truncate text-13-medium',
                                    n.readAt ? 'text-fg-secondary' : 'text-fg-primary',
                                )}
                            >
                                {n.title}
                            </span>
                            <span className="shrink-0 text-12-regular text-fg-tertiary">
                                {formatRelative(n.createdAt)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
