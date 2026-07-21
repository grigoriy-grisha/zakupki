'use client';

import { getNotificationFields, getNotificationVisual, type NotificationType } from '@zakupki/types';

import { AppLink } from '@/components/app-link';
import { NotificationIconTile, toneBorderClass } from '@/components/shop/notification-icon';
import { cn } from '@/lib/utils';

/**
 * Structured notification card. Surfaces the title as a headline, the purchase
 * tag and other key fields as labeled rows (Сумма, Товар, Было, Стало, Новый
 * этап…), and a colored icon tile keyed off the notification type — so the
 * user can see at a glance what happened and to which purchase.
 *
 * Two densities:
 *   - `compact` — for the bell popover: title + first field (purchase tag) +
 *     relative time. Skips the secondary fields. The whole card is clickable
 *     and calls `onActivate` (the bell routes to the notifications page with
 *     ?id=…).
 *   - `full`    — for /shop/notifications: all fields as labeled rows. The
 *     card itself is not a link — only the `#TAG` is, because the user is
 *     already on the notifications page; the whole-card affordance would just
 *     re-trigger scroll-to-self.
 *
 * The purchase tag (#TAG) is always a clickable link into the purchase page
 * (built from `payload.purchaseId`). `highlighted` briefly tints the border
 * ring — used when the user lands on /shop/notifications?id=X from the bell.
 */

export interface NotificationRowData {
    id: number;
    type: NotificationType;
    // Stored as Json in the DB; the client narrows it to the typed payload.
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
    // Deep link into the purchase page. Built from the numeric id so the route
    // is stable; tag is display-only.
    const purchaseHref = purchaseId != null ? `/shop/purchase/${purchaseId}` : null;

    /**
     * The purchase tag rendered as a clickable link (or plain text if there's
     * no purchase deep link, e.g. legacy rows). Clicking it stops propagation
     * so the card-level `onActivate` (compact mode) doesn't also fire.
     */
    const renderTag = () => {
        if (!tag) return null;
        if (!purchaseHref) return <span className="font-medium text-primary">#{tag}</span>;
        return (
            <AppLink
                href={purchaseHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-primary transition-opacity hover:opacity-80"
            >
                #{tag}
            </AppLink>
        );
    };

    const inner = (
        <div
            className={cn(
                'flex gap-3 rounded-xl border bg-bg-card p-4 transition-colors',
                toneBorderClass(visual.tone),
                highlighted && 'ring-2 ring-primary/40',
                !readAt && !highlighted && 'ring-1 ring-primary/15',
                // Whole-card affordance only in compact mode (bell popover).
                density === 'compact' && onActivate && 'cursor-pointer hover:bg-bg-soft',
            )}
            onClick={density === 'compact' ? onActivate : undefined}
        >
            <NotificationIconTile icon={visual.icon} tone={visual.tone} size={density === 'compact' ? 'sm' : 'md'} />

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        {!readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <span className="text-14-medium text-fg-primary">{title}</span>
                    </div>
                    <span className="shrink-0 text-12 text-fg-tertiary">{formatRelative(createdAt)}</span>
                </div>

                {/* In compact mode show just the purchase tag (clickable) for context. */}
                {density === 'compact' && tag && <div className="mt-0.5 truncate text-12">{renderTag()}</div>}

                {/* In full mode show all structured fields as labeled rows. */}
                {density === 'full' && fields.length > 0 && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        {fields.map((f) => (
                            <div key={f.label} className="contents">
                                <dt className="text-12 text-fg-tertiary">{f.label}</dt>
                                <dd className="text-13 text-fg-primary break-words">
                                    {/* Render the purchase tag as a link so it's obviously clickable,
                                        the rest as plain text. */}
                                    {f.label === 'Закупка' ? renderTag() : f.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </div>
    );

    return inner;
}
