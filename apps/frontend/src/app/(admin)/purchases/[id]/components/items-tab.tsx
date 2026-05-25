'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2 } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { useRemovePurchaseItem } from '../hooks';
import { ProductPickerDialog } from './product-picker-dialog';
import type { ItemsTabProps } from '../../../lib/types';

export function ItemsTab({ purchaseId, onEditSupplement }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const removeItem = useRemovePurchaseItem(purchaseId);

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    const isSupplement = purchase.status === 'SUPPLEMENT';
    const existingProductIds = new Set(purchase.items.map((item) => item.productId));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium">Товары в закупке</h2>
                    {isSupplement && onEditSupplement && (
                        <Button variant="outline" size="sm" onClick={onEditSupplement}>
                            Редактировать остатки
                        </Button>
                    )}
                </div>
                <ProductPickerDialog purchaseId={purchaseId} existingProductIds={existingProductIds} />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Фото</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Бренд</TableHead>
                            <TableHead>Цена/ед</TableHead>
                            <TableHead>Заказов</TableHead>
                            {isSupplement && <TableHead className="text-center">Доступно</TableHead>}
                            <TableHead className="w-16" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purchase.items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={isSupplement ? 7 : 6} className="h-24 text-center text-muted-foreground">
                                    Нет товаров
                                </TableCell>
                            </TableRow>
                        )}
                        {purchase.items.map((item) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        {item.product.photos?.[0] ? (
                                            <img
                                                src={`/api/photos/${item.product.photos[0].id}`}
                                                alt={item.product.name}
                                                className="h-10 w-10 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                                                Нет
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{item.product.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.product.brand ?? '—'}</TableCell>
                                    <TableCell>
                                        {Number(item.priceOverride ?? item.product.pricePerUnit).toLocaleString('ru-RU')} ₽
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{item.orderLines.length}</Badge>
                                    </TableCell>
                                    {isSupplement && (
                                        <TableCell className="text-center">
                                            {item.availableQty !== null && item.availableQty !== undefined ? (
                                                <Badge
                                                    variant={Number(item.availableQty) > 0 ? 'outline' : 'destructive'}
                                                    className="font-mono"
                                                >
                                                    {Number(item.availableQty)} {shortName}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">∞</span>
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => removeItem.mutate({ purchaseItemId: item.id })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
