'use client';

import { useState } from 'react';
import { Eye, ChevronDown, ChevronRight, CircleCheck, CircleX, Clock, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import type { ProductLabelSource } from '@/app/(admin)/products/lib';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { PAYMENT_STATUS } from '../../../lib/constants';
import { paymentTotal } from '../../lib/utils';

interface ParticipantRowProps {
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
            priceOverride?: unknown;
        };
    }[];
    payments: {
        id: number;
        amount: unknown;
        paidAt: string;
        status: string;
        userComment?: string | null;
        proofData?: unknown;
        children?: { amount: unknown; promoCode: { code: string } | null }[];
    }[];
    due: number;
    paid: number;
    pending: number;
    onPaymentClick: (id: number) => void;
}

export function ParticipantRow({
    userId,
    name,
    username,
    purchaseId,
    purchaseOrderId,
    onOpenProfile,
    orders,
    payments,
    due,
    paid,
    pending,
    onPaymentClick,
}: ParticipantRowProps) {
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const utils = trpc.useUtils();

    const removeMutation = trpc.orders.removeAllByUserFromPurchase.useMutation({
        onSuccess: (count) => {
            utils.orders.getAllByPurchase.invalidate({ purchaseId });
            utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success(`Удалено заказов: ${count}`);
            setDeleteOpen(false);
        },
        onError: (err) => toast.error(err.message),
    });

    const isPaid = paid >= due;
    const hasPending = pending > 0 && !isPaid;

    function toggleDetails() {
        setOpen((prev) => !prev);
    }

    return (
        <>
            <TableRow className="hover:bg-accent/50 transition-colors">
                <TableCell>
                    <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={open ? 'Скрыть детали' : 'Показать заказы и оплаты'}
                        aria-expanded={open}
                        onClick={toggleDetails}
                    >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                </TableCell>
                <TableCell className="text-center font-medium tabular-nums">
                    {purchaseOrderId != null ? purchaseOrderId : '—'}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        className="flex items-center gap-2 rounded-md text-left transition-colors hover:bg-accent/60 -m-1 p-1"
                        onClick={() => onOpenProfile(userId)}
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-medium">{name}</p>
                            {username && <p className="text-xs text-muted-foreground">@{username}</p>}
                        </div>
                    </button>
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="secondary" className="font-normal">
                        {orders.length}
                    </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{due.toLocaleString('ru-RU')} ₽</TableCell>
                <TableCell className="text-right">
                    {paid > 0 ? (
                        <span className={cn('font-medium', isPaid && 'text-success')}>
                            {paid.toLocaleString('ru-RU')} ₽
                        </span>
                    ) : (
                        <span className="text-muted-foreground">0 ₽</span>
                    )}
                </TableCell>
                <TableCell className="text-center">
                    {isPaid ? (
                        <Badge className="bg-success-50 text-success hover:bg-success-50">
                            <CircleCheck className="mr-1 h-3 w-3" /> Оплачено
                        </Badge>
                    ) : hasPending ? (
                        <Badge className="bg-warning-50 text-warning hover:bg-warning-50">
                            <Clock className="mr-1 h-3 w-3" /> Ждёт оплаты
                        </Badge>
                    ) : (
                        <Badge className="bg-error-50 text-error hover:bg-error-50">
                            <CircleX className="mr-1 h-3 w-3" /> Не оплачено
                        </Badge>
                    )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>

            {open && (
                <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30 p-0">
                        <div className="p-4 pl-4 sm:pl-14">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {/* Left: Orders */}
                                <div>
                                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                                        {purchaseOrderId != null ? `Заказ №${purchaseOrderId} · позиции` : 'Заказы'}
                                    </p>
                                    <div className="rounded-md border bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Товар</TableHead>
                                                    <TableHead className="text-right">Кол-во</TableHead>
                                                    <TableHead className="text-right">Сумма</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {orders.map((order) => (
                                                    <TableRow key={order.id}>
                                                        <TableCell className="min-w-[18rem] max-w-xl whitespace-normal">
                                                            {order.purchaseItem?.product ? (
                                                                <PurchaseProductLabel
                                                                    product={order.purchaseItem.product}
                                                                    primaryClassName="text-sm font-medium"
                                                                    secondaryClassName="text-xs text-muted-foreground"
                                                                />
                                                            ) : (
                                                                <span className="font-medium">
                                                                    {`Товар #${order.purchaseItemId}`}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {Number(order.quantity).toLocaleString('ru-RU')}{' '}
                                                            {order.purchaseItem?.product?.unit?.shortName ?? ''}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {Number(order.amountDue).toLocaleString('ru-RU')} ₽
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="font-bold bg-muted/50">
                                                    <TableCell colSpan={2}>Итого</TableCell>
                                                    <TableCell className="text-right">
                                                        {due.toLocaleString('ru-RU')} ₽
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Right: Payments */}
                                <div>
                                    <p className="mb-2 text-sm font-medium text-muted-foreground">Оплаты</p>
                                    {payments.length === 0 ? (
                                        <div className="flex items-center justify-center rounded-md border bg-background py-8 text-sm text-muted-foreground">
                                            Оплат пока нет
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {payments.map((p) => {
                                                const status = p.status;
                                                const cfg = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING;
                                                const total = paymentTotal(p);
                                                const children = p.children ?? [];
                                                const child = children[0];
                                                const childAmount = child ? Number(child.amount) : 0;
                                                const promoCode = child?.promoCode;
                                                const hasProof = Boolean(
                                                    (p as { proofObjectKey?: string | null }).proofObjectKey ||
                                                    p.proofData,
                                                );

                                                return (
                                                    <div
                                                        key={p.id}
                                                        className={cn(
                                                            'flex items-center justify-between rounded-lg border bg-background px-3 py-2 cursor-pointer transition-colors hover:bg-accent/50',
                                                            status === 'PENDING' && 'border-warning/30',
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onPaymentClick(p.id);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div>
                                                                <span className="text-sm font-medium">
                                                                    {total.toLocaleString('ru-RU')} ₽
                                                                </span>
                                                                {childAmount > 0 && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {Number(p.amount).toLocaleString('ru-RU')} +
                                                                        промокод {promoCode?.code}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {hasProof && (
                                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                            )}
                                                            <Badge className={cn('text-xs', cfg.className)}>
                                                                {cfg.label}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
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
                onConfirm={() => {
                    removeMutation.mutate({ userId, purchaseId });
                }}
            />
        </>
    );
}
