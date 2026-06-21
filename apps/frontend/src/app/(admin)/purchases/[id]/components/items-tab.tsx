'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, MoreHorizontal, Plus, Search, Send, Trash2 } from 'lucide-react';
import {
    computeRawPool,
    getStageStrategy,
    parsePriceTiers,
    toOrderLinesVO,
} from '@zakupki/types';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { MiniProgress } from '@/components/ui/mini-progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trpc } from '@/lib/client/trpc';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { cn } from '@/lib/utils';

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
import { useRemovePurchaseItem } from '../hooks';
import { ItemEditSheet } from './item-edit-sheet';
import { ProductPickerDialog } from './product-picker-dialog';
import { PublishToTgDialog } from './publish-to-tg-dialog';
import type { PurchaseDetail } from '../lib/types';
import type { ProductLabelSource } from '../../../products/lib';

interface ItemsTabProps {
    purchaseId: number;
    /** Колбэк для прокидывания выбранных TG id в PurchaseStepCard (для счётчика bulk-publish). */
    onSelectionChange?: (count: number) => void;
}

export function ItemsTab({ purchaseId, onSelectionChange }: ItemsTabProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();
    const removeItem = useRemovePurchaseItem(purchaseId);
    const utils = trpc.useUtils();

    const [search, setSearch] = useState('');
    const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'unpublished'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [editItemId, setEditItemId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: number;
        product: ProductLabelSource;
        orderCount: number;
        published: boolean;
    } | null>(null);
    const [publishOpen, setPublishOpen] = useState(false);

    const publishAll = trpc.purchases.publishToTelegram.useMutation({
        onSuccess: () => {
            setPublishOpen(false);
            setSelectedIds(new Set());
            void utils.purchases.getById.invalidate({ id: purchaseId });
        },
    });

    if (isLoading || !purchase) {
        return <div className="h-64 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    const typedPurchase = purchase as unknown as PurchaseDetail;
    const items = typedPurchase.items;
    const isInSupplementPhase = typedPurchase.fulfillmentStatus === 'REORDER';
    const canAddItems = typedPurchase.status !== 'DONE';
    const isActive = typedPurchase.status === 'ACTIVE';

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((it) => {
            if (publishedFilter === 'published' && !it.tgMessageId) return false;
            if (publishedFilter === 'unpublished' && it.tgMessageId) return false;
            if (!q) return true;
            const name = `${it.product.name ?? ''} ${it.product.brand ?? ''}`.toLowerCase();
            return name.includes(q);
        });
    }, [items, search, publishedFilter]);

    function toggleSelect(id: number, v: boolean) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (v) next.add(id);
            else next.delete(id);
            onSelectionChange?.(next.size);
            return next;
        });
    }

    const publishCount = selectedIds.size;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative max-w-xs flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Поиск по названию или бренду..."
                            className="rounded-full pl-9 text-13-regular"
                        />
                    </div>
                    <div className="hidden items-center gap-1 rounded-full bg-bg-soft p-1 sm:flex">
                        {(
                            [
                                { id: 'all', label: 'Все' },
                                { id: 'published', label: 'Опубл.' },
                                { id: 'unpublished', label: 'Не опубл.' },
                            ] as const
                        ).map((opt) => (
                            <Button
                                key={opt.id}
                                variant="ghost"
                                size="sm"
                                onClick={() => setPublishedFilter(opt.id)}
                                className={cn(
                                    'h-7 rounded-full px-3 text-12-medium',
                                    publishedFilter === opt.id
                                        ? 'bg-bg-card text-fg-primary shadow-xs hover:bg-bg-card'
                                        : 'text-fg-tertiary',
                                )}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isActive && publishCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => setPublishOpen(true)}
                        >
                            <Send className="size-3.5" />
                            <span className="sm:hidden">В TG ({publishCount})</span>
                            <span className="hidden sm:inline">Опубликовать в TG ({publishCount})</span>
                        </Button>
                    )}
                    {canAddItems && (
                        <ProductPickerDialog
                            purchaseId={purchaseId}
                            purchaseTag={typedPurchase.tag}
                            existingProductIds={new Set(items.map((i) => i.productId))}
                        />
                    )}
                </div>
            </div>

            <TooltipProvider delayDuration={150}>
                <div className="overflow-x-auto rounded-2xl border border-border bg-bg-card">
                    <Table className="min-w-[1100px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 z-10 w-[300px] bg-bg-card">
                                    Товар
                                </TableHead>
                                <TableHead className="hidden w-[120px] lg:table-cell">Фасовка</TableHead>
                                <TableHead className="w-[140px]">Цена</TableHead>
                                <TableHead className="w-[64px] text-center">TG</TableHead>
                                <TableHead className="w-[160px]">Прогресс</TableHead>
                                <TableHead className="w-[110px] text-right">Пачки</TableHead>
                                {isInSupplementPhase && (
                                    <TableHead className="w-[120px] text-right">Доступно</TableHead>
                                )}
                                <TableHead className="sticky right-0 z-10 w-[64px] bg-bg-card" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={isInSupplementPhase ? 8 : 7}
                                        className="h-24 text-center text-14-regular text-fg-tertiary"
                                    >
                                        {search ? 'Ничего не найдено' : 'Нет товаров в закупке'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((item) => {
                                    const shortName = item.product.unit?.shortName ?? '';
                                    const published = !!item.tgMessageId;
                                    const stats = getPurchaseItemOrderStats(item);
                                    const tiers = getProductPriceTiers(item.product.priceTiers);
                                    const price1 = getPurchaseItemPrice1Gr(item);
                                    const pricePack = getPackPriceRub(item.product);
                                    const pricePackDisc = getDiscountedPackPriceRub(item.product, packDiscountPercent);
                                    const strategy = getStageStrategy(
                                        typedPurchase.fulfillmentStatus as PurchaseFulfillmentStatus,
                                    );
                                    const aggregation = strategy.aggregateForPool(
                                        toOrderLinesVO((item.orderLines ?? []) as any[]),
                                    );
                                    const freeRemainder = computeRawPool({
                                        targetRemainder:
                                            item.targetRemainder != null
                                                ? Number(item.targetRemainder)
                                                : null,
                                        packSize:
                                            item.product.supplierPackageAmount != null
                                                ? Number(item.product.supplierPackageAmount)
                                                : null,
                                        aggregation,
                                    });
                                    const progress = stats.totalQuantity > 0 && stats.orderedQuantity
                                        ? Math.min(
                                              100,
                                              (stats.orderedQuantity / stats.totalQuantity) * 100,
                                          )
                                        : 0;
                                    const progressLabel =
                                        stats.totalQuantity > 0
                                            ? `${formatOrderStatValue(stats.orderedQuantity)}/${formatOrderStatValue(
                                                  stats.totalQuantity,
                                              )}`
                                            : '0';
                                    return (
                                        <TableRow
                                            key={item.id}
                                            className="group cursor-pointer hover:bg-bg-soft"
                                            onClick={() => setEditItemId(item.id)}
                                            data-published={published || undefined}
                                        >
                                            {/* Фото + Название (sticky left) */}
                                            <TableCell className="sticky left-0 z-10 bg-bg-card group-hover:bg-bg-soft">
                                                <div className="flex items-center gap-3">
                                                    <ProductPhotoPreview
                                                        photoId={item.product.photos?.[0]?.id}
                                                        alt={item.product.name}
                                                        thumbClassName="h-9 w-9 rounded-md"
                                                    />
                                                    <div className="min-w-0">
                                                        <PurchaseProductLabel
                                                            product={item.product}
                                                            primaryClassName="block truncate text-14-semibold text-fg-primary"
                                                            secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Фасовка */}
                                            <TableCell className="hidden text-12-regular text-fg-tertiary lg:table-cell">
                                                {item.product.minPackageAmount != null &&
                                                item.product.minPackageUnit
                                                    ? `${Number(item.product.minPackageAmount)} ${item.product.minPackageUnit}`
                                                    : '—'}
                                            </TableCell>

                                            {/* Цена (с tooltip) */}
                                            <TableCell className="text-right">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-14-semibold tabular-nums text-fg-primary hover:text-primary"
                                                        >
                                                            {formatRubPrice(price1)}
                                                            <span className="ml-1 text-12-regular text-fg-tertiary">
                                                                /{shortName || 'ед'}
                                                            </span>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-left">
                                                        <div className="space-y-1">
                                                            <div>
                                                                <span className="text-fg-tertiary">5/10 гр: </span>
                                                                {formatPrice510Cell(tiers)}
                                                            </div>
                                                            <div>
                                                                <span className="text-fg-tertiary">Пачка: </span>
                                                                {formatRubPrice(pricePack)}
                                                            </div>
                                                            <div>
                                                                <span className="text-fg-tertiary">
                                                                    Со скидкой{' '}
                                                                    {packDiscountPercent}%:{' '}
                                                                </span>
                                                                {formatRubPrice(pricePackDisc)}
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>

                                            {/* TG-чекбокс */}
                                            <TableCell
                                                className="text-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {published ? (
                                                    <Checkbox checked disabled aria-label="Опубликовано в Telegram" />
                                                ) : (
                                                    <Checkbox
                                                        checked={selectedIds.has(item.id)}
                                                        disabled={typedPurchase.status === 'DONE'}
                                                        aria-label="Выбрать для публикации в Telegram"
                                                        onCheckedChange={(v) => {
                                                            if (typeof v === 'boolean') toggleSelect(item.id, v);
                                                        }}
                                                    />
                                                )}
                                            </TableCell>

                                            {/* Прогресс */}
                                            <TableCell>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="cursor-help"
                                                        >
                                                            <MiniProgress
                                                                value={progress}
                                                                label={progressLabel}
                                                                tone={
                                                                    progress >= 100
                                                                        ? 'success'
                                                                        : progress > 0
                                                                          ? 'primary'
                                                                          : 'primary'
                                                                }
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">
                                                        <div className="space-y-0.5">
                                                            <div>
                                                                Заказано:{' '}
                                                                <span className="font-semibold">
                                                                    {formatOrderStatValue(stats.orderedQuantity)}{' '}
                                                                    {shortName}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                Набрано:{' '}
                                                                <span className="font-semibold">
                                                                    {formatOrderStatValue(stats.totalQuantity)}{' '}
                                                                    {shortName}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                Пачек:{' '}
                                                                <span className="font-semibold">
                                                                    {formatOrderStatValue(stats.orderedPacks)}/
                                                                    {formatOrderStatValue(stats.packsToOrder || 1)}
                                                                </span>
                                                            </div>
                                                            {freeRemainder != null && (
                                                                <div>
                                                                    Свободно:{' '}
                                                                    <span className="font-semibold">
                                                                        {formatOrderStatValue(freeRemainder)}{' '}
                                                                        {shortName}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>

                                            {/* Пачки */}
                                            <TableCell className="text-right text-13-medium tabular-nums text-fg-secondary">
                                                {formatOrderStatValue(stats.orderedPacks)}/
                                                {formatOrderStatValue(stats.packsToOrder || 1)}
                                            </TableCell>

                                            {/* Доступно (только в REORDER) */}
                                            {isInSupplementPhase && (
                                                <TableCell className="text-right">
                                                    {item.targetRemainder !== null &&
                                                    item.targetRemainder !== undefined ? (
                                                        <Badge
                                                            variant={
                                                                Number(item.targetRemainder) > 0
                                                                    ? 'warning'
                                                                    : 'critical'
                                                            }
                                                            size="sm"
                                                        >
                                                            {Number(item.targetRemainder)} {shortName}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-13-medium text-fg-tertiary">∞</span>
                                                    )}
                                                </TableCell>
                                            )}

                                            {/* Действия (sticky right) */}
                                            <TableCell
                                                className="sticky right-0 z-10 bg-bg-card group-hover:bg-bg-soft"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label="Действия"
                                                            className="size-8 rounded-full text-fg-secondary opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100"
                                                        >
                                                            <MoreHorizontal className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-48">
                                                        <DropdownMenuItem onClick={() => setEditItemId(item.id)}>
                                                            Редактировать
                                                        </DropdownMenuItem>
                                                        {!published && typedPurchase.status === 'ACTIVE' && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setSelectedIds((prev) => {
                                                                        const next = new Set(prev);
                                                                        next.add(item.id);
                                                                        onSelectionChange?.(next.size);
                                                                        return next;
                                                                    });
                                                                    setPublishOpen(true);
                                                                }}
                                                            >
                                                                <Send className="size-3.5" /> Опубликовать в TG
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                setDeleteTarget({
                                                                    id: item.id,
                                                                    product: item.product,
                                                                    orderCount: item.orderLines.length,
                                                                    published,
                                                                })
                                                            }
                                                            className="text-error focus:text-error"
                                                        >
                                                            <Trash2 className="size-3.5" /> Удалить
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </TooltipProvider>

            <ItemEditSheet
                purchaseItemId={editItemId}
                open={editItemId !== null}
                onClose={() => setEditItemId(null)}
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
                    removeItem.mutate(
                        { purchaseItemId: deleteTarget.id },
                        { onSuccess: () => setDeleteTarget(null) },
                    );
                }}
            />

            <PublishToTgDialog
                open={publishOpen}
                onOpenChange={(open) => {
                    setPublishOpen(open);
                    if (!open) setSelectedIds(new Set());
                }}
                publishCount={publishCount}
                isPending={publishAll.isPending}
                onPublish={() => {
                    publishAll.mutate(
                        { purchaseId, purchaseItemIds: [...selectedIds] },
                        {
                            onSuccess: () => {
                                setPublishOpen(false);
                                setSelectedIds(new Set());
                            },
                        },
                    );
                }}
            />
        </div>
    );
}
