'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUnitByCode } from '@zakupki/types';

import type { UserPurchaseGroup } from '../lib/group-orders-by-purchase';

interface UserPurchaseGroupProps {
    group: UserPurchaseGroup;
}

export function UserPurchaseGroupBlock({ group }: UserPurchaseGroupProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="overflow-hidden rounded-md border bg-background">
            <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span className="shrink-0 text-muted-foreground">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                    {group.orderNumber != null && (
                        <p className="text-xs font-medium tabular-nums text-muted-foreground">
                            Заказ №{group.orderNumber}
                        </p>
                    )}
                    <p className="font-medium leading-tight">{group.tag}</p>
                    {group.supplier && <p className="truncate text-xs text-muted-foreground">{group.supplier}</p>}
                </div>
                <Badge variant="outline" className="shrink-0 font-normal">
                    {group.orders.length} поз.
                </Badge>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                    {group.totalDue.toLocaleString('ru-RU')} ₽
                </span>
            </button>

            {open && (
                <div className="border-t bg-muted/20 px-3 py-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Товар</TableHead>
                                <TableHead className="text-right">Кол-во</TableHead>
                                <TableHead className="text-right">Сумма</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell>
                                        <p className="font-medium leading-tight">
                                            {order.purchaseItem?.product?.name ?? `Товар #${order.purchaseItemId}`}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                        {order.purchaseItem?.product?.unitCode
                                            ? (getUnitByCode(order.purchaseItem.product.unitCode)?.shortName ?? '')
                                            : ''}
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
    );
}
