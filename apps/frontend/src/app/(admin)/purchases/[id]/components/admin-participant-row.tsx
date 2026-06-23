'use client';

import { useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    CircleCheck,
    CircleX,
    Clock,
    Eye,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';
import { PAYMENT_STATUS } from '../../../lib/constants';
import { useParticipantOrderActions } from '../hooks';
import { AddPositionDialog, AdminOrderLineEditor, type PurchaseItemOption } from './admin-order-controls';
import { paymentTotal } from '../../lib/utils';
import type { ProductLabelSource } from '../../../products/lib';

interface AdminParticipantRowProps {
    userId: number;
    name: string;
    username?: string;
    purchaseId: number;
    onOpenProfile: (userId: number) => void;
    purchaseOrderId?: number | null;
    orders: {
        id: number;
        purchaseItemId: number;
        quantity: unknown;
        amountDue: unknown;
        purchaseItem?: {
            product?: ProductLabelSource & { unit?: { shortName: string } };
        };
    }[];
    payments: {
        id: number;
        amount: unknown;
        submittedAt: string;
        status: string;
        userComment?: string | null;
        children?: { amount: unknown; promoCode: { code: string } | null }[];
        proofObjectKey?: string | null;
    }[];
    /** Позиции закупки — для шага ± и пикера «добавить позицию». */
    purchaseItems: PurchaseItemOption[];
    due: number;
    paid: number;
    pending: number;
    onPaymentClick: (id: number) => void;
}

export function AdminParticipantRow({
    userId,
    name,
    username,
    purchaseId,
    onOpenProfile,
    purchaseOrderId,
    orders,
    payments,
    purchaseItems,
    due,
    paid,
    pending,
    onPaymentClick,
}: AdminParticipantRowProps) {
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const utils = trpc.useUtils();

    const removeMutation = trpc.orders.removeAllByUserFromPurchase.useMutation({
        onSuccess: (result) => {
            void utils.orders.getAllByPurchase.invalidate({ purchaseId });
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success(`Удалено заказов: ${result.count}`);
            setDeleteOpen(false);
        },
        onError: (err) => toast.error(err.message),
    });

    // Ручное управление позициями (в обход бизнес-логики).
    const orderActions = useParticipantOrderActions(purchaseId);
    const actionPending =
        orderActions.adminAdjust.isPending ||
        orderActions.adminSetQuantity.isPending ||
        orderActions.deleteOrderLine.isPending;

    const isPaid = paid >= due && due > 0;
    const hasPending = pending > 0 && !isPaid;

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
            {/* Header (всегда виден) */}
            <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setOpen((p) => !p)}
                    aria-label={open ? 'Скрыть детали' : 'Показать заказы и оплаты'}
                    aria-expanded={open}
                    className="size-7 rounded-full text-fg-secondary"
                >
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(userId);
                    }}
                    className="flex min-w-0 items-center gap-2 text-left"
                >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-12-semibold text-primary">
                        {name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-14-semibold text-fg-primary">{name}</p>
                        {username && (
                            <p className="truncate text-12-regular text-fg-tertiary">@{username}</p>
                        )}
                    </div>
                </button>

                <div className="hidden w-[64px] shrink-0 text-center sm:block">
                    <span className="text-12-regular text-fg-tertiary">№</span>
                    <p className="text-13-medium tabular-nums text-fg-primary">
                            {purchaseOrderId != null ? purchaseOrderId : '—'}
                    </p>
                </div>

                <div className="hidden w-[60px] shrink-0 text-center sm:block">
                    <Badge type="subtle" variant="neutral" size="sm">
                        {orders.length} поз.
                    </Badge>
                </div>

                <div className="hidden w-[100px] shrink-0 text-right sm:block">
                    <span className="text-12-regular text-fg-tertiary">К оплате</span>
                    <p className="text-14-semibold tabular-nums text-fg-primary">
                        {due.toLocaleString('ru-RU')} ₽
                    </p>
                </div>

                <div className="hidden w-[100px] shrink-0 text-right sm:block">
                    <span className="text-12-regular text-fg-tertiary">Покрыто</span>
                    <p
                        className={cn(
                            'text-14-semibold tabular-nums',
                            isPaid ? 'text-success' : 'text-fg-primary',
                        )}
                    >
                        {paid > 0 ? `${paid.toLocaleString('ru-RU')} ₽` : '—'}
                    </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {isPaid ? (
                        <Badge type="subtle" variant="success" size="sm">
                            <CircleCheck className="mr-1 size-3" /> Оплачено
                        </Badge>
                    ) : hasPending ? (
                        <Badge type="subtle" variant="warning" size="sm">
                            <Clock className="mr-1 size-3" /> Ждёт
                        </Badge>
                    ) : (
                        <Badge type="subtle" variant="critical" size="sm">
                            <CircleX className="mr-1 size-3" /> Не оплачено
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Удалить участника"
                        onClick={(e) => {
                            e.stopPropagation();
                            setDeleteOpen(true);
                        }}
                        className="size-8 rounded-full text-fg-tertiary hover:text-error"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Раскрытая панель: 2 ListView-секции (заказы / оплаты) */}
            {open && (
                <div className="border-t border-border-soft bg-bg-base p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {/* Заказы */}
                        <div className="rounded-2xl border border-border bg-bg-card">
                            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2">
                                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">
                                    {purchaseOrderId != null
                                        ? `Заказ №${purchaseOrderId} · ${orders.length} поз.`
                                        : `Позиции · ${orders.length}`}
                                </span>
                                <AddPositionDialog
                                    purchaseItems={purchaseItems}
                                    pending={orderActions.adminAdjust.isPending}
                                    onAdd={(purchaseItemId, qty) =>
                                        orderActions.adminAdjust.mutate({ purchaseItemId, userId, delta: qty })
                                    }
                                />
                            </div>
                            <div className="divide-y divide-border-soft">
                                {orders.map((order) => {
                                    const qty = Number(order.quantity);
                                    const matchedItem = purchaseItems.find(
                                        (item) => item.id === order.purchaseItemId,
                                    );
                                    const step = Number(matchedItem?.product?.minPackageAmount) || 1;
                                    return (
                                        <div
                                            key={order.id}
                                            className="flex flex-wrap items-center gap-3 px-3 py-2"
                                        >
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
                                            </div>
                                            <AdminOrderLineEditor
                                                orderId={order.id}
                                                purchaseItemId={order.purchaseItemId}
                                                quantity={qty}
                                                step={step}
                                                pending={actionPending}
                                                onAdjust={(purchaseItemId, delta) =>
                                                    orderActions.adminAdjust.mutate({ purchaseItemId, userId, delta })
                                                }
                                                onSetQuantity={(purchaseItemId, setQty) =>
                                                    orderActions.adminSetQuantity.mutate({
                                                        purchaseItemId,
                                                        userId,
                                                        qty: setQty,
                                                    })
                                                }
                                                onDelete={(orderId) =>
                                                    orderActions.deleteOrderLine.mutate({ id: orderId })
                                                }
                                            />
                                            <div className="w-[90px] text-right text-13-semibold tabular-nums text-fg-primary">
                                                {Number(order.amountDue).toLocaleString('ru-RU')} ₽
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

                        {/* Оплаты */}
                        <div className="rounded-2xl border border-border bg-bg-card">
                            <div className="border-b border-border-soft px-3 py-2 text-12-medium uppercase tracking-wide text-fg-tertiary">
                                Оплаты · {payments.length}
                            </div>
                            {payments.length === 0 ? (
                                <div className="px-3 py-6 text-center text-13-regular text-fg-tertiary">
                                    Оплат пока нет
                                </div>
                            ) : (
                                <div className="divide-y divide-border-soft">
                                    {payments.map((p) => {
                                        const status = p.status;
                                        const cfg = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING;
                                        const total = paymentTotal(p);
                                        const children = p.children ?? [];
                                        const child = children[0];
                                        const childAmount = child ? Number(child.amount) : 0;
                                        const promoCode = child?.promoCode;
                                        const hasProof = Boolean(p.proofObjectKey);
                                        return (
                                            <Button
                                                key={p.id}
                                                variant="ghost"
                                                size="default"
                                                onClick={() => onPaymentClick(p.id)}
                                                className={cn(
                                                    'h-auto w-full justify-between rounded-none px-3 py-2 text-left',
                                                    status === 'PENDING' && 'border-l-2 border-warning',
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <span className="text-14-semibold tabular-nums text-fg-primary">
                                                        {total.toLocaleString('ru-RU')} ₽
                                                    </span>
                                                    {childAmount > 0 && (
                                                        <p className="truncate text-12-regular text-fg-tertiary">
                                                            {Number(p.amount).toLocaleString('ru-RU')} + промокод{' '}
                                                            {promoCode?.code}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    {hasProof && (
                                                        <Eye className="size-3.5 text-fg-tertiary" />
                                                    )}
                                                    <Badge className={cn('text-12-medium', cfg.className)}>
                                                        {cfg.label}
                                                    </Badge>
                                                </div>
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Удалить участника из закупки?"
                description={
                    <>
                        {name} будет удалён из закупки
                        {purchaseOrderId != null ? ` (заказ №${purchaseOrderId})` : ''} со всеми позициями (
                        {orders.length}).
                        {due > 0 && <> К оплате было {due.toLocaleString('ru-RU')} ₽.</>}
                    </>
                }
                loading={removeMutation.isPending}
                onConfirm={() => removeMutation.mutate({ userId, purchaseId })}
            />
        </div>
    );
}
