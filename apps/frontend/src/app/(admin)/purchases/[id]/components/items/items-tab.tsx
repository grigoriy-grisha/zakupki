'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Send } from 'lucide-react';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { cn } from '@/lib/utils';

import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import {
    getDiscountedPackPriceRub,
    getPackPriceRub,
    getPurchaseItemPrice1Gr,
} from '../../lib/purchase-item-prices';
import { computeFreeRemainder, isOnRemainder } from '../../lib/supplement-items';
import { usePurchaseActions, useRemovePurchaseItem } from '../../hooks';
import { usePurchaseDetail } from '../../hooks/use-purchase-detail';
import type { PurchaseDetail } from '../../lib/types';
import type { ProductLabelSource } from '../../../../products/lib';
import { ItemEditSheet } from './item-edit-sheet';
import { ItemsTableRow, type ItemsTableRowDerived } from './items-table-row';
import { ProductPickerDialog } from './product-picker-dialog';
import { PublishToTgDialog } from '../publish-to-tg-dialog';

interface ItemsTabProps {
    purchaseId: number;
    /** Колбэк для прокидывания выбранных TG id в PurchaseStepCard (для счётчика bulk-publish). */
    onSelectionChange?: (count: number) => void;
}

export function ItemsTab({ purchaseId, onSelectionChange }: ItemsTabProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId);
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();
    const removeItem = useRemovePurchaseItem(purchaseId);
    const { publishAll } = usePurchaseActions(purchaseId);

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

    if (isLoading || !purchase) {
        return <div className="h-64 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    const typedPurchase = purchase as PurchaseDetail;
    const items = typedPurchase.items;
    const isInSupplementPhase = typedPurchase.fulfillmentStatus === 'REORDER';
    const showRemainder = isInSupplementPhase || items.some(isOnRemainder);
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
            return next;
        });
    }

    // Сообщаем родителю (PurchaseDetailPage) кол-во выбранных для публикации.
    // Именно в effect'е, а не внутри updater'а setSelectedIds: React вычисляет
    // новое состояние во время рендера ItemsTab, и апдейт родителя оттуда роняет
    // "Cannot update a component while rendering a different component".
    useEffect(() => {
        onSelectionChange?.(selectedIds.size);
    }, [selectedIds, onSelectionChange]);

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
                        />
                    )}
                </div>
            </div>

            <TooltipProvider delayDuration={150}>
                <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
                    <Table className="min-w-[960px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 z-10 w-[300px] bg-bg-card">
                                    Товар
                                </TableHead>
                                <TableHead className="hidden w-[120px] lg:table-cell">Фасовка</TableHead>
                                <TableHead className="w-[140px]">Цена</TableHead>
                                <TableHead className="w-[64px] text-center">TG</TableHead>
                                {showRemainder && (
                                    <TableHead className="w-[120px] text-right">Остаток</TableHead>
                                )}
                                <TableHead className="sticky right-0 z-10 w-[64px] bg-bg-card" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={showRemainder ? 6 : 5}
                                        className="h-24 text-center text-14-regular text-fg-tertiary"
                                    >
                                        {search ? 'Ничего не найдено' : 'Нет товаров в закупке'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((item) => {
                                    const published = !!item.tgMessageId;
                                    const derived: ItemsTableRowDerived = {
                                        shortName: item.product.unit?.shortName ?? '',
                                        published,
                                        price1: getPurchaseItemPrice1Gr(item),
                                        pricePack: getPackPriceRub(item),
                                        pricePackDisc: getDiscountedPackPriceRub(item, packDiscountPercent),
                                        freeRemainder: typedPurchase.fulfillmentStatus
                                            ? computeFreeRemainder(
                                                  item,
                                                  typedPurchase.fulfillmentStatus as PurchaseFulfillmentStatus,
                                              )
                                            : null,
                                        isDone: typedPurchase.status === 'DONE',
                                        isActive: typedPurchase.status === 'ACTIVE',
                                        showRemainder,
                                    };
                                    return (
                                        <ItemsTableRow
                                            key={item.id}
                                            item={item}
                                            derived={derived}
                                            packDiscountPercent={packDiscountPercent}
                                            selected={selectedIds.has(item.id)}
                                            onToggleSelect={toggleSelect}
                                            onEdit={setEditItemId}
                                            onPublish={(id) => {
                                                setSelectedIds((prev) => {
                                                    const next = new Set(prev);
                                                    next.add(id);
                                                    return next;
                                                });
                                                setPublishOpen(true);
                                            }}
                                            onDelete={setDeleteTarget}
                                        />
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
