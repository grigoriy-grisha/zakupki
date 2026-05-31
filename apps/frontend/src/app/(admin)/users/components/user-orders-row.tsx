'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';
import { resolveAvatarUrl, displayName } from '@/lib/utils/user';

import { type UserListItem } from './user-profile-sheet';
import { UserRoleSelect } from './user-role-select';

interface UserOrdersRowProps {
    user: UserListItem;
    onOpenProfile: (user: UserListItem) => void;
}

export function UserOrdersRow({ user, onOpenProfile }: UserOrdersRowProps) {
    const [open, setOpen] = useState(false);
    const name = displayName(user);
    const avatarUrl = resolveAvatarUrl(user);
    const tgUsername = user.telegramCredential?.username ?? user.username;

    const { data: orders, isLoading: ordersLoading } = trpc.orders.getByUser.useQuery(
        { userId: user.id },
        { enabled: open },
    );

    return (
        <>
            <TableRow className="hover:bg-accent/50 transition-colors">
                <TableCell>
                    <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={open ? 'Скрыть заказы участника' : 'Показать заказы участника'}
                        aria-expanded={open}
                        onClick={() => setOpen((prev) => !prev)}
                    >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                </TableCell>
                <TableCell>
                    <button
                        type="button"
                        className="flex items-center gap-2 rounded-md text-left transition-colors hover:bg-accent/60 -m-1 p-1"
                        onClick={() => onOpenProfile(user)}
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {name.charAt(0)}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="font-medium">{name}</p>
                            {tgUsername && (
                                <p className="text-xs text-muted-foreground">@{tgUsername.replace(/^@/, '')}</p>
                            )}
                        </div>
                    </button>
                </TableCell>
                <TableCell>
                    <UserRoleSelect userId={user.id} role={user.role} />
                </TableCell>
                <TableCell>
                    <Badge variant="secondary" className="font-normal">
                        {user.orderLines.length} заказов
                    </Badge>
                </TableCell>
            </TableRow>

            {open && (
                <TableRow>
                    <TableCell colSpan={4} className="bg-muted/30 p-0">
                        <div className="p-4">
                            <p className="mb-3 text-sm font-medium text-muted-foreground">Заказы участника</p>
                            {ordersLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : !orders?.length ? (
                                <p className="rounded-lg border border-dashed bg-background py-6 text-center text-sm text-muted-foreground">
                                    Нет заказов
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-md border bg-background">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Товар</TableHead>
                                                <TableHead className="text-right">Кол-во</TableHead>
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
                                                            {order.purchaseItem?.purchase?.tag ?? '—'}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                                        {order.purchaseItem?.product?.unit?.shortName ?? ''}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {Number(order.amountDue).toLocaleString('ru-RU')} ₽
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
