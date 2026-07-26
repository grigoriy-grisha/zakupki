'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Send } from 'lucide-react';
import { getUnitByCode, resolveOrgFeePercent } from '@zakupki/types';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    getCollectedQty,
    getPackPriceRub,
    getPackPriceWithOrgFeeRub,
    getRemainderQty,
    getUnitPriceRub,
} from '../../lib/items-table-pricing';
import {
    useInlineUpdateItem,
    usePurchaseActions,
    useRemovePurchaseItem,
} from '../../hooks';
import { usePurchaseDetail } from '../../hooks/use-purchase-detail';
import type { PurchaseDetail } from '../../lib/types';
import type { ProductLabelSource } from '../../../../products/lib';
import { CurrencyRatesPanel } from './currency-rates-panel';
import { ItemEditSheet } from './item-edit-sheet';
import { ItemsTableRow, type ItemsTableRowDerived } from './items-table-row';
import { ProductPickerDialog } from './product-picker-dialog';
import { RegeneratePostDialog } from './regenerate-post-dialog';
import { PublishToTgDialog } from '../publish-to-tg-dialog';

interface ItemsTabProps {
    purchaseId: number;
    /** Колбэк для прокидывания выбранных TG id в PurchaseStepCard (для счётчика bulk-publish). */
    onSelectionChange?: (count: number) => void;
}

export function ItemsTab({ purchaseId, onSelectionChange }: ItemsTabProps) {
    const { detail: purchase, isLoading } = usePurchaseDetail(purchaseId);
    const { orgFeeDefaultPercent } = usePricingSettings();
    const removeItem = useRemovePurchaseItem(purchaseId);
    const { publishAll } = usePurchaseActions(purchaseId);
    const inlineUpdate = useInlineUpdateItem(purchaseId);

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
    const [regenerateTarget, setRegenerateTarget] = useState<number | null>(null);

    if (isLoading || !purchase) {
        return <div className="h-64 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    const typedPurchase = purchase as PurchaseDetail;
    const items = typedPurchase.items;
    const currencyRates = typedPurchase.currencyRates ?? [];
    const canAddItems = typedPurchase.status !== 'DONE';
    const isActive = typedPurchase.status === 'ACTIVE';
    const isDone = typedPurchase.status === 'DONE';

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

    // Selectable-строки в текущей выборке: не опубликованы, не скрыты и закупка не
    // завершена (совпадает с условием disabled чекбокса в ItemsTableRow).
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

    // Сообщаем родителю (PurchaseDetailPage) кол-во выбранных для публикации.
    useEffect(() => {
        onSelectionChange?.(selectedIds.size);
    }, [selectedIds, onSelectionChange]);

    const publishCount = selectedIds.size;

    /** Тихий inline-коммит полей позиции (без toast на успех). */
    function handleInlineCommit(purchaseItemId: number, patch: Record<string, unknown>) {
        inlineUpdate.mutate({ purchaseItemId, product: patch });
    }

    return (
        <div className="space-y-3">
            <CurrencyRatesPanel purchaseId={purchaseId} rates={currencyRates} />

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
                            currencyRates={currencyRates}
                        />
                    )}
                </div>
            </div>

            <TooltipProvider delayDuration={150}>
                <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
                    <Table className="table-fixed min-w-[2200px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 z-10 w-[200px] bg-bg-card">
                                    Товар
                                </TableHead>
                                <TableHead className="w-[140px] px-3 text-right">Вес упаковки</TableHead>
                                <TableHead className="w-[160px] px-3 text-right">Цена за упаковку</TableHead>
                                <TableHead className="w-[150px] px-3 text-right">Цена за упаковку ₽</TableHead>
                                <TableHead className="w-[170px] px-3 text-right">Цена за упаковку + орг</TableHead>
                                <TableHead className="w-[150px] px-3 text-right">Цена за 1 единицу ₽</TableHead>
                                <TableHead className="w-[130px] px-3 text-right">Собрано</TableHead>
                                <TableHead className="w-[120px] px-3 text-right">Заказано</TableHead>
                                <TableHead className="w-[140px] px-3 text-right">Скомплектовано</TableHead>
                                <TableHead className="w-[130px] px-3 text-right">Дозаказано</TableHead>
                                <TableHead className="w-[120px] px-3 text-right">Остаток</TableHead>
                                <TableHead className="w-[120px] px-3">Комментарий</TableHead>
                                <TableHead className="w-[72px] px-2 text-center">
                                    {selectableIds.length > 0 ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <Checkbox
                                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                                aria-label="Выбрать все для публикации в Telegram"
                                                onCheckedChange={(v) => toggleAll(v === true)}
                                            />
                                            <span className="text-11-medium text-fg-tertiary">TG</span>
                                        </div>
                                    ) : (
                                        'TG'
                                    )}
                                </TableHead>
                                <TableHead className="sticky right-0 z-10 w-[56px] bg-bg-card" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={14}
                                        className="h-24 text-center text-14-regular text-fg-tertiary"
                                    >
                                        {search ? 'Ничего не найдено' : 'Нет товаров в закупке'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((item) => {
                                    // Скрытый товар = «не опубликован» в UI, даже если tgMessageId
                                    // ещё не обнулён воркером (он обнулит его через ~7с в ITEM_CHANGED).
                                    // Иначе после «Скрыть» чекбокс зависает в состоянии «Опубликовано».
                                    const published = !!item.tgMessageId && !item.hidden;
                                    const orgFeePercent = resolveOrgFeePercent(
                                        item.orgFeePercentOverride != null
                                            ? Number(item.orgFeePercentOverride)
                                            : null,
                                        orgFeeDefaultPercent,
                                    );
                                    const derived: ItemsTableRowDerived = {
                                        shortName: getUnitByCode(item.product.unitCode)?.shortName ?? '',
                                        published,
                                        packPriceRub: getPackPriceRub(item, currencyRates),
                                        packPriceWithOrgFeeRub: getPackPriceWithOrgFeeRub(
                                            item,
                                            currencyRates,
                                            orgFeeDefaultPercent,
                                        ),
                                        unitPriceRub: getUnitPriceRub(
                                            item,
                                            currencyRates,
                                            orgFeeDefaultPercent,
                                        ),
                                        collectedQty: getCollectedQty(item),
                                        remainderQty: getRemainderQty(
                                            item,
                                            typedPurchase.fulfillmentStatus,
                                        ),
                                        orgFeePercent,
                                        isDone: typedPurchase.status === 'DONE',
                                        isActive,
                                    };
                                        return (
                                            <ItemsTableRow
                                                key={item.id}
                                                item={item}
                                                derived={derived}
                                                currencyRates={currencyRates}
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
                                            onCommit={(patch) => handleInlineCommit(item.id, patch)}
                                            onRegenerate={(target) => setRegenerateTarget(target.itemId)}
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

            <RegeneratePostDialog
                purchaseId={purchaseId}
                purchaseItemId={regenerateTarget}
                open={regenerateTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setRegenerateTarget(null);
                }}
            />
        </div>
    );
}
