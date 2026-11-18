'use client';

import { buildOrderQtyOptions, getOrderQuantityStep } from '@zakupki/types';
import { Undo2 } from 'lucide-react';

import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import { safeNumber } from '@/lib/utils';

import type { PurchaseItemOption } from './admin-order-controls';
import { AddPositionDialog, AdminOrderLineEditor } from './admin-order-controls';
import { mergeParticipantOrders } from './merge-participant-orders';
import { QuantityDisplay } from './quantity-display';
import type { ParticipantOrder } from './types';

export interface ParticipantOrdersActions {
    adminAdjust: (input: { purchaseItemId: number; delta: number; userId: number }) => void;
    adminSetQuantity: (input: { purchaseItemId: number; qty: number; userId: number }) => void;
    /** ± на кол-во упаковок (admin-override, в обход stage-правил). */
    adminAdjustPackage: (input: { purchaseItemId: number; delta: number; userId: number }) => void;
    /** Удалить ВСЕ строки участника на товар (сбор + добор + упаковки). */
    deleteAllByUserItem: {
        mutate: (input: { purchaseItemId: number; userId: number }) => void;
        isPending: boolean;
    };
    /** Вернуть удалённый товар с прежним количеством. */
    restoreUserItem: {
        mutate: (input: { purchaseItemId: number; userId: number }) => void;
        isPending: boolean;
    };
    adminAdjustIsPending: boolean;
}

interface ParticipantOrdersPanelProps {
    purchaseId: number;
    userId: number;
    purchaseOrderId?: number | null;
    orders: ParticipantOrder[];
    purchaseItems: PurchaseItemOption[];
    due: number;
    orderActions: ParticipantOrdersActions;
    onSetDeleteLineTarget: (target: { purchaseItemId: number; name: string } | null) => void;
}

