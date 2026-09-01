'use client';

import type { HandoffStatus } from '@zakupki/types';
import { ChevronDown, ChevronRight, CircleCheck, CircleX, Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Highlight } from '@/components/shared/highlight';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRub } from '@/lib/format/money';
import { cn } from '@/lib/utils';

import { getPaymentStatus } from '../../../lib/payment-status';
import { useParticipantOrderActions } from '../../hooks';
import type { OrderComment } from '../../hooks/use-participants-data';
import type { PaymentRef } from '../../lib/types';
import { type PurchaseItemOption } from './admin-order-controls';
import { ParticipantCommentStrip } from './participant-comment-strip';
import { ParticipantHandoffSelect } from './participant-handoff-select';
import { ParticipantOrdersPanel } from './participant-orders-panel';
import { ParticipantPaymentsPanel } from './participant-payments-panel';
import type { ParticipantOrder } from './types';

interface AdminParticipantRowProps {
    userId: number;
    name: string;
    username?: string;
    purchaseId: number;
    onOpenProfile: (userId: number) => void;
    /** ID PurchaseOrder — для P1 (отображение номера заказа) и для мутации комментария. */
    purchaseOrderId?: number | null;
    /** Комментарий к участнику (PurchaseOrder) — для индикатора и модалки. */
    orderComment: OrderComment | null;
    /** Статус выдачи заказа участника (null = «Ожидает выдачи»). */
    handoffStatus: HandoffStatus | null;
    orders: ParticipantOrder[];
    payments: PaymentRef[];
    /** Позиции закупки — для шага ± и пикера «добавить позицию». */
    purchaseItems: PurchaseItemOption[];
    due: number;
    paid: number;
    pending: number;
    onPaymentClick: (id: number) => void;
    /** Активный поисковый запрос — для подсветки совпадений в карточке. */
    searchQuery?: string;
    /** Раскрыть карточку по умолчанию (например, для списка всех участников). */
    defaultOpen?: boolean;
}

