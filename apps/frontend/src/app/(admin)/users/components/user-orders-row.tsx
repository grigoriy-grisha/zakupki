'use client';

import { useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { UserOrdersRowProps } from '../../lib/types';

export function UserOrdersRow({ userId, userName }: UserOrdersRowProps) {
    const [open, setOpen] = useState(false);
    const { data: orders, isLoading } = trpc.orders.getMyOrders.useQuery(
        { _userId: userId },
        { enabled: open },
    );

    return (
        <>
            <TableRow
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <TableCell>
                    <div className="flex items-center gap-1">
                        {open ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {userName.charAt(0)}
                        </div>
                    </div>
                </TableCell>
                <TableCell className="font-medium">{userName}</TableCell>
                <TableCell>
                    <Badge variant="secondary" className="font-normal">
                        {orders?.length ?? '...'} заказов
                    </Badge>
                </TableCell>
            </TableRow>
            {open && (
                <TableRow>
                    <TableCell colSpan={3} className="bg-muted/30 p-0">
                        <div className="p-4">
                            {isLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : !orders?.length ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">Нет заказов</p>
                            ) : (
                                <div className="rounded-md border bg-background">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Товар</TableHead>
                                                <TableHead>Закупка</TableHead>
                                                <TableHead>Кол-во</TableHead>
                                                <TableHead>Сумма</TableHead>
                                                <TableHead>Дата</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orders.map((order) => (
                                                <TableRow key={order.id}>
                                                    <TableCell className="font-medium">
                                                        {order.purchaseItem?.product?.name ?? `Товар #${order.purchaseItemId}`}
                                                    </TableCell>
                                                    <TableCell>
                                                        {order.purchaseItem?.purchase?.tag ?? '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                                        {order.purchaseItem?.product?.unit?.shortName ?? ''}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {Number(order.amountDue).toLocaleString('ru-RU')} ₽
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="font-bold bg-muted/50">
                                                <TableCell colSpan={3}>Итого</TableCell>
                                                <TableCell>
                                                    {orders
                                                        .reduce((s, o) => s + Number(o.amountDue), 0)
                                                        .toLocaleString('ru-RU')}{' '}
                                                    ₽
                                                </TableCell>
                                                <TableCell />
                                            </TableRow>
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
