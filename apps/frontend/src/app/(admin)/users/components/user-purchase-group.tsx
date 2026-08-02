'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUnitByCode } from '@zakupki/types';
import { cn } from '@/lib/utils';

import type { UserPurchaseGroup } from '../lib/group-orders-by-purchase';

interface UserPurchaseGroupProps {
    group: UserPurchaseGroup;
}

export function UserPurchaseGroupBlock({ group }: UserPurchaseGroupProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="overflow-hidden rounded-md border bg-background">
            <Button
                variant="ghost"
                size="default"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
            >
                <span className="shrink-0 text-fg-tertiary">
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                    {group.orderNumber != null && (
                        <p className="text-12-medium tabular-nums text-fg-tertiary">
                            Заказ №{group.orderNumber}
                        </p>
                    )}
                    <p className="text-14-medium leading-tight text-fg-primary">{group.tag}</p>
                </div>
                <Badge variant="outline" className="shrink-0 font-normal">
                    {group.orders.length} поз.
                </Badge>
                <span className="shrink-0 text-14-medium tabular-nums text-fg-primary">
                    {group.totalDue.toLocaleString('ru-RU')} ₽
                </span>
            </Button>

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
