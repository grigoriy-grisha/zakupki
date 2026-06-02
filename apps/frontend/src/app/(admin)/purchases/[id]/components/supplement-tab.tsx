'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { productPhotoUrl } from '@/lib/product-photo-url';
import { formatOrderStatValue, getPurchaseItemOrderStats } from '../lib/purchase-item-order-stats';
import { ItemEditSheet } from './item-edit-sheet';

interface SupplementTabProps {
    purchaseId: number;
}

function hasSupplementStock(availableQty: string | number | null | undefined): boolean {
    return availableQty !== null && availableQty !== undefined && Number(availableQty) > 0;
}

function isOnRemainder(item: {
    availableQty: string | number | null | undefined;
    orderLines: { quantity: unknown }[];
    product: { supplierPackageAmount?: unknown; supplierPackageUnit?: string | null };
}): boolean {
    if (hasSupplementStock(item.availableQty)) return true;
    const stats = getPurchaseItemOrderStats(item);
    return stats.freeRemainder != null && stats.freeRemainder > 0;
}

export function SupplementTab({ purchaseId }: SupplementTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const [editItem, setEditItem] = useState<number | null>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems = (purchase as any)?.items ?? [];
    const remainderItems = useMemo(
        () => allItems.filter((item: any) => isOnRemainder(item)),
        [allItems],
    );

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-base font-medium sm:text-lg">Доборы — товары на остатке</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Позиции с остатком для добора или свободным остатком по пачкам (любой статус закупки)
                </p>
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-14">Фото</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead className="text-center">В пачке</TableHead>
                            <TableHead className="text-center">Заказов</TableHead>
                            <TableHead className="text-right">Набрано</TableHead>
                            <TableHead className="text-right">Своб. остаток</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {remainderItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Нет товаров на остатке. Задайте «Доступно» в остатках или дождитесь заказов с
                                    свободным остатком по пачкам.
                                </TableCell>
                            </TableRow>
                        )}
                        {remainderItems.map((item: any) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            const stats = getPurchaseItemOrderStats(item);
                            const packUnit = stats.packUnit ?? shortName;
                            return (
                                <TableRow
                                    key={item.id}
                                    className="cursor-pointer hover:bg-accent/50"
                                    onClick={() => setEditItem(item.id)}
                                >
                                    <TableCell>
                                        {item.product.photos?.[0] ? (
                                            <img
                                                src={productPhotoUrl(item.product.photos[0].id)}
                                                alt={item.product.name}
                                                className="h-10 w-10 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                                                —
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="min-w-[12rem] whitespace-normal">
                                        <PurchaseProductLabel product={item.product} />
                                    </TableCell>
                                    <TableCell className="text-center text-sm tabular-nums">
                                        {item.product.supplierPackageAmount != null && item.product.supplierPackageUnit
                                            ? `${Number(item.product.supplierPackageAmount)} ${item.product.supplierPackageUnit}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">{item.orderLines.length}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatOrderStatValue(stats.totalQuantity)} {shortName}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {stats.freeRemainder != null && stats.freeRemainder > 0
                                            ? `${formatOrderStatValue(stats.freeRemainder)} ${packUnit}`
                                            : '—'}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {remainderItems.length > 0 && (
                <p className="text-sm text-muted-foreground">
                    Показано: {remainderItems.length} из {allItems.length}
                </p>
            )}

            <ItemEditSheet
                purchaseItemId={editItem}
                open={editItem !== null}
                onClose={() => setEditItem(null)}
                purchaseId={purchaseId}
            />
        </div>
    );
}
