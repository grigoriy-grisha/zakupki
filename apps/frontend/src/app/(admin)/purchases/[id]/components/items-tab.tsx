'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trash2 } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { useRemovePurchaseItem, useToggleShouldPublish } from '../hooks';
import { ProductPickerDialog } from './product-picker-dialog';
import { PurchaseProductEditForm } from './purchase-product-edit-form';
interface ItemsTabProps {
    purchaseId: number;
    onEditSupplement?: () => void;
}

export function ItemsTab({ purchaseId, onEditSupplement }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const removeItem = useRemovePurchaseItem(purchaseId);
    const togglePublish = useToggleShouldPublish(purchaseId);

    const [editItem, setEditItem] = useState<number | null>(null);

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    const isDraft = purchase.status === 'DRAFT';
    const isActive = purchase.status === 'ACTIVE';
    const isSupplement = purchase.status === 'SUPPLEMENT';
    const canAddItems = purchase.status !== 'DONE';
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
                {canAddItems ? (
                    <ProductPickerDialog
                        purchaseId={purchaseId}
                        purchaseTag={purchase.tag}
                        existingProductIds={existingProductIds}
                    />
                ) : null}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Фото</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Мин. фасовка</TableHead>
                            <TableHead>Цена/ед</TableHead>
                            <TableHead>Заказов</TableHead>
                            <TableHead className="text-center">TG</TableHead>
                            {isSupplement && <TableHead className="text-center">Доступно</TableHead>}
                            <TableHead className="w-16" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purchase.items.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={isSupplement ? 8 : 7}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Нет товаров
                                </TableCell>
                            </TableRow>
                        )}
                        {purchase.items.map((item) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            const published = !!item.tgMessageId;
                            return (
                                <TableRow
                                    key={item.id}
                                    className="cursor-pointer hover:bg-accent/50"
                                    onClick={() => setEditItem(item.id)}
                                >
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
                                    <TableCell className="text-muted-foreground">
                                        {item.product.minPackageAmount != null && item.product.minPackageUnit
                                            ? `${Number(item.product.minPackageAmount)} ${item.product.minPackageUnit}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {Number(item.priceOverride ?? item.product.pricePerUnit).toLocaleString(
                                            'ru-RU',
                                        )}{' '}
                                        ₽
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{item.orderLines.length}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        {published ? (
                                            <Badge variant="outline">✓</Badge>
                                        ) : (
                                            <Checkbox
                                                checked={item.shouldPublish}
                                                disabled={!isDraft || togglePublish.isPending}
                                                onCheckedChange={(v) => {
                                                    if (typeof v === 'boolean') {
                                                        togglePublish.mutate({ purchaseItemId: item.id, value: v });
                                                    }
                                                }}
                                            />
                                        )}
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
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        {!isActive && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => removeItem.mutate({ purchaseItemId: item.id })}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <ItemEditSheet
                purchaseItemId={editItem}
                open={editItem !== null}
                onClose={() => setEditItem(null)}
                purchaseId={purchaseId}
            />
        </div>
    );
}

function ItemEditSheet({
    purchaseItemId,
    open,
    onClose,
    purchaseId,
}: {
    purchaseItemId: number | null;
    open: boolean;
    onClose: () => void;
    purchaseId: number;
}) {
    const utils = trpc.useUtils();
    const { data: purchase } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const item = purchase?.items.find((i: any) => i.id === purchaseItemId);

    const updateMutation = trpc.purchases.updateItemProduct.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            void utils.products.list.invalidate();
            toast.success('Товар обновлён');
            onClose();
        },
        onError: (err) => toast.error(err.message),
    });

    if (!item) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = item.product as any;
    const tiers: { amount: number; unit: string; price: number }[] = Array.isArray(product.priceTiers)
        ? product.priceTiers
        : [];
    const published = !!item.tgMessageId;

    return (
        <Sheet
            open={open}
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Редактировать товар {published && '· Пост в TG обновится'}</SheetTitle>
                </SheetHeader>
                <PurchaseProductEditForm
                    key={product.id}
                    product={product}
                    loadSavedDescription
                    purchaseTag={purchase?.tag}
                    initialTiers={tiers}
                    onSave={(data) => updateMutation.mutate({ purchaseItemId: purchaseItemId!, product: data })}
                    isSaving={updateMutation.isPending}
                    submitLabel={published ? 'Сохранить и обновить пост в TG' : 'Сохранить'}
                />
            </SheetContent>
        </Sheet>
    );
}

