'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import type { ProductLabelSource } from '../../../products/lib';
import { getSupplementPool, parsePriceTiers } from '@zakupki/types';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import {
    formatPrice510Cell,
    formatRubPrice,
    getDiscountedPackPriceRub,
    getPackPriceRub,
    getProductPriceTiers,
    getPurchaseItemPrice1Gr,
} from '../lib/purchase-item-prices';
import { formatOrderStatValue, getPurchaseItemOrderStats } from '../lib/purchase-item-order-stats';
import {
    purchaseItemTextClass,
    purchaseItemSubtitleClass,
    purchaseItemNumericClass,
    purchaseItemHeadClass,
    purchaseItemTgHeadClass,
    purchaseItemStatsLeadHeadClass,
    purchaseItemTgCellClass,
    purchaseItemStatsLeadCellClass,
} from '../lib/table-styles';
import { usePurchaseActions, useRemovePurchaseItem, useToggleShouldPublish } from '../hooks';
import { ProductPickerDialog } from './product-picker-dialog';
import { ItemEditSheet } from './item-edit-sheet';
import { PublishToTgDialog } from './publish-to-tg-dialog';
import type { PurchaseDetail } from '../lib/types';

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
    const fallback = formatPackAmountWithUnit(product.supplierPackageAmount, product.supplierPackageUnit);
    return fallback ?? '—';
}

export function ItemsTab({ purchaseId }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();
    const removeItem = useRemovePurchaseItem(purchaseId);
    const togglePublish = useToggleShouldPublish(purchaseId);
    const purchaseActions = usePurchaseActions(purchaseId);

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

    const typedPurchase = purchase as unknown as PurchaseDetail;
    const items = typedPurchase.items;
    const isActive = typedPurchase.status === 'ACTIVE';
    // ФИКС #11: колонка «Доступно» показывается в REORDER.
    const isInSupplementPhase = typedPurchase.fulfillmentStatus === 'REORDER';
    const canTogglePublish = (status: string) => status !== 'DONE';
    const canAddItems = typedPurchase.status !== 'DONE';
    const canRemoveItem = typedPurchase.status !== 'DONE';
    const existingProductIds = new Set<number>(items.map((item) => item.productId));
    const publishCount = items.filter((item) => item.publicationState === 'DRAFT' && !item.tgMessageId).length;

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
                                    purchaseTag={typedPurchase.tag}
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
                                <br />в рублях
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Цена за 5/10 гр
                                <br />в рублях
                            </TableHead>
                            <TableHead className={purchaseItemHeadClass}>
                                Цена за пачку
                                <br />в рублях
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
                            {isInSupplementPhase && (
                                <TableHead className={`${purchaseItemHeadClass} text-center`}>Доступно</TableHead>
                            )}
                            <TableHead className="w-16" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={isInSupplementPhase ? 16 : 15}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    Нет товаров
                                </TableCell>
                            </TableRow>
                        )}
                        {items.map((item) => {
                            const shortName = item.product.unit?.shortName ?? '';
                            const published = !!item.tgMessageId;
                            const tiers = getProductPriceTiers(item.product.priceTiers);
                            const stats = getPurchaseItemOrderStats(item);
                            // Свободный остаток = либо ручной target pool минус зарезервированное,
                            // либо авто-расчёт по «остатку последней пачки».
                            const totalOrderedQuantity = (item.orderLines ?? []).reduce(
                                (acc: number, line: { quantity?: unknown }) =>
                                    acc + Number(line.quantity ?? 0),
                                0,
                            );
                            const supplementClaimed = (item.orderLines ?? []).reduce(
                                (acc: number, line: { quantity?: unknown; baseQuantity?: unknown }) =>
                                    acc + Math.max(0, Number(line.quantity ?? 0) - Number(line.baseQuantity ?? 0)),
                                0,
                            );
                            const totalBaseQuantity = (item.orderLines ?? []).reduce(
                                (acc: number, line: { baseQuantity?: unknown }) =>
                                    acc + Number(line.baseQuantity ?? 0),
                                0,
                            );
                            const freeRemainder = getSupplementPool({
                                targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
                                totalOrderedQuantity,
                                supplementClaimed,
                                packSize:
                                    item.product.supplierPackageAmount != null
                                        ? Number(item.product.supplierPackageAmount)
                                        : null,
                                totalBaseQuantity,
                            });
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
                                    <TableCell
                                        className={`min-w-[18rem] max-w-xl whitespace-normal ${purchaseItemTextClass}`}
                                    >
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
                                                    checked={item.publicationState === 'PUBLISHED'}
                                                    disabled={
                                                        !canTogglePublish(typedPurchase.status) || togglePublish.isPending
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
                                        {formatOrderStatValue(freeRemainder)}
                                    </TableCell>
                                    {isInSupplementPhase && (
                                        <TableCell className="text-center">
                                            {item.targetRemainder !== null && item.targetRemainder !== undefined ? (
                                                <Badge
                                                    variant={Number(item.targetRemainder) > 0 ? 'outline' : 'destructive'}
                                                    className="font-mono"
                                                >
                                                    {Number(item.targetRemainder)} {shortName}
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
                            {deleteTarget.published && <> Пост в Telegram будет удалён.</>}
                            {deleteTarget.orderCount > 0 && (
                                <> Заказы участников в корзине будут сняты ({deleteTarget.orderCount}).</>
                            )}
                        </>
                    ) : (
                        ''
                    )
                }
                loading={removeItem.isPending}
                onConfirm={() => {
                    if (!deleteTarget) return;
                    removeItem.mutate({ purchaseItemId: deleteTarget.id }, { onSuccess: () => setDeleteTarget(null) });
                }}
            />

            <PublishToTgDialog
                open={publishOpen}
                onOpenChange={setPublishOpen}
                publishCount={publishCount}
                isPending={purchaseActions.publishAll.isPending}
                onPublish={() => {
                    purchaseActions.publishAll.mutate({ purchaseId }, { onSuccess: () => setPublishOpen(false) });
                }}
            />
        </div>
    );
}
