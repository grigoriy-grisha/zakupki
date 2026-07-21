'use client';

import { buildOrderQtyOptions, getOrderQuantityStep } from '@zakupki/types';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { cn, safeNumber } from '@/lib/utils';

import { AddPositionDialog, AdminOrderLineEditor } from './admin-order-controls';
import type { PaymentRef } from '../../lib/types';
import type { OrderComment } from '../../hooks/use-participants-data';
import type { PurchaseItemOption } from './admin-order-controls';
import type { ParticipantOrder } from './types';

export interface ParticipantOrdersActions {
    adminAdjust: (input: { purchaseItemId: number; delta: number; userId: number }) => void;
    adminSetQuantity: (input: { purchaseItemId: number; qty: number; userId: number }) => void;
    deleteOrderLine: { mutate: (input: { id: number }) => void; isPending: boolean };
    adminAdjustIsPending: boolean;
}

interface ParticipantOrdersPanelProps {
    userId: number;
    purchaseOrderId?: number | null;
    orders: ParticipantOrder[];
    payments: PaymentRef[];
    purchaseItems: PurchaseItemOption[];
    due: number;
    orderActions: ParticipantOrdersActions;
    onSetDeleteLineTarget: (target: { id: number; name: string } | null) => void;
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
    return (
        <div className="rounded-2xl border border-border bg-bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2">
                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">
                    {purchaseOrderId != null
                        ? `Заказ №${purchaseOrderId} · ${orders.length} поз.`
                        : `Позиции · ${orders.length}`}
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
                {orders.map((order) => {
                    const qty = Number(order.quantity);
                    const fallbackItem = purchaseItems.find((it) => it.id === order.purchaseItemId);
                    const sourceItem = order.purchaseItem ?? fallbackItem;
                    const step = getOrderQuantityStep(
                        buildOrderQtyOptions({
                            multiplicity: Number(sourceItem?.product?.multiplicity) || 1,
                            minPackageAmount:
                                sourceItem?.minPackageAmount != null
                                    ? Number(sourceItem.minPackageAmount)
                                    : null,
                            minPackageUnit: null,
                            unitCode: sourceItem?.product?.unitCode ?? null,
                        }),
                    );
                    return (
                        <div key={order.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                            {order.purchaseItem?.product && (
                                <ProductPhotoPreview
                                    photoId={order.purchaseItem.product.photos?.[0]?.id}
                                    alt={order.purchaseItem.product.name}
                                    thumbClassName="h-11 w-11 rounded-md"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                {order.purchaseItem?.product ? (
                                    <PurchaseProductLabel
                                        product={order.purchaseItem.product}
                                        primaryClassName="block truncate text-13-medium text-fg-primary"
                                        secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                                    />
                                ) : (
                                    <span className="text-13-medium text-fg-primary">
                                        Товар #{order.purchaseItemId}
                                    </span>
                                )}
                                {order.purchaseItem?.supplier && (
                                    <p
                                        className="mt-0.5 block truncate text-12-regular text-fg-tertiary"
                                        title={order.purchaseItem.supplier.name}
                                    >
                                        {order.purchaseItem.supplier.name}
                                    </p>
                                )}
                                {order.packageCount ? (
                                    <p className="mt-0.5 text-12-medium text-primary tabular-nums">
                                        +{order.packageCount} упак.
                                    </p>
                                ) : null}
                            </div>
                            <AdminOrderLineEditor
                                orderId={order.id}
                                purchaseItemId={order.purchaseItemId}
                                productName={
                                    order.purchaseItem?.product?.name ??
                                    `Товар #${order.purchaseItemId}`
                                }
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
                                onDelete={(orderId, productName) =>
                                    onSetDeleteLineTarget({ id: orderId, name: productName })
                                }
                            />
                            <div className="w-[90px] text-right text-13-semibold tabular-nums text-fg-primary">
                                {safeNumber(order.amountDue).toLocaleString('ru-RU')} ₽
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
