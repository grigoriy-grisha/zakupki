'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';
import { resolveAvatarUrl, displayName } from '@/lib/utils/user';

import { countUniquePurchases, groupOrdersByPurchase } from '../lib/group-orders-by-purchase';
import { type UserListItem } from './user-profile-sheet';
import { UserRoleSelect } from './user-role-select';
import { UserPurchaseGroupBlock } from './user-purchase-group';

interface UserOrdersRowProps {
    user: UserListItem;
    onOpenProfile: (user: UserListItem) => void;
}

export function UserOrdersRow({ user, onOpenProfile }: UserOrdersRowProps) {
    const [open, setOpen] = useState(false);
    const name = displayName(user);
    const avatarUrl = resolveAvatarUrl(user);
    const tgUsername = user.telegramCredential?.username ?? user.username;
    const purchaseCount = countUniquePurchases(user.orderLines);

    const { data: orders, isLoading: ordersLoading } = trpc.orders.getByUser.useQuery(
        { userId: user.id },
        { enabled: open },
    );

    const purchaseGroups = useMemo(() => (orders ? groupOrdersByPurchase(orders) : []), [orders]);

    return (
        <>
            <TableRow className="hover:bg-accent/50 transition-colors">
                <TableCell>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={open ? 'Скрыть закупки участника' : 'Показать закупки участника'}
                        aria-expanded={open}
                        onClick={() => setOpen((prev) => !prev)}
                        className="text-fg-secondary"
                    >
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </Button>
                </TableCell>
                <TableCell>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-m-1 h-auto justify-start gap-2 p-1 text-left"
                        onClick={() => onOpenProfile(user)}
                    >
                        <UserAvatar src={avatarUrl} className="size-8 shrink-0" iconClassName="size-4" />
                        <div className="min-w-0">
                            <p className="text-14-medium text-fg-primary">{name}</p>
                            {tgUsername && (
                                <p className="text-12-regular text-fg-tertiary">@{tgUsername.replace(/^@/, '')}</p>
                            )}
                        </div>
                    </Button>
                </TableCell>
                <TableCell>
                    <UserRoleSelect userId={user.id} role={user.role} />
                </TableCell>
                <TableCell>
                    <Badge variant="secondary" className="font-normal">
                        {purchaseCount > 0
                            ? `${purchaseCount} закупок · ${user.orderLines.length} поз.`
                            : `${user.orderLines.length} поз.`}
                    </Badge>
                </TableCell>
            </TableRow>

            {open && (
                <TableRow>
                    <TableCell colSpan={4} className="bg-muted/30 p-0">
                        <div className="p-4">
                            <p className="mb-3 text-sm font-medium text-muted-foreground">Закупки участника</p>
                            {ordersLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : purchaseGroups.length === 0 ? (
                                <p className="rounded-lg border border-dashed bg-background py-6 text-center text-sm text-muted-foreground">
                                    Нет закупок с заказами
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {purchaseGroups.map((group) => (
                                        <UserPurchaseGroupBlock key={group.purchaseId} group={group} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
