'use client';

import { ChevronDown, ChevronRight, CircleCheck, CircleX, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import { mutationOptions } from '@/lib/query/mutation-options';
import { safeNumber } from '@/lib/utils';
import { displayName, resolveAvatarUrl } from '@/lib/utils/user';

import { countUniquePurchases, groupOrdersByPurchase } from '../lib/group-orders-by-purchase';
import { type UserListItem } from './user-profile-sheet';
import { UserPurchaseGroupBlock } from './user-purchase-group';
import { UserRoleSelect } from './user-role-select';

interface UserOrdersRowProps {
    user: UserListItem;
    onOpenProfile: (user: UserListItem) => void;
}

export function UserOrdersRow({ user, onOpenProfile }: UserOrdersRowProps) {
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const name = displayName(user);
    const avatarUrl = resolveAvatarUrl(user);
    const tgUsername = user.telegramCredential?.username ?? user.username;
    const purchaseCount = countUniquePurchases(user.orderLines);
    const hasOrders = user.orderLines.length > 0;
    const paymentsCount = user.payments?.length ?? 0;
    const ordersTotal = user.orderLines.reduce((sum, line) => sum + safeNumber(line.amountDue), 0);
    const paymentsTotal = (user.payments ?? []).reduce((sum, payment) => sum + safeNumber(payment.amount), 0);

    const { data: orders, isLoading: ordersLoading } = trpc.orders.getByUser.useQuery(
        { userId: user.id },
        { enabled: open },
    );

    const utils = trpc.useUtils();
    const deleteUser = trpc.users.delete.useMutation(
        mutationOptions({
            invalidate: () => void utils.users.list.invalidate(),
            success: 'Участник удалён',
        }),
    );

    const purchaseGroups = useMemo(() => (orders ? groupOrdersByPurchase(orders) : []), [orders]);

    return (
        <>
            <TableRow className="hover:bg-bg-soft/70 transition-colors">
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
                    {user.personalDataConsentAt ? (
                        <p className="flex items-center gap-1 text-13-regular text-success">
                            <CircleCheck className="size-3.5 shrink-0" aria-hidden />
                            {new Date(user.personalDataConsentAt).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </p>
                    ) : (
                        <p className="flex items-center gap-1 text-13-regular text-warning">
                            <CircleX className="size-3.5 shrink-0" aria-hidden />
                            Не получено
                        </p>
                    )}
                </TableCell>
                <TableCell>
                    <Badge variant="secondary" className="font-normal">
                        {purchaseCount > 0
                            ? `${purchaseCount} закупок · ${user.orderLines.length} поз.`
                            : `${user.orderLines.length} поз.`}
                    </Badge>
                </TableCell>
                <TableCell>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Удалить участника ${name}`}
                        onClick={() => setDeleteOpen(true)}
                        className="text-fg-tertiary hover:text-error"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </TableCell>
            </TableRow>

            {open && (
                <TableRow>
                    <TableCell colSpan={6} className="bg-bg-soft/50 p-0">
                        <div className="p-4">
                            <p className="mb-3 text-14-semibold text-fg-secondary">Закупки участника</p>
                            {ordersLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : purchaseGroups.length === 0 ? (
                                <p className="rounded-lg border border-dashed py-6 text-center text-14-regular text-fg-secondary">
                                    Нет закупок с заказами
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {purchaseGroups.map((group) => (
                                        <UserPurchaseGroupBlock key={group.purchaseId} group={group} userId={user.id} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Удалить участника?"
                description={
                    <div className="space-y-2">
                        <p>
                            Будет удалён участник <strong>{name}</strong>
                            {tgUsername ? ` (@${tgUsername.replace(/^@/, '')})` : ''}:
                        </p>
                        {hasOrders || paymentsCount > 0 ? (
                            <ul className="list-disc space-y-1 pl-5">
                                {purchaseCount > 0 && (
                                    <li>
                                        закупок: {purchaseCount}, позиций: {user.orderLines.length} на{' '}
                                        {formatRub(ordersTotal)}
                                    </li>
                                )}
                                {paymentsCount > 0 && (
                                    <li>
                                        платежей: {paymentsCount} на {formatRub(paymentsTotal)}
                                    </li>
                                )}
                            </ul>
                        ) : (
                            <p>Заказов и платежей нет.</p>
                        )}
                        <p>
                            Будут удалены все его заказы, платежи, привязки Telegram/VK и уведомления. Суммы в
                            закупках пересчитаются. Действие необратимо.
                        </p>
                    </div>
                }
                confirmLabel="Удалить"
                loading={deleteUser.isPending}
                onConfirm={() => deleteUser.mutate({ id: user.id }, { onSuccess: () => setDeleteOpen(false) })}
            />
        </>
    );
}
