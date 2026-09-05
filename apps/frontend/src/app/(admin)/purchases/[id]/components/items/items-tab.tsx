'use client';

import { canAddItemsAtStage } from '@zakupki/types';
import { ClipboardList, SearchX } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ListPagination } from '@/components/shared/list-pagination';
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
import { ItemsTableRow, type ItemsTableRowDerived } from './items-table-row';
import { ItemsToolbar, type PublishedFilter } from './items-toolbar';
import { RegeneratePostDialog } from './regenerate-post-dialog';

interface ItemsTabProps {
    purchaseId: number;
    onSelectionChange?: (count: number) => void;
}

const ITEMS_PAGE_SIZE = 50;

export function ItemsTab({ purchaseId, onSelectionChange }: ItemsTabProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId);
    const { orgFeeDefaultPercent } = usePricingSettings();
    const removeItem = useRemovePurchaseItem(purchaseId);
    const { publishAll } = usePurchaseActions(purchaseId);
    const inlineUpdate = useInlineUpdateItem(purchaseId);
    const deletePost = useDeleteItemPost(purchaseId);

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
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
    const deferredSearch = useDeferredValue(search);
    const deliveryPercent = Number(typedPurchase?.deliveryPercent ?? 0);

    const filtered = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        return items.filter((it) => {
            if (publishedFilter === 'published' && !it.tgMessageId) return false;
            if (publishedFilter === 'unpublished' && it.tgMessageId) return false;
            if (!q) return true;
            const name =
                `${it.product.name ?? ''} ${it.product.brand ?? ''} ${it.product.articleNumber ?? ''} ${it.adminComment ?? ''}`.toLowerCase();
            return name.includes(q);
        });
    }, [items, deferredSearch, publishedFilter]);

    const { derivedById, productIdById } = useMemo(() => {
        const derivedMap = new Map<number, ItemsTableRowDerived>();
        const productIdMap = new Map<number, number>();
        for (const it of items) {
            derivedMap.set(
                it.id,
                deriveRow(
                    it,
                    currencyRates,
                    orgFeeDefaultPercent,
                    deliveryPercent,
                    typedPurchase?.fulfillmentStatus ?? 'COLLECTION',
                    typedPurchase?.status ?? 'DRAFT',
                    isActive,
                ),
            );
            productIdMap.set(it.id, it.productId);
        }
        return { derivedById: derivedMap, productIdById: productIdMap };
    }, [items, currencyRates, orgFeeDefaultPercent, deliveryPercent, typedPurchase, isActive]);

    const rows = useMemo(
        () =>
            filtered.map((item) => ({
                item,
                derived:
                    derivedById.get(item.id) ??
                    deriveRow(
                        item,
                        currencyRates,
                        orgFeeDefaultPercent,
                        deliveryPercent,
                        typedPurchase?.fulfillmentStatus ?? 'COLLECTION',
                        typedPurchase?.status ?? 'DRAFT',
                        isActive,
                    ),
            })),
        [filtered, derivedById, currencyRates, orgFeeDefaultPercent, deliveryPercent, typedPurchase, isActive],
    );

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

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedRows = useMemo(
        () => rows.slice((currentPage - 1) * ITEMS_PAGE_SIZE, currentPage * ITEMS_PAGE_SIZE),
        [rows, currentPage],
    );

    useEffect(() => {
        setPage(1);
    }, [deferredSearch, publishedFilter]);

    const toggleSelect = useCallback((id: number, v: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (v) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(
        (v: boolean) => {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (v) {
                    selectableIds.forEach((id) => next.add(id));
                } else {
                    selectableIds.forEach((id) => next.delete(id));
                }
                return next;
            });
        },
        [selectableIds],
    );

    const { mutate: inlineUpdateMutate } = inlineUpdate;
    const handleInlineCommit = useCallback(
        (purchaseItemId: number, patch: Record<string, unknown>) => {
            inlineUpdateMutate({ purchaseItemId, product: patch });
        },
        [inlineUpdateMutate],
    );

    const { mutate: deletePostMutate } = deletePost;
    const handleDeletePost = useCallback(
        (itemId: number) => deletePostMutate({ purchaseItemId: itemId }),
        [deletePostMutate],
    );

    const handlePublishRow = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setPublishOpen(true);
    }, []);

    const handleRegenerate = useCallback(
        (target: { itemId: number }) => {
            setRegenerateTarget({ itemId: target.itemId, productId: productIdById.get(target.itemId) ?? 0 });
        },
        [productIdById],
    );

    if (isLoading || !purchase) {
        return <div className="h-64 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    const detail = purchase as PurchaseDetail;

    const publishCount = selectedIds.size;

    return (
        <div className="space-y-3">
            <CurrencyRatesPanel purchaseId={purchaseId} rates={currencyRates} deliveryPercent={Number(detail.deliveryPercent ?? 0)} />

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
                            icon={deferredSearch.trim() ? SearchX : ClipboardList}
                            title={deferredSearch.trim() ? 'Ничего не найдено' : 'Нет товаров в закупке'}
                            description={
                                deferredSearch.trim()
                                    ? 'Попробуйте изменить запрос — поиск идёт по артикулу, названию, бренду и комментарию.'
                                    : 'Добавьте товары, чтобы они появились здесь.'
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl bg-bg-soft">
                        <Table className="table-fixed min-w-[2360px]">
                            <ItemsTableHeader
                                selectableCount={selectableIds.length}
                                allSelected={allSelected}
                                someSelected={someSelected}
                                onToggleAll={toggleAll}
                            />
                            <TableBody>
                                {pagedRows.map(({ item, derived }) => (
                                    <ItemsTableRow
                                        key={item.id}
                                        item={item}
                                        derived={derived}
                                        currencyRates={currencyRates}
                                        selected={selectedIds.has(item.id)}
                                        searchQuery={deferredSearch}
                                        onToggleSelect={toggleSelect}
                                        onEdit={setEditItemId}
                                        onPublish={handlePublishRow}
                                        onDelete={setDeleteTarget}
                                        onCommitItem={handleInlineCommit}
                                        onDeletePost={handleDeletePost}
                                        onRegenerate={handleRegenerate}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </TooltipProvider>

            <ListPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                label="Страницы товаров"
            />

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
