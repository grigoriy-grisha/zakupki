'use client';

import { getUnitByCode } from '@zakupki/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { HandoffStatusSelect } from '@/components/admin/handoff-status-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import { mutationOptions } from '@/lib/query/mutation-options';

import type { UserPurchaseGroup } from '../lib/group-orders-by-purchase';

interface UserPurchaseGroupProps {
    group: UserPurchaseGroup;
    userId: number;
}

export function UserPurchaseGroupBlock({ group, userId }: UserPurchaseGroupProps) {
    const [open, setOpen] = useState(false);

    const utils = trpc.useUtils();
    const setHandoffStatus = trpc.orders.setHandoffStatus.useMutation(
        mutationOptions({
            invalidate: () => {
                void utils.orders.getByUser.invalidate({ userId });
                void utils.orders.getAllByPurchase.invalidate({ purchaseId: group.purchaseId });
                void utils.orders.getPurchaseOrdersByPurchase.invalidate({ purchaseId: group.purchaseId });
            },
            success: 'Статус выдачи обновлён',
        }),
    );

    return (
        <div className="overflow-hidden rounded-md border bg-bg-base">
            <div className="flex items-center gap-2 pr-3">
                <Button
                    variant="ghost"
                    size="default"
                    aria-expanded={open}
                    onClick={() => setOpen((prev) => !prev)}
                    className="h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 text-left"
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
                        {formatRub(group.totalDue)}
                    </span>
                </Button>
                {group.purchaseOrderId != null && (
                    <HandoffStatusSelect
                        value={group.handoffStatus}
                        disabled={setHandoffStatus.isPending}
                        onSelect={(status) =>
                            setHandoffStatus.mutate({ id: group.purchaseOrderId!, status })
                        }
                    />
                )}
            </div>

            {open && (
                <div className="border-t border-border-low bg-bg-soft/40 px-3 py-2">
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
                                        <p className="text-14-semibold leading-tight">
                                            {order.purchaseItem?.product?.name ?? `Товар #${order.purchaseItemId}`}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                        {order.purchaseItem?.product?.unitCode
                                            ? (getUnitByCode(order.purchaseItem.product.unitCode)?.shortName ?? '')
                                            : ''}
                                    </TableCell>
                                    <TableCell className="text-right text-14-semibold tabular-nums">
                                        {formatRub(Number(order.amountDue))}
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
