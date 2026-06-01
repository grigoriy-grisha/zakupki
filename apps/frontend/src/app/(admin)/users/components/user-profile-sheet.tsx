'use client';

import { ExternalLink } from 'lucide-react';

import { TelegramIcon, VkIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';
import { resolveAvatarUrl, displayName } from '@/lib/utils/user';

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
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
                        ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-medium text-primary">
                                {name.charAt(0)}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-xl font-semibold">{name}</p>
                            {user.username && (
                                <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
                            )}
                            {user.telegramCredential && (
                                <p className="truncate text-xs text-muted-foreground">
                                    TG ID: {user.telegramCredential.telegramId}
                                </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                                с {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                        </div>
                    </div>

                    {user.telegramCredential ? (
                        <section className="rounded-lg border p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                                <TelegramIcon className="h-4 w-4 text-[#26A5E4]" />
                                Telegram
                            </div>
                            <div className="flex items-start gap-3">
                                {user.telegramCredential.avatarUrl ? (
                                    <img
                                        src={user.telegramCredential.avatarUrl}
                                        alt=""
                                        className="h-12 w-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#26A5E4]/10 text-sm font-medium text-[#26A5E4]">
                                        TG
                                    </div>
                                )}
                                <div className="min-w-0 space-y-1 text-sm">
                                    {tgUsername && <p className="font-medium">@{tgUsername.replace(/^@/, '')}</p>}
                                    <p className="text-muted-foreground">TG ID: {user.telegramCredential.telegramId}</p>
                                    {tgLink && (
                                        <a
                                            href={tgLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[#26A5E4] hover:underline"
                                        >
                                            Открыть в Telegram
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Telegram не привязан
                        </section>
                    )}

                    {user.vkCredential && (
                        <section className="rounded-lg border p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                                <VkIcon className="h-4 w-4 text-[#0077FF]" />
                                VK
                            </div>
                            <div className="flex items-center gap-3">
                                {user.vkCredential.avatarUrl ? (
                                    <img
                                        src={user.vkCredential.avatarUrl}
                                        alt=""
                                        className="h-12 w-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0077FF]/10 text-sm font-medium text-[#0077FF]">
                                        VK
                                    </div>
                                )}
                                <a
                                    href={`https://vk.com/id${user.vkCredential.vkId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-[#0077FF] hover:underline"
                                >
                                    id{user.vkCredential.vkId}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </section>
                    )}

                    {user.phone && (
                        <p className="text-sm">
                            <span className="text-muted-foreground">Телефон: </span>
                            {user.phone}
                        </p>
                    )}

                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-medium">Заказы</h3>
                            <Badge variant="secondary">{user.orderLines.length}</Badge>
                        </div>
                        {ordersLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
                            </div>
                        ) : !orders?.length ? (
                            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                                Нет заказов
                            </p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Товар</TableHead>
                                            <TableHead className="text-right">Сумма</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell>
                                                    <p className="font-medium leading-tight">
                                                        {order.purchaseItem?.product?.name ??
                                                            `Товар #${order.purchaseItemId}`}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {order.purchaseItem?.purchase?.tag ?? '—'} ·{' '}
                                                        {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                                        {order.purchaseItem?.product?.unit?.shortName ?? ''}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {Number(order.amountDue).toLocaleString('ru-RU')} ₽
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/50 font-bold">
                                            <TableCell>Итого</TableCell>
                                            <TableCell className="text-right">
                                                {orders
                                                    .reduce((s, o) => s + Number(o.amountDue), 0)
                                                    .toLocaleString('ru-RU')}{' '}
                                                ₽
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
