'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { productPhotoUrl } from '@/lib/product-photo-url';
import { getSupplementPool } from '@zakupki/types';
import { formatOrderStatValue, getPurchaseItemOrderStats } from '../lib/purchase-item-order-stats';
import { ItemEditSheet } from './item-edit-sheet';
import type { PurchaseDetail, PurchaseItem } from '../lib/types';

interface SupplementTabProps {
    purchaseId: number;
}

/**
 * Товар попадает на вкладку «Доборы», если у него есть supplier pack (т.е. можно
 * автоматически вычислить свободный остаток от последней пачки) ИЛИ админ явно
 * выставил targetRemainder > 0. Остальное — обычные товары без добора.
 */
function isOnRemainder(item: PurchaseItem): boolean {
    const hasPack =
        item.product.supplierPackageAmount != null && Number(item.product.supplierPackageAmount) > 0;
    const hasManual = item.targetRemainder != null && Number(item.targetRemainder) > 0;
    return hasPack || hasManual;
}

export function SupplementTab({ purchaseId }: SupplementTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const [editItem, setEditItem] = useState<number | null>(null);

    const allItems = ((purchase as unknown as PurchaseDetail | null)?.items) ?? [];
    const remainderItems = useMemo(() => allItems.filter(isOnRemainder), [allItems]);

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-base font-medium sm:text-lg">Доборы — остатки для дозаказа</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Остаток считается автоматически от последней пачки поставщика.
                    {remainderItems.length > 0 && (
                        <> Администратор может переопределить лимит в диалоге «Остатки для добора».</>
                    )}
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
                            <TableHead className="text-right">Свободно</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {remainderItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Нет товаров с пачкой поставщика. Добавьте фасовку в редактировании товара,
                                    чтобы открыть добор.
                                </TableCell>
                            </TableRow>
                        )}
                        {remainderItems.map((item) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            const stats = getPurchaseItemOrderStats(item);
                            const totalOrderedQuantity = (item.orderLines ?? []).reduce(
                                (acc: number, line: { quantity?: unknown }) =>
                                    acc + Number(line.quantity ?? 0),
                                0,
                            );
                            const totalReservedRemainder = (item.orderLines ?? []).reduce(
                                (acc: number, line: { baseQuantity?: unknown }) =>
                                    acc + Number(line.baseQuantity ?? 0),
                                0,
                            );
                            const packSize =
                                item.product.supplierPackageAmount != null
                                    ? Number(item.product.supplierPackageAmount)
                                    : null;
                            const remainderLeft = getSupplementPool({
                                targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
                                totalOrderedQuantity,
                                totalReservedRemainder,
                                packSize,
                            });
                            const isManualLimit =
                                item.targetRemainder != null && Number(item.targetRemainder) > 0;
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
                                        {packSize != null ? `${packSize} ${shortName}` : '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">{item.orderLines.length}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatOrderStatValue(stats.totalQuantity)} {shortName}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {remainderLeft == null ? (
                                            <span className="text-muted-foreground">—</span>
                                        ) : remainderLeft > 0 ? (
                                            <>
                                                {formatOrderStatValue(remainderLeft)} {shortName}
                                                {isManualLimit && (
                                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                                        (вручную)
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">разобрано</span>
                                        )}
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
