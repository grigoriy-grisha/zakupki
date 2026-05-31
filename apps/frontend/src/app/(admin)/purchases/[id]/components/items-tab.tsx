'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '../../../products/lib';
import {
    formatPrice510Cell,
    formatRubPrice,
    getPackPriceRub,
    getProductPriceTiers,
    getPurchaseItemPrice1Gr,
} from '../lib/purchase-item-prices';
import {
    formatOrderStatValue,
    getPurchaseItemOrderStats,
} from '../lib/purchase-item-order-stats';
import { usePublishToTelegram, useRemovePurchaseItem, useToggleShouldPublish } from '../hooks';
import { ProductPickerDialog } from './product-picker-dialog';
import { ItemEditSheet } from './item-edit-sheet';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
interface ItemsTabProps {
    purchaseId: number;
    onEditSupplement?: () => void;
}

function formatSupplierPackageCell(product: {
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
}) {
    if (product.supplierPackageAmount == null || !product.supplierPackageUnit) return '—';
    const amount = Number(product.supplierPackageAmount);
    const base = `${amount} ${product.supplierPackageUnit}`;
    if (product.supplierPackagePrice != null && Number(product.supplierPackagePrice) > 0) {
        return `${base} · ${Number(product.supplierPackagePrice).toLocaleString('ru-RU')} ₽`;
    }
    return base;
}

const purchaseItemTextClass = 'text-sm font-semibold text-foreground';
const purchaseItemSubtitleClass = 'text-sm font-medium text-muted-foreground';
const purchaseItemNumericClass = `${purchaseItemTextClass} tabular-nums whitespace-nowrap`;
const purchaseItemHeadClass = 'text-sm font-medium text-muted-foreground whitespace-nowrap';
const purchaseItemTgHeadClass = `${purchaseItemHeadClass} text-center pr-5`;
const purchaseItemStatsLeadHeadClass = `${purchaseItemHeadClass} pl-4 border-l border-border/60`;
const purchaseItemTgCellClass = 'text-center pr-5';
const purchaseItemStatsLeadCellClass = `${purchaseItemNumericClass} pl-4 border-l border-border/60`;

