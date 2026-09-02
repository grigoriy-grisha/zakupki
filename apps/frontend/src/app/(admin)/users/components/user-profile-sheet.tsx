'use client';

import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

import { TelegramIcon, VkIcon } from '@/components/icons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import { displayName, resolveAvatarUrl } from '@/lib/utils/user';

import { groupOrdersByPurchase } from '../lib/group-orders-by-purchase';
import { UserPurchaseGroupBlock } from './user-purchase-group';

export type UserListItem = {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
    avatarUrl: string | null;
    phone: string | null;
    role: 'ADMIN' | 'CLIENT';
    createdAt: Date | string;
    orderLines: { id: number; purchaseItem?: { purchaseId: number } | null }[];
    telegramCredential: {
        telegramId: string;
        username: string | null;
        avatarUrl: string | null;
    } | null;
    vkCredential: {
        vkId: string;
        avatarUrl: string | null;
    } | null;
};

interface UserProfileSheetProps {
    user?: UserListItem | null;
    userId?: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserProfileSheet({ user: userProp, userId, open, onOpenChange }: UserProfileSheetProps) {
    const { data: fetchedUser, isLoading: profileLoading } = trpc.users.getById.useQuery(
        { id: userId ?? 0 },
        { enabled: open && userProp == null && userId != null },
    );

    const user = userProp ?? fetchedUser ?? null;

    const { data: orders, isLoading: ordersLoading } = trpc.orders.getByUser.useQuery(
        { userId: user?.id ?? 0 },
        { enabled: open && user != null },
    );

    const purchaseGroups = useMemo(() => (orders ? groupOrdersByPurchase(orders) : []), [orders]);
    const ordersTotal = orders?.reduce((s, o) => s + Number(o.amountDue), 0) ?? 0;

    if (!open) return null;

    if (profileLoading && userProp == null && userId != null) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                    <SheetHeader className="pb-2">
                        <SheetTitle>Профиль участника</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-3 px-4">
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    if (!user) return null;

    const avatarUrl = resolveAvatarUrl(user);
    const name = displayName(user);
    const tgUsername = user.telegramCredential?.username ?? user.username;
    const tgLink = tgUsername ? `https://t.me/${tgUsername.replace(/^@/, '')}` : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader className="pb-2">
                    <SheetTitle>Профиль участника</SheetTitle>
                    <SheetDescription>Telegram, контакты и заказы</SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-6 px-4 pb-6">
                    <div className="flex items-center gap-4">
                        <UserAvatar src={avatarUrl} className="size-20" iconClassName="size-9" />
                        <div className="min-w-0">
                            <p className="truncate font-display text-24-semibold">{name}</p>
                            {user.username && (
                                <p className="truncate text-14-regular text-fg-secondary">@{user.username}</p>
                            )}
                            {user.telegramCredential && (
                                <p className="truncate text-12-regular text-fg-secondary">
                                    TG ID: {user.telegramCredential.telegramId}
                                </p>
                            )}
                            <p className="mt-1 text-12-regular text-fg-secondary">
                                с {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                        </div>
                    </div>

                    {user.telegramCredential ? (
                        <section className="rounded-lg border p-4">
                            <div className="mb-3 flex items-center gap-2 text-14-semibold">
                                <TelegramIcon className="h-4 w-4 text-telegram" />
                                Telegram
                            </div>
                            <div className="flex items-start gap-3">
                                <UserAvatar
                                    src={user.telegramCredential.avatarUrl}
                                    className="size-12"
                                    iconClassName="size-6"
                                />
                                <div className="min-w-0 space-y-1 text-14-regular">
                                    {tgUsername && <p className="text-14-semibold">@{tgUsername.replace(/^@/, '')}</p>}
                                    <p className="text-fg-secondary">TG ID: {user.telegramCredential.telegramId}</p>
                                    {tgLink && (
                                        <a
                                            href={tgLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-telegram hover:underline"
                                        >
                                            Открыть в Telegram
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="rounded-lg border border-dashed p-4 text-14-regular text-fg-secondary">
                            Telegram не привязан
                        </section>
                    )}

                    {user.vkCredential && (
                        <section className="rounded-lg border p-4">
                            <div className="mb-3 flex items-center gap-2 text-14-semibold">
                                <VkIcon className="h-4 w-4 text-vk" />
                                VK
                            </div>
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                    src={user.vkCredential.avatarUrl}
                                    className="size-12"
                                    iconClassName="size-6"
                                />
                                <a
                                    href={`https://vk.com/id${user.vkCredential.vkId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-14-regular text-vk hover:underline"
                                >
                                    id{user.vkCredential.vkId}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </section>
                    )}

                    {user.phone && (
                        <p className="text-14-regular">
                            <span className="text-fg-secondary">Телефон: </span>
                            {user.phone}
                        </p>
                    )}

                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-14-semibold">Заказы</h3>
                            <Badge variant="secondary">{user.orderLines.length}</Badge>
                        </div>
                        {ordersLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
                            </div>
                        ) : !orders?.length ? (
                            <p className="rounded-lg border border-dashed py-6 text-center text-14-regular text-fg-secondary">
                                Нет заказов
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {purchaseGroups.map((group) => (
                                    <UserPurchaseGroupBlock
                                        key={group.purchaseId}
                                        group={group}
                                        userId={user?.id ?? 0}
                                    />
                                ))}
                                <p className="pt-1 text-right text-14-semibold">Итого: {formatRub(ordersTotal)}</p>
                            </div>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
