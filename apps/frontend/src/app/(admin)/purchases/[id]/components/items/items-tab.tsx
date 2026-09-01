'use client';

import { canAddItemsAtStage } from '@zakupki/types';
import { ClipboardList, SearchX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody } from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import type { ProductLabelSource } from '@/lib/product-label';

import { useDeleteItemPost, useInlineUpdateItem, usePurchaseActions, useRemovePurchaseItem } from '../../hooks';
import { usePurchaseDetail } from '../../hooks/use-purchase-detail';
import type { PurchaseDetail } from '../../lib/types';
import { PublishToTgDialog } from '../publish-to-tg-dialog';
import { CurrencyRatesPanel } from './currency-rates-panel';
import { deriveRow } from './derive-row';
import { ItemEditSheet } from './item-edit-sheet';
import { ItemsTableHeader } from './items-table-header';
import { ItemsTableRow } from './items-table-row';
import { ItemsToolbar, type PublishedFilter } from './items-toolbar';
import { RegeneratePostDialog } from './regenerate-post-dialog';

interface ItemsTabProps {
    purchaseId: number;
    onSelectionChange?: (count: number) => void;
}

export function ItemsTab({ purchaseId, onSelectionChange }: ItemsTabProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId);
    const { orgFeeDefaultPercent } = usePricingSettings();
    const removeItem = useRemovePurchaseItem(purchaseId);
    const { publishAll } = usePurchaseActions(purchaseId);
    const inlineUpdate = useInlineUpdateItem(purchaseId);
    const deletePost = useDeleteItemPost(purchaseId);

    const [search, setSearch] = useState('');
    const [publishedFilter, setPublishedFilter] = useState<PublishedFilter>('all');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [editItemId, setEditItemId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: number;
        product: ProductLabelSource;
        orderCount: number;
        published: boolean;
    } | null>(null);
    const [publishOpen, setPublishOpen] = useState(false);
    const [regenerateTarget, setRegenerateTarget] = useState<{ itemId: number; productId: number } | null>(null);

    useEffect(() => {
        onSelectionChange?.(selectedIds.size);
    }, [selectedIds, onSelectionChange]);

    const typedPurchase = purchase as PurchaseDetail | undefined;
    const items = useMemo(() => typedPurchase?.items ?? [], [typedPurchase]);
    const currencyRates = typedPurchase?.currencyRates ?? [];
    const canAddItems =
        typedPurchase != null && typedPurchase.status !== 'DONE' && canAddItemsAtStage(typedPurchase.fulfillmentStatus);
    const isActive = typedPurchase?.status === 'ACTIVE';
    const isDone = typedPurchase?.status === 'DONE';

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((it) => {
            if (publishedFilter === 'published' && !it.tgMessageId) return false;
            if (publishedFilter === 'unpublished' && it.tgMessageId) return false;
            if (!q) return true;
            const name = `${it.product.name ?? ''} ${it.product.brand ?? ''} ${it.adminComment ?? ''}`.toLowerCase();
            return name.includes(q);
        });
    }, [items, search, publishedFilter]);

    const selectableIds = useMemo(
        () => filtered.filter((it) => !it.tgMessageId && !it.hidden && !isDone).map((it) => it.id),
        [filtered, isDone],
    );
    const selectedSelectableCount = useMemo(
        () => selectableIds.reduce((acc, id) => acc + (selectedIds.has(id) ? 1 : 0), 0),
        [selectableIds, selectedIds],
    );
    const allSelected = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;
    const someSelected = selectedSelectableCount > 0 && !allSelected;

    if (isLoading || !purchase) {
        return <div className="h-64 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    const detail = purchase as PurchaseDetail;

    function toggleSelect(id: number, v: boolean) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (v) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    function toggleAll(v: boolean) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (v) {
                selectableIds.forEach((id) => next.add(id));
            } else {
                selectableIds.forEach((id) => next.delete(id));
            }
            return next;
        });
    }

    function handleInlineCommit(purchaseItemId: number, patch: Record<string, unknown>) {
        inlineUpdate.mutate({ purchaseItemId, product: patch });
    }

    const publishCount = selectedIds.size;

    return (
        <div className="space-y-3">
            <CurrencyRatesPanel purchaseId={purchaseId} rates={currencyRates} />

            <ItemsToolbar
                search={search}
                onSearchChange={setSearch}
                publishedFilter={publishedFilter}
                onPublishedFilterChange={setPublishedFilter}
                showPublishButton={isActive && publishCount > 0}
                publishCount={publishCount}
                onPublishClick={() => setPublishOpen(true)}
                canAddItems={canAddItems}
                purchaseId={purchaseId}
                purchaseTag={detail.tag}
                currencyRates={currencyRates}
            />

            <TooltipProvider delayDuration={150}>
                {filtered.length === 0 ? (
                    <div className="rounded-2xl bg-bg-soft">
                        <EmptyState
                            icon={search.trim() ? SearchX : ClipboardList}
                            title={search.trim() ? 'Ничего не найдено' : 'Нет товаров в закупке'}
                            description={
                                search.trim()
                                    ? 'Попробуйте изменить запрос — поиск идёт по названию, бренду и комментарию.'
                                    : 'Добавьте товары, чтобы они появились здесь.'
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl bg-bg-soft">
                        <Table className="table-fixed min-w-[2200px]">
                            <ItemsTableHeader
                                selectableCount={selectableIds.length}
                                allSelected={allSelected}
                                someSelected={someSelected}
                                onToggleAll={toggleAll}
                            />
                            <TableBody>
                                {filtered.map((item) => (
                                    <ItemsTableRow
                                        key={item.id}
                                        item={item}
                                        derived={deriveRow(
                                            item,
                                            currencyRates,
                                            orgFeeDefaultPercent,
                                            detail.fulfillmentStatus,
                                            detail.status,
                                            isActive,
                                        )}
                                        currencyRates={currencyRates}
                                        selected={selectedIds.has(item.id)}
                                        searchQuery={search}
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
                                        onCommit={(patch) => handleInlineCommit(item.id, patch)}
                                        onDeletePost={(itemId) => deletePost.mutate({ purchaseItemId: itemId })}
                                        onRegenerate={(target) =>
                                            setRegenerateTarget({
                                                itemId: target.itemId,
                                                productId: item.productId,
                                            })
                                        }
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
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
                    removeItem.mutate({ purchaseItemId: deleteTarget.id }, { onSuccess: () => setDeleteTarget(null) });
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

            <RegeneratePostDialog
                purchaseId={purchaseId}
                purchaseItemId={regenerateTarget?.itemId ?? null}
                productId={regenerateTarget?.productId ?? 0}
                open={regenerateTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRegenerateTarget(null);
                }}
            />
        </div>
    );
}
