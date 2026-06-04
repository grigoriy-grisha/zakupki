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
import { DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT, parsePriceTiers } from '@zakupki/types';
import {
    formatPrice510Cell,
    formatRubPrice,
    getDiscountedPackPriceRub,
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
interface ItemsTabProps {
    purchaseId: number;
}

function formatPackAmountWithUnit(amount: unknown, unit: string | null | undefined): string | null {
    const n = Number(amount);
    const u = unit?.trim();
    if (!u || !Number.isFinite(n) || n <= 0) return null;
    return `${Math.trunc(n)} ${u}`;
}

/** Фасовки поставщика без цены: «100 гр», «1 шт» и т.д. */
function formatSupplierPackageCell(product: {
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackageTiers?: unknown;
}) {
    const lines: string[] = [];
    for (const tier of parsePriceTiers(product.supplierPackageTiers)) {
        const line = formatPackAmountWithUnit(tier.amount, tier.unit);
        if (line) lines.push(line);
    }
    if (lines.length > 0) {
        return lines.join(', ');
    }
    const fallback = formatPackAmountWithUnit(
        product.supplierPackageAmount,
        product.supplierPackageUnit,
    );
    return fallback ?? '—';
}

const purchaseItemTextClass = 'text-sm font-semibold text-foreground';
const purchaseItemSubtitleClass = 'text-sm font-medium text-muted-foreground';
const purchaseItemNumericClass = `${purchaseItemTextClass} tabular-nums whitespace-nowrap`;
const purchaseItemHeadClass =
    'text-sm font-medium text-muted-foreground whitespace-normal text-center leading-snug align-middle px-2';
const purchaseItemTgColumnClass = 'w-14 pr-5 align-middle [&:has([role=checkbox])]:pr-5 [&_[role=checkbox]]:translate-y-0';
const purchaseItemTgHeadClass = `${purchaseItemHeadClass} ${purchaseItemTgColumnClass}`;
const purchaseItemStatsLeadHeadClass = `${purchaseItemHeadClass} pl-4`;
const purchaseItemTgCellClass = `${purchaseItemTgColumnClass} text-center`;
const purchaseItemStatsLeadCellClass = `${purchaseItemNumericClass} pl-4`;
export function ItemsTab({ purchaseId }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { data: pricingSettings } = trpc.appSettings.getPricing.useQuery();
    const packDiscountPercent =
        pricingSettings?.beadPackPriceDiscountPercent ?? DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
    const removeItem = useRemovePurchaseItem(purchaseId);
    const togglePublish = useToggleShouldPublish(purchaseId);
    const publishToTelegram = usePublishToTelegram(purchaseId);

    const [editItem, setEditItem] = useState<number | null>(null);
    const [publishOpen, setPublishOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: number;
        product: ProductLabelSource;
        orderCount: number;
        published: boolean;
    } | null>(null);

    if (isLoading || !purchase) {
        return <Skeleton className="h-64" />;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (purchase as any).items ?? [];
    const isActive = purchase.status === 'ACTIVE';
    const isSupplement = purchase.status === 'SUPPLEMENT';
    const canTogglePublish = (status: string) => status !== 'DONE';
    const canAddItems = purchase.status !== 'DONE';
    const canRemoveItem = purchase.status !== 'DONE';
    const existingProductIds = new Set<number>(items.map((item: any) => item.productId as number));
    const publishCount = items.filter((item: { shouldPublish: boolean; tgMessageId: string | null }) => item.shouldPublish && !item.tgMessageId).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium sm:text-lg">Товары в закупке</h2>
                </div>
                {(canAddItems || isActive) && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                        {isActive && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                disabled={publishCount === 0}
                                onClick={() => setPublishOpen(true)}
                            >
                                <Send className="mr-2 h-4 w-4 shrink-0" />
                                <span className="truncate sm:hidden">
                                    В TG{publishCount > 0 ? ` (${publishCount})` : ''}
                                </span>
                                <span className="hidden truncate sm:inline">
                                    Опубликовать в TG
                                    {publishCount > 0 && ` (${publishCount})`}
                                </span>
                            </Button>
                        )}
                        {canAddItems ? (
                            <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
                                <ProductPickerDialog
                                    purchaseId={purchaseId}
                                    purchaseTag={purchase.tag}
                                    existingProductIds={existingProductIds}
                                />
                            </div>
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
                            <TableHead className={purchaseItemHeadClass}>
                                Мин.
                                <br />
                                фасовка, гр/шт
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Фасовка
                                <br />
                                поставщика, гр/шт
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Цена за 1 гр/шт
                                <br />
                                в рублях
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Цена за 5/10 гр
                                <br />
                                в рублях
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Цена за пачку
                                <br />
                                в рублях
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Цена за пачку
                                <br />
                                со скидкой
                            </TableHead>
                            <TableHead className={purchaseItemTgHeadClass}>
                                <div className="flex justify-center">TG</div>
                            </TableHead>
                            <TableHead className={purchaseItemStatsLeadHeadClass}>
                                Набрано,
                                <br />
                                гр/шт
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Заказано
                                <br />
                                гр/шт
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Заказано
                                <br />
                                пачек
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Кол-во пачек
                                <br />к заказу
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Свободный
                                <br />
                                остаток
                            </TableHead>
                            {isSupplement && (
                                <TableHead className={`${purchaseItemHeadClass} text-center`}>Доступно</TableHead>
                            )}
                            <TableHead className="w-16" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={isSupplement ? 16 : 15}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Нет товаров
                                </TableCell>
                            </TableRow>
                        )}
                        {items.map((item: any) => {
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
                                        {formatRubPrice(getPurchaseItemPrice1Gr(item))}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatPrice510Cell(tiers)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatRubPrice(getPackPriceRub(item.product))}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatRubPrice(getDiscountedPackPriceRub(item.product, packDiscountPercent))}
                                    </TableCell>
                                    <TableCell className={purchaseItemTgCellClass} onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-center">
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
                                        </div>
                                    </TableCell>
                                    <TableCell className={purchaseItemStatsLeadCellClass}>
                                        {formatOrderStatValue(stats.totalQuantity)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.orderedQuantity)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.orderedPacks)}
                                    </TableCell>
                                    <TableCell className={purchaseItemNumericClass}>
                                        {formatOrderStatValue(stats.packsToOrder)}
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
                                        {canRemoveItem && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() =>
                                                    setDeleteTarget({
                                                        id: item.id,
                                                        product: item.product,
                                                        orderCount: item.orderLines.length,
                                                        published,
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
                            {deleteTarget.published && (
                                <>
                                    {' '}
                                    Пост в Telegram будет удалён.
                                </>
                            )}
                            {deleteTarget.orderCount > 0 && (
                                <>
                                    {' '}
                                    Заказы участников в корзине будут сняты ({deleteTarget.orderCount}).
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
                        <DialogDescription>
                            {publishCount > 0
                                ? `${publishCount} товаров будет опубликовано в канал Telegram.`
                                : 'Отметьте галочкой товары в таблице, которые нужно опубликовать.'}
                        </DialogDescription>
                    </DialogHeader>
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