export function ParticipantOrdersPanel({
    purchaseId,
    userId,
    purchaseOrderId,
    orders,
    purchaseItems,
    due,
    orderActions,
    onSetDeleteLineTarget,
}: ParticipantOrdersPanelProps) {
    // Объединяем COLLECTION + supplement строки одного товара в одну позицию
    // через доменную mergeLines (единую логику с ботом и магазином).
    const merged = mergeParticipantOrders(orders);

    return (
        <div className="overflow-hidden rounded-2xl bg-bg-soft">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2">
                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">
                    {purchaseOrderId != null
                        ? `Заказ №${purchaseOrderId} · ${merged.length} поз.`
                        : `Позиции · ${merged.length}`}
                </span>
                <AddPositionDialog
                    purchaseItems={purchaseItems}
                    pending={orderActions.adminAdjustIsPending}
                    onAdd={(purchaseItemId, qty) => orderActions.adminAdjust({ purchaseItemId, userId, delta: qty })}
                />
            </div>
            <div className="divide-y divide-border-soft">
                {merged.map((group) => {
                    const qty = group.quantity;
                    const fallbackItem = purchaseItems.find((it) => it.id === group.purchaseItemId);
                    const sourceItem = group.source.purchaseItem ?? fallbackItem;
                    const product = sourceItem?.product;
                    const step = getOrderQuantityStep(
                        buildOrderQtyOptions({
                            multiplicity: Number(product?.multiplicity) || 1,
                            minPackageAmount:
                                sourceItem?.minPackageAmount != null ? Number(sourceItem.minPackageAmount) : null,
                            minPackageUnit: null,
                            unitCode: sourceItem?.unitCode ?? product?.unitCode ?? null,
                        }),
                    );
                    return (
                        <div key={group.purchaseItemId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                            {product && (
                                <ProductPhotoPreview
                                    photoId={product.photos?.[0]?.id}
                                    photoIds={product.photos?.map((p) => p.id)}
                                    alt={product.name}
                                    thumbClassName="h-11 w-11 rounded-md"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                {product ? (
                                    <PurchaseProductLabel
                                        product={product}
                                        primaryClassName="block truncate text-13-medium text-fg-primary"
                                        secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                                    />
                                ) : (
                                    <span className="text-13-medium text-fg-primary">
                                        Товар #{group.purchaseItemId}
                                    </span>
                                )}
                                {sourceItem?.supplier && (
                                    <p
                                        className="mt-0.5 block truncate text-12-regular text-fg-tertiary"
                                        title={sourceItem.supplier.name}
                                    >
                                        {sourceItem.supplier.name}
                                    </p>
                                )}
                                <QuantityDisplay
                                    className="mt-0.5"
                                    totalQty={qty}
                                    packageCount={group.packageCount}
                                    packAmount={sourceItem?.packAmount ?? null}
                                    unitCode={sourceItem?.unitCode ?? product?.unitCode ?? null}
                                />
                            </div>
                            <AdminOrderLineEditor
                                purchaseItemId={group.purchaseItemId}
                                productName={product?.name ?? `Товар #${group.purchaseItemId}`}
                                quantity={qty}
                                step={step}
                                pending={orderActions.adminAdjustIsPending}
                                onAdjust={(purchaseItemId, delta) =>
                                    orderActions.adminAdjust({ purchaseItemId, userId, delta })
                                }
                                onSetQuantity={(purchaseItemId, setQty) =>
                                    orderActions.adminSetQuantity({
                                        purchaseItemId,
                                        userId,
                                        qty: setQty,
                                    })
                                }
                                onDelete={(purchaseItemId, productName) =>
                                    onSetDeleteLineTarget({ purchaseItemId, name: productName })
                                }
                                packageCount={group.packageCount}
                                packAmount={sourceItem?.packAmount ?? null}
                                unitCode={sourceItem?.unitCode ?? product?.unitCode ?? null}
                                onAdjustPackage={(purchaseItemId, delta) =>
                                    orderActions.adminAdjustPackage({ purchaseItemId, userId, delta })
                                }
                            />
                            <div className="w-[90px] text-right text-13-semibold tabular-nums text-fg-primary">
                                {formatRub(safeNumber(group.amountDue))}
                            </div>
                        </div>
                    );
                })}
                {merged.length === 0 && (
                    <div className="px-3 py-3 text-13-regular text-fg-tertiary">В заказе нет товаров</div>
                )}
                <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-12-semibold uppercase tracking-wide text-fg-tertiary">Итого</span>
                    <span className="text-14-semibold tabular-nums text-fg-primary">{formatRub(due)}</span>
                </div>
            </div>
            <RemovedPositions purchaseId={purchaseId} userId={userId} restore={orderActions.restoreUserItem} />
        </div>
    );
}

/**
 * Товары, которые админ удалил из заказа участника. В сумме не считаются,
 * показаны серым — чтобы было видно, что было, и можно было вернуть.
 */
function RemovedPositions({
    purchaseId,
    userId,
    restore,
}: {
    purchaseId: number;
    userId: number;
    restore: ParticipantOrdersActions['restoreUserItem'];
}) {
    // Один запрос на всю закупку — React Query отдаёт его из кэша каждой карточке.
    const { data } = trpc.orders.getRemovedByPurchase.useQuery({ purchaseId });
    const removed = (data ?? []).filter((line) => line.userId === userId);
    if (removed.length === 0) return null;

    // Сбор и добор одного товара — одна позиция.
    const byItem = new Map<number, { line: (typeof removed)[number]; qty: number; packages: number }>();
    for (const line of removed) {
        const prev = byItem.get(line.purchaseItemId);
        const qty = Number(line.removedQuantity ?? 0);
        const packages = line.removedPackageCount ?? 0;
        if (prev) {
            prev.qty += qty;
            prev.packages += packages;
        } else {
            byItem.set(line.purchaseItemId, { line, qty, packages });
        }
    }

    return (
        <div className="border-t border-border-soft">
            <div className="px-3 pt-2 text-12-medium uppercase tracking-wide text-fg-tertiary">
                Удалённые · {byItem.size}
            </div>
            <div className="divide-y divide-border-soft">
                {[...byItem.values()].map(({ line, qty, packages }) => {
                    const item = line.purchaseItem;
                    const product = item?.product;
                    return (
                        <div key={line.purchaseItemId} className="flex items-center gap-3 px-3 py-2">
                            <div className="min-w-0 flex-1 opacity-60">
                                {product ? (
                                    <PurchaseProductLabel
                                        product={product}
                                        primaryClassName="block truncate text-13-medium text-fg-primary line-through"
                                        secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                                    />
                                ) : (
                                    <span className="text-13-medium text-fg-primary line-through">
                                        Товар #{line.purchaseItemId}
                                    </span>
                                )}
                                <QuantityDisplay
                                    className="mt-0.5"
                                    totalQty={qty}
                                    packageCount={packages}
                                    packAmount={item?.packAmount != null ? Number(item.packAmount) : null}
                                    unitCode={item?.unitCode ?? product?.unitCode ?? null}
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={restore.isPending}
                                onClick={() => restore.mutate({ purchaseItemId: line.purchaseItemId, userId })}
                            >
                                <Undo2 className="size-4" />
                                Вернуть
                            </Button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