export function AdminParticipantRow({
    userId,
    name,
    username,
    purchaseId,
    onOpenProfile,
    purchaseOrderId,
    orderComment,
    handoffStatus,
    orders,
    payments,
    purchaseItems,
    due,
    paid,
    pending,
    onPaymentClick,
    searchQuery = '',
    defaultOpen = false,
}: AdminParticipantRowProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [deleteOpen, setDeleteOpen] = useState(false);
    // Подтверждение удаления товара целиком (все строки участника на purchaseItem). null = диалог закрыт.
    const [deleteLineTarget, setDeleteLineTarget] = useState<{ purchaseItemId: number; name: string } | null>(null);

    // Ручное управление позициями (в обход бизнес-логики) + удаление
    // участника и комментарий.
    const orderActions = useParticipantOrderActions(purchaseId);
    const actionPending =
        orderActions.adminAdjust.isPending ||
        orderActions.adminSetQuantity.isPending ||
        orderActions.adminAdjustPackage.isPending ||
        orderActions.deleteAllByUserItem.isPending;

    // Статус оплаты по суммам (общий helper для бейджа и фильтра списка).
    const paymentStatus = getPaymentStatus(due, paid);
    const isPaid = paymentStatus === 'paid';
    const hasPending = pending > 0 && !isPaid;
    // Полоса комментария показывается только если PurchaseOrder создан (нужен id
    // для мутации). Если purchaseOrderId == null — у пользователя ещё нет
    // записи, комментарий не к чему привязать.
    const canComment = purchaseOrderId != null;

    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    const nameMatched = q !== '' && name.toLowerCase().includes(q);
    const usernameMatched = q !== '' && (username ?? '').toLowerCase().includes(q);
    const participantComment = orderComment?.comment ?? '';
    const commentMatched = q !== '' && participantComment.toLowerCase().includes(q);
    const matchedItems =
        q === '' ? [] : orders.filter((o) => (o.purchaseItem?.adminComment ?? '').toLowerCase().includes(q));
    // Пояснительные строки нужны только когда заголовок сам не объясняет совпадение.
    const showMatchStrips = q !== '' && !nameMatched && !usernameMatched && (commentMatched || matchedItems.length > 0);

    return (
        <div className="overflow-hidden rounded-2xl border-2 border-primary/15 bg-bg-soft">
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
                        <p className="truncate text-14-semibold text-fg-primary">
                            <Highlight text={name} query={searchQuery} />
                        </p>
                        {username && (
                            <p className="truncate text-12-regular text-fg-tertiary">
                                @<Highlight text={username} query={searchQuery} />
                            </p>
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
                    <p className="text-14-semibold tabular-nums text-fg-primary">{formatRub(due)}</p>
                </div>

                <div className="hidden w-[100px] shrink-0 text-right sm:block">
                    <span className="text-12-regular text-fg-tertiary">Покрыто</span>
                    <p className={cn('text-14-semibold tabular-nums', isPaid ? 'text-success' : 'text-fg-primary')}>
                        {paid > 0 ? `${formatRub(paid)}` : '—'}
                    </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {purchaseOrderId != null && (
                        <ParticipantHandoffSelect
                            value={handoffStatus}
                            disabled={orderActions.setHandoffStatus.isPending}
                            onSelect={(status) => {
                                orderActions.setHandoffStatus.mutate({ id: purchaseOrderId, status });
                            }}
                        />
                    )}
                    {isPaid ? (
                        <Badge type="subtle" variant="success" size="sm">
                            <CircleCheck className="mr-1 size-3" /> Оплачено
                        </Badge>
                    ) : paymentStatus === 'partial' ? (
                        <Badge type="subtle" variant="warning" size="sm">
                            <Clock className="mr-1 size-3" /> Частично
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

            {showMatchStrips && (
                <div className="space-y-1 border-t border-border-soft bg-bg-base px-3 py-2 sm:px-4">
                    {commentMatched && (
                        <p className="line-clamp-2 text-12-regular text-fg-secondary">
                            <span className="text-fg-tertiary">Комментарий: </span>
                            <Highlight text={participantComment} query={searchQuery} />
                        </p>
                    )}
                    {matchedItems.slice(0, 3).map((o) => (
                        <p key={o.id} className="line-clamp-2 text-12-regular text-fg-secondary">
                            <span className="text-fg-tertiary">{o.purchaseItem?.product?.name ?? 'Товар'}: </span>
                            <Highlight text={o.purchaseItem?.adminComment ?? ''} query={searchQuery} />
                        </p>
                    ))}
                </div>
            )}

            {/* Раскрытая панель: комментарий + 2 ListView-секции (заказы / оплаты) */}
            <div
                className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
                inert={!open}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="space-y-3 border-t border-border-soft bg-bg-base p-3 sm:p-4">
                        {canComment && (
                            <ParticipantCommentStrip
                                purchaseOrderId={purchaseOrderId}
                                participantName={name}
                                initialComment={orderComment?.comment ?? null}
                                initialCommentAt={orderComment?.commentAt ?? null}
                                initialCommentAuthor={orderComment?.commentAuthor ?? null}
                                isPending={orderActions.setOrderComment.isPending}
                                onSave={(comment) => {
                                    orderActions.setOrderComment.mutate({ id: purchaseOrderId, comment });
                                }}
                            />
                        )}
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <ParticipantOrdersPanel
                                userId={userId}
                                purchaseOrderId={purchaseOrderId}
                                orders={orders}
                                purchaseItems={purchaseItems}
                                due={due}
                                orderActions={{
                                    adminAdjust: ({ purchaseItemId, delta, userId: uid }) =>
                                        orderActions.adminAdjust.mutate({ purchaseItemId, userId: uid, delta }),
                                    adminSetQuantity: ({ purchaseItemId, qty, userId: uid }) =>
                                        orderActions.adminSetQuantity.mutate({
                                            purchaseItemId,
                                            userId: uid,
                                            qty,
                                        }),
                                    adminAdjustPackage: ({ purchaseItemId, delta, userId: uid }) =>
                                        orderActions.adminAdjustPackage.mutate({
                                            purchaseItemId,
                                            delta,
                                            userId: uid,
                                        }),
                                    deleteAllByUserItem: orderActions.deleteAllByUserItem,
                                    adminAdjustIsPending: actionPending,
                                }}
                                onSetDeleteLineTarget={setDeleteLineTarget}
                            />
                            <ParticipantPaymentsPanel
                                userId={userId}
                                purchaseId={purchaseId}
                                payments={payments}
                                due={due}
                                onPaymentClick={onPaymentClick}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Удалить участника из закупки?"
                description={
                    <>
                        {name} будет удалён из закупки
                        {purchaseOrderId != null ? ` (заказ №${purchaseOrderId})` : ''} со всеми позициями (
                        {orders.length}).
                        {due > 0 && <> К оплате было {formatRub(due)}.</>}
                    </>
                }
                loading={orderActions.removeParticipant.isPending}
                onConfirm={() =>
                    orderActions.removeParticipant.mutate(
                        { userId, purchaseId },
                        { onSuccess: () => setDeleteOpen(false) },
                    )
                }
            />

            <ConfirmDialog
                open={deleteLineTarget != null}
                onOpenChange={(o) => {
                    if (!o && !orderActions.deleteAllByUserItem.isPending) {
                        setDeleteLineTarget(null);
                    }
                }}
                title="Удалить товар из заказа?"
                description={
                    deleteLineTarget ? (
                        <>
                            «{deleteLineTarget.name}» будет удалён из заказа {name} целиком (сбор, добор и упаковки).
                            Действие нельзя отменить.
                        </>
                    ) : null
                }
                confirmLabel="Удалить"
                loading={orderActions.deleteAllByUserItem.isPending}
                onConfirm={() => {
                    if (!deleteLineTarget) return;
                    orderActions.deleteAllByUserItem.mutate(
                        { purchaseItemId: deleteLineTarget.purchaseItemId, userId },
                        { onSuccess: () => setDeleteLineTarget(null) },
                    );
                }}
            />
        </div>
    );
}
