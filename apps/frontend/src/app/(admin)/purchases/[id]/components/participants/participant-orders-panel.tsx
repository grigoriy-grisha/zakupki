'use client';

import { buildOrderQtyOptions, getOrderQuantityStep } from '@zakupki/types';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { safeNumber } from '@/lib/utils';

import { AddPositionDialog, AdminOrderLineEditor } from './admin-order-controls';
import { mergeParticipantOrders } from './merge-participant-orders';
import { QuantityDisplay } from './quantity-display';
import type { PurchaseItemOption } from './admin-order-controls';
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
    adminAdjustIsPending: boolean;
}

interface ParticipantOrdersPanelProps {
    userId: number;
    purchaseOrderId?: number | null;
    orders: ParticipantOrder[];
    purchaseItems: PurchaseItemOption[];
    due: number;
    orderActions: ParticipantOrdersActions;
    onSetDeleteLineTarget: (target: { purchaseItemId: number; name: string } | null) => void;
}

export function ParticipantOrdersPanel({
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
        <div className="rounded-2xl border border-border bg-bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2">
                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">
                    {purchaseOrderId != null
                        ? `Заказ №${purchaseOrderId} · ${merged.length} поз.`
                        : `Позиции · ${merged.length}`}
                </span>
                <AddPositionDialog
                    purchaseItems={purchaseItems}
                    pending={orderActions.adminAdjustIsPending}
                    onAdd={(purchaseItemId, qty) =>
                        orderActions.adminAdjust({ purchaseItemId, userId, delta: qty })
                    }
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
                                sourceItem?.minPackageAmount != null
                                    ? Number(sourceItem.minPackageAmount)
                                    : null,
                            minPackageUnit: null,
                            unitCode: product?.unitCode ?? null,
                        }),
                    );
                    return (
                        <div key={group.purchaseItemId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                            {product && (
                                <ProductPhotoPreview
                                    photoId={product.photos?.[0]?.id}
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
                                    unitCode={product?.unitCode ?? null}
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
                                onAdjustPackage={(purchaseItemId, delta) =>
                                    orderActions.adminAdjustPackage({ purchaseItemId, userId, delta })
                                }
                            />
                            <div className="w-[90px] text-right text-13-semibold tabular-nums text-fg-primary">
                                {safeNumber(group.amountDue).toLocaleString('ru-RU')} ₽
                            </div>
                        </div>
                    );
                })}
                <div className="flex items-center justify-between bg-bg-soft px-3 py-2">
                    <span className="text-12-semibold uppercase tracking-wide text-fg-tertiary">
                        Итого
                    </span>
                    <span className="text-14-semibold tabular-nums text-fg-primary">
                        {due.toLocaleString('ru-RU')} ₽
                    </span>
                </div>
            </div>
        </div>
    );
}
