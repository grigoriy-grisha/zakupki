'use client';

import { getNotificationFields, getNotificationVisual, type NotificationType } from '@zakupki/types';

import { AppLink } from '@/components/app-link';
import { NotificationIconTile, toneBorderClass } from '@/components/shop/notification-icon';
import { cn } from '@/lib/utils';

export interface NotificationRowData {
    id: number;
    type: NotificationType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    title: string;
    body: string;
    url: string | null;
    readAt: Date | string | null;
    createdAt: Date | string;
}

interface NotificationCardProps {
    notification: NotificationRowData;
    density: 'compact' | 'full';
    onActivate?: () => void;
    highlighted?: boolean;
}

function formatRelative(iso: Date | string): string {
    const date = typeof iso === 'string' ? new Date(iso) : iso;
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU');
}

export function NotificationCard({ notification, density, onActivate, highlighted }: NotificationCardProps) {
    const { type, payload, title, readAt, createdAt } = notification;
    const visual = getNotificationVisual(type);
    const fields = density === 'full' ? getNotificationFields(type, payload) : [];
    const tag = payload?.purchaseTag as string | undefined;
    const purchaseId = payload?.purchaseId as number | undefined;
    const purchaseHref = purchaseId != null ? `/shop/purchase/${purchaseId}` : null;

    const renderTag = () => {
        if (!tag) return null;
        if (!purchaseHref) return <span className="text-13-medium text-primary">#{tag}</span>;
        return (
            <AppLink
                href={purchaseHref}
                onClick={(e) => e.stopPropagation()}
                className="text-13-medium text-primary transition-opacity hover:opacity-80"
            >
                #{tag}
            </AppLink>
        );
    };

    return (
        <div
            className={cn(
                'flex rounded-xl border bg-bg-card transition-colors',
                density === 'compact' ? 'gap-2.5 p-3' : 'gap-3 p-4',
                toneBorderClass(visual.tone),
                highlighted && 'ring-2 ring-primary/50',
                !readAt && !highlighted && 'ring-1 ring-primary/20',
                density === 'compact' && onActivate && 'cursor-pointer hover:bg-bg-soft',
            )}
            onClick={density === 'compact' ? onActivate : undefined}
        >
            <NotificationIconTile icon={visual.icon} tone={visual.tone} size={density === 'compact' ? 'sm' : 'md'} />

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        {!readAt && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                        <span className="text-14-semibold text-fg-primary">{title}</span>
                    </div>
                    <span className="shrink-0 text-12-regular text-fg-tertiary">{formatRelative(createdAt)}</span>
                </div>

                {density === 'compact' && tag && <div className="mt-0.5 truncate text-12-regular">{renderTag()}</div>}

                {density === 'full' && fields.length > 0 && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        {fields.map((f) => (
                            <div key={f.label} className="contents">
                                <dt className="text-12-regular text-fg-tertiary">{f.label}</dt>
                                <dd className="text-13-medium break-words text-fg-primary">
                                    {f.label === 'Закупка' ? renderTag() : f.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </div>
    );
}
