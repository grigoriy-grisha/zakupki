'use client';

import { useMemo, useState } from 'react';
import { Settings2Icon } from 'lucide-react';
import { computeRawPool, getStageStrategy, toOrderLinesVO } from '@zakupki/types';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { Button } from '@/components/ui/button';
import { MiniProgress } from '@/components/ui/mini-progress';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { trpc } from '@/lib/client/trpc';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { formatOrderStatValue, getPurchaseItemOrderStats } from '../lib/purchase-item-order-stats';
import { ItemEditSheet } from './item-edit-sheet';
import type { PurchaseDetail, PurchaseItem } from '../lib/types';

interface AdminSupplementsListProps {
    purchaseId: number;
    /** Колбэк для открытия диалога остатков. */
    onOpenRemainderDialog?: () => void;
}

function isOnRemainder(item: PurchaseItem): boolean {
    const hasPack = item.product.supplierPackageAmount != null && Number(item.product.supplierPackageAmount) > 0;
    const hasManual = item.targetRemainder != null && Number(item.targetRemainder) > 0;
    return hasPack || hasManual;
}

export function AdminSupplementsList({ purchaseId, onOpenRemainderDialog }: AdminSupplementsListProps) {
    const { data: purchase, isLoading } = trpc.purchases.getById.useQuery({ id: purchaseId });
    const [editItemId, setEditItemId] = useState<number | null>(null);

    const allItems = useMemo(
        () => ((purchase as unknown as PurchaseDetail | null)?.items ?? []),
        [purchase],
    );
    const remainderItems = useMemo(() => allItems.filter(isOnRemainder), [allItems]);
    const fulfillmentStatus = (purchase as unknown as PurchaseDetail | null)?.fulfillmentStatus as
        | PurchaseFulfillmentStatus
        | undefined;

    if (isLoading || !purchase) {
        return <div className="h-32 animate-pulse rounded-2xl bg-bg-soft" />;
    }

    return (
        <div className="space-y-3">
            <SectionHeader
                title="Доборы"
                description="Остатки для дозаказа. Остаток считается автоматически от последней пачки поставщика."
                actions={
                    remainderItems.length > 0 && onOpenRemainderDialog ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={onOpenRemainderDialog}
                        >
                            <Settings2Icon className="size-3.5" />
                            Настроить остатки
                        </Button>
                    ) : null
                }
            />

            {remainderItems.length === 0 ? (
                <div className="rounded-2xl border border-border bg-bg-card">
                    <EmptyState
                        icon={Settings2Icon}
                        title="Нет товаров с добором"
                        description="Добавьте фасовку поставщика в редактировании товара, чтобы открыть добор."
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    {remainderItems.map((item) => {
                        const shortName = item.product.unit?.shortName ?? '';
                        const stats = getPurchaseItemOrderStats(item);
                        const packSize =
                            item.product.supplierPackageAmount != null
                                ? Number(item.product.supplierPackageAmount)
                                : null;
                        const strategy = fulfillmentStatus
                            ? getStageStrategy(fulfillmentStatus)
                            : null;
                        const aggregation = strategy
                            ? strategy.aggregateForPool(toOrderLinesVO((item.orderLines ?? []) as any[]))
                            : ({ orderedQuantity: 0, orderedPacks: 0 } as any);
                        const remainderLeft = computeRawPool({
                            targetRemainder:
                                item.targetRemainder != null ? Number(item.targetRemainder) : null,
                            packSize,
                            aggregation,
                        });
                        const isManualLimit =
                            item.targetRemainder != null && Number(item.targetRemainder) > 0;
                        const progress =
                            stats.totalQuantity > 0
                                ? Math.min(100, (stats.orderedQuantity ?? 0) / (stats.totalQuantity * 1))
                                : 0;
                        return (
                            <Button
                                variant="ghost"
                                size="default"
                                key={item.id}
                                onClick={() => setEditItemId(item.id)}
                                className="group h-auto w-full justify-start gap-3 rounded-2xl border border-border bg-bg-card p-3 text-left hover:bg-bg-soft"
                            >
                                <ProductPhotoPreview
                                    photoId={item.product.photos?.[0]?.id}
                                    alt={item.product.name}
                                    thumbClassName="h-12 w-12 rounded-lg"
                                />
                                <div className="min-w-0 flex-1">
                                    <PurchaseProductLabel
                                        product={item.product}
                                        primaryClassName="block truncate text-14-semibold text-fg-primary"
                                        secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                                    />
                                </div>
                                <div className="hidden w-[100px] shrink-0 flex-col items-end sm:flex">
                                    <span className="text-12-regular text-fg-tertiary">В пачке</span>
                                    <span className="text-13-medium tabular-nums text-fg-primary">
                                        {packSize != null ? `${packSize} ${shortName}` : '—'}
                                    </span>
                                </div>
                                <div className="hidden w-[140px] shrink-0 sm:block">
                                    <span className="text-12-regular text-fg-tertiary">Прогресс</span>
                                    <div className="mt-1">
                                        <MiniProgress
                                            value={progress}
                                            size="sm"
                                            label={
                                                stats.orderedQuantity != null
                                                    ? `${formatOrderStatValue(stats.orderedQuantity)} ${shortName}`
                                                    : '—'
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="w-[110px] shrink-0 text-right">
                                    <span className="text-12-regular text-fg-tertiary">Свободно</span>
                                    {remainderLeft == null ? (
                                        <div className="text-13-medium text-fg-tertiary">—</div>
                                    ) : remainderLeft > 0 ? (
                                        <div className="text-14-semibold tabular-nums text-fg-primary">
                                            {formatOrderStatValue(remainderLeft)} {shortName}
                                            {isManualLimit && (
                                                <span className="ml-1 text-10-medium text-fg-tertiary">
                                                    вручную
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-13-medium text-fg-tertiary">разобрано</div>
                                    )}
                                </div>
                            </Button>
                        );
                    })}
                </div>
            )}

            <ItemEditSheet
                purchaseItemId={editItemId}
                open={editItemId !== null}
                onClose={() => setEditItemId(null)}
                purchaseId={purchaseId}
            />
        </div>
    );
}