export function ItemsTab({ purchaseId, onEditSupplement }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const removeItem = useRemovePurchaseItem(purchaseId);
    const togglePublish = useToggleShouldPublish(purchaseId);
    const publishToTelegram = usePublishToTelegram(purchaseId);

    const [editItem, setEditItem] = useState<number | null>(null);
    const [publishOpen, setPublishOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: number;
        product: ProductLabelSource;
        orderCount: number;
    } | null>(null);

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    const isActive = purchase.status === 'ACTIVE';
    const isSupplement = purchase.status === 'SUPPLEMENT';
    const canTogglePublish = (status: string) => status !== 'DONE';
    const canAddItems = purchase.status !== 'DONE';
    const existingProductIds = new Set(purchase.items.map((item) => item.productId));
    const publishCount = purchase.items.filter((item) => item.shouldPublish && !item.tgMessageId).length;

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
                {(canAddItems || isActive) && (
                    <div className="flex items-center gap-2">
                        {isActive && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={publishCount === 0}
                                onClick={() => setPublishOpen(true)}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Опубликовать в TG
                                {publishCount > 0 && ` (${publishCount})`}
                            </Button>
                        )}
                        {canAddItems ? (
                            <ProductPickerDialog
                                purchaseId={purchaseId}
                                purchaseTag={purchase.tag}
                                existingProductIds={existingProductIds}
                            />
                        ) : null}
                    </div>
                )}
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={purchaseItemHeadClass}>Фото</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Название</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Мин. фасовка</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Фасовка поставщика</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Цена за пачку в рублях</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Цена за 5/10 гр. в рублях</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Цена за 1 гр/шт в рублях</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Заказов</TableHead>
                            <TableHead className={purchaseItemTgHeadClass}>TG</TableHead>
                            <TableHead className={purchaseItemStatsLeadHeadClass}>Набрано, гр</TableHead>
                            <TableHead className={purchaseItemHeadClass}>гр в пачке</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Кол-во пачек к заказу</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Заказано пачек</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Заказано грамм</TableHead>
                            <TableHead className={purchaseItemHeadClass}>Свободный остаток</TableHead>
                            {isSupplement && (
                                <TableHead className={`${purchaseItemHeadClass} text-center`}>Доступно</TableHead>
                            )}
                            <TableHead className="w-16" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purchase.items.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={isSupplement ? 17 : 16}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Нет товаров
                                </TableCell>
                            </TableRow>
                        )}
                        {purchase.items.map((item) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            const published = !!item.tgMessageId;
                            const tiers = getProductPriceTiers(item.product.priceTiers);
                            const stats = getPurchaseItemOrderStats(item);
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
                                    <TableCell className={`min-w-[18rem] max-w-xl whitespace-normal ${purchaseItemTextClass}`}>
                                        <PurchaseProductLabel
                                            product={item.product}
                                            primaryClassName={purchaseItemTextClass}
                                            secondaryClassName={purchaseItemSubtitleClass}
                                        />
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {item.product.minPackageAmount != null && item.product.minPackageUnit
                                            ? `${Number(item.product.minPackageAmount)} ${item.product.minPackageUnit}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatSupplierPackageCell(item.product)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatRubPrice(getPackPriceRub(item.product))}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatPrice510Cell(tiers)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatRubPrice(getPurchaseItemPrice1Gr(item))}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{item.orderLines.length}</Badge>
                                    </TableCell>
                                    <TableCell className={purchaseItemTgCellClass} onClick={(e) => e.stopPropagation()}>
                                        {published ? (
                                            <Checkbox checked disabled aria-label="Опубликовано в Telegram" />
                                        ) : (
                                            <Checkbox
                                                checked={item.shouldPublish}
                                                disabled={
                                                    !canTogglePublish(purchase.status) || togglePublish.isPending
                                                }
                                                aria-label="Опубликовать в Telegram"
                                                onCheckedChange={(v) => {
                                                    if (typeof v === 'boolean') {
                                                        togglePublish.mutate({ purchaseItemId: item.id, value: v });
                                                    }
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.totalGrams)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.packGrams)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.packsToOrder)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.orderedPacks)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.totalGrams)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.freeRemainder)}
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
                                        {(!isActive || !published) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() =>
                                                    setDeleteTarget({
                                                        id: item.id,
                                                        product: item.product,
                                                        orderCount: item.orderLines.length,
                                                    })
                                                }
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

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title="Удалить товар из закупки?"
                description={
                    deleteTarget ? (
                        <>
                            Товар{' '}
                            <strong>
                                <PurchaseProductLabel product={deleteTarget.product} as="span" />
                            </strong>{' '}
                            будет удалён из закупки.
                            {deleteTarget.orderCount > 0 && (
                                <>
                                    {' '}
                                    Также будут удалены заказы участников ({deleteTarget.orderCount}).
                                </>
                            )}
                        </>
                    ) : (
                        ''
                    )
                }
                loading={removeItem.isPending}
                onConfirm={() => {
                    if (!deleteTarget) return;
                    removeItem.mutate(
                        { purchaseItemId: deleteTarget.id },
                        { onSuccess: () => setDeleteTarget(null) },
                    );
                }}
            />

            <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Опубликовать в Telegram?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {publishCount > 0
                            ? `${publishCount} товаров будет опубликовано в канал Telegram.`
                            : 'Отметьте галочкой товары в таблице, которые нужно опубликовать.'}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPublishOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            disabled={publishToTelegram.isPending || publishCount === 0}
                            onClick={() => {
                                publishToTelegram.mutate(
                                    { purchaseId },
                                    { onSuccess: () => setPublishOpen(false) },
                                );
                            }}
                        >
                            {publishToTelegram.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Опубликовать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

