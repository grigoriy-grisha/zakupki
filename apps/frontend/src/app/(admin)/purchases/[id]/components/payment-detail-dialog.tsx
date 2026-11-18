'use client';

import { Check, Copy, Loader2, Package, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRub } from '@/lib/format/money';
import { describePayment } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';

import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS, REFUND_BADGE } from '../../../lib/constants';
import { useConfirmPayment, useRefundPayment, useRejectPayment } from '../hooks';
import type { PaymentRef } from '../lib/types';

interface PaymentDetailDialogProps {
    payment: PaymentRef;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchaseId: number;
}

export function PaymentDetailDialog({ payment, open, onOpenChange, purchaseId }: PaymentDetailDialogProps) {
    const status = payment.status;
    const { isRefund, total: totalAmount, promoAmount: childAmount, promoCode } = describePayment(payment);
    const cfg = isRefund ? REFUND_BADGE : (PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING);
    const hasProof = Boolean(payment.proofObjectKey);
    const isOnline = Boolean(payment.method && payment.method !== 'MANUAL');
    const feeAmount = Number(payment.feeAmount ?? 0);
    const userName = payment.user
        ? [payment.user.firstName, payment.user.lastName].filter(Boolean).join(' ')
        : `User #${payment.userId}`;

    const [adminNote, setAdminNote] = useState('');
    const [rejectNote, setRejectNote] = useState('');
    const [showReject, setShowReject] = useState(false);

    const confirmMutation = useConfirmPayment(purchaseId);
    const rejectMutation = useRejectPayment(purchaseId);

    function handleConfirm() {
        confirmMutation.mutate(
            { id: payment.id, adminNote: adminNote || undefined },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    setAdminNote('');
                },
            },
        );
    }

    function handleReject() {
        rejectMutation.mutate(
            { id: payment.id, adminNote: rejectNote },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    setRejectNote('');
                    setShowReject(false);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isRefund ? 'Возврат' : 'Оплата'} #{payment.id}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-14-regular text-fg-secondary">Участник</p>
                            <p className="text-14-semibold">{userName}</p>
                        </div>
                        <div>
                            <p className="text-14-regular text-fg-secondary">Сумма</p>
                            {childAmount > 0 ? (
                                <>
                                    <p className="flex items-baseline gap-2">
                                        <span className="text-14-regular text-fg-tertiary line-through tabular-nums">
                                            {formatRub(totalAmount)}
                                        </span>
                                        <span className="text-24-medium text-success tabular-nums">
                                            {formatRub(Number(payment.amount))}
                                        </span>
                                    </p>
                                    <p className="text-12-regular text-success">
                                        Промокод {promoCode ?? ''} покрывает {formatRub(childAmount)}
                                    </p>
                                </>
                            ) : (
                                <p className="text-24-medium text-primary tabular-nums">{formatRub(totalAmount)}</p>
                            )}
                        </div>
                        <div>
                            <p className="text-14-regular text-fg-secondary">Статус</p>
                            <Badge className={cfg.className}>{cfg.label}</Badge>
                        </div>
                        <div>
                            <p className="text-14-regular text-fg-secondary">Дата</p>
                            <p className="text-14-regular">
                                {new Date(payment.submittedAt).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </p>
                        </div>
                    </div>

                    {isOnline && !isRefund && (
                        <div className="space-y-1 rounded-md bg-bg-soft p-3 text-14-regular">
                            <p>
                                <span className="text-fg-secondary">Оплачено: </span>
                                {PAYMENT_METHOD_LABELS[payment.method ?? ''] ?? payment.method}
                            </p>
                            {feeAmount > 0 && (
                                <p>
                                    <span className="text-fg-secondary">Комиссия банка: </span>
                                    <span className="tabular-nums">{formatRub(feeAmount)}</span>
                                </p>
                            )}
                            {payment.providerPaymentId && (
                                <p className="flex items-center gap-1">
                                    <span className="text-fg-secondary">Номер в Т-Банке: </span>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 tabular-nums underline decoration-dotted underline-offset-2"
                                        title="Скопировать"
                                        onClick={() => {
                                            void navigator.clipboard.writeText(payment.providerPaymentId!);
                                            toast.success('Номер скопирован');
                                        }}
                                    >
                                        {payment.providerPaymentId}
                                        <Copy className="size-3.5" />
                                    </button>
                                </p>
                            )}
                        </div>
                    )}

                    {payment.userComment && (
                        <div>
                            <p className="text-14-regular text-fg-secondary">Комментарий участника</p>
                            <p className="mt-1 text-14-regular">{payment.userComment}</p>
                        </div>
                    )}
                    {payment.adminNote && (
                        <div className={cn('rounded-md p-3', status === 'REJECTED' ? 'bg-error-50' : 'bg-bg-soft')}>
                            <p className="text-12-medium text-fg-tertiary">
                                {status === 'REJECTED' ? 'Причина отклонения:' : 'Комментарий магазина:'}
                            </p>
                            <p className="mt-1 text-14-regular">{payment.adminNote}</p>
                        </div>
                    )}

                    {hasProof && (
                        <div>
                            <p className="mb-2 text-14-regular text-fg-secondary">Подтверждение оплаты</p>
                            {!payment.proofObjectKey?.endsWith('.pdf') ? (
                                <a href={`/api/payment-proof/${payment.id}`} target="_blank">
                                    <img
                                        src={`/api/payment-proof/${payment.id}`}
                                        alt="Подтверждение оплаты"
                                        className="max-h-72 w-auto rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                    />
                                </a>
                            ) : (
                                <div className="flex items-center gap-3 rounded-lg border p-4">
                                    <Package className="size-8 text-fg-secondary" />
                                    <div>
                                        <p className="text-14-semibold">Документ загружен</p>
                                        <a
                                            href={`/api/payment-proof/${payment.id}`}
                                            target="_blank"
                                            className="text-14-regular text-secondary underline"
                                        >
                                            Скачать файл
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isOnline && !isRefund && status === 'CONFIRMED' && (
                        <RefundSection payment={payment} purchaseId={purchaseId} />
                    )}

                    {!isOnline && !showReject && (
                        <div className="space-y-3 border-t pt-4">
                            <div className="space-y-2">
                                <Label>Комментарий (необязательно)</Label>
                                <Textarea
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    rows={2}
                                    placeholder="Например: получено по СБП, спасибо"
                                />
                            </div>
                            <div className="flex gap-2">
                                {status !== 'CONFIRMED' && (
                                    <Button
                                        className="flex-1"
                                        onClick={handleConfirm}
                                        disabled={confirmMutation.isPending}
                                    >
                                        {confirmMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                                        <Check className="size-4" />
                                        Подтвердить
                                    </Button>
                                )}
                                {status !== 'REJECTED' && (
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => setShowReject(true)}
                                    >
                                        <X className="size-4" />
                                        Отклонить
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {!isOnline && showReject && (
                        <div className="space-y-3 border-t pt-4">
                            <div className="rounded-lg bg-error-50 p-3 text-14-regular text-error">
                                Участник будет уведомлён, что оплата отклонена
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Причина отклонения <span className="text-error">*</span>
                                </Label>
                                <Textarea
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    rows={3}
                                    placeholder="Например: не видно сумму, перешлите ещё раз"
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setShowReject(false)}>
                                    Назад
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={handleReject}
                                    disabled={!rejectNote.trim() || rejectMutation.isPending}
                                >
                                    {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Отклонить
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function RefundSection({ payment, purchaseId }: { payment: PaymentRef; purchaseId: number }) {
    const refunded = (payment.refunds ?? [])
        .filter((r) => r.status === 'CONFIRMED')
        .reduce((sum, r) => sum - Number(r.amount), 0);
    const maxRefund = Math.max(0, Math.round((Number(payment.amount) - refunded) * 100) / 100);

    const [open, setOpen] = useState(false);
    const [amountStr, setAmountStr] = useState('');
    const [reason, setReason] = useState('');
    const refund = useRefundPayment(purchaseId);

    const amount = Number(amountStr.replace(',', '.'));
    // Сравниваем в копейках и не пускаем больше двух знаков после запятой.
    const amountValid =
        Number.isFinite(amount) &&
        amount > 0 &&
        Number.isInteger(Math.round(amount * 1e6) / 1e4) &&
        Math.round(amount * 100) <= Math.round(maxRefund * 100);

    if (maxRefund <= 0) {
        return (
            <div className="rounded-md bg-bg-soft p-3 text-14-regular text-fg-secondary">
                По этой оплате всё вернули: {formatRub(refunded)}.
            </div>
        );
    }

    if (!open) {
        return (
            <div className="space-y-2 border-t pt-4">
                {refunded > 0 && (
                    <p className="text-14-regular text-fg-secondary">Уже вернули: {formatRub(refunded)}</p>
                )}
                <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                        setAmountStr(String(maxRefund));
                        setOpen(true);
                    }}
                >
                    <Undo2 className="size-4" />
                    Вернуть деньги
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3 border-t pt-4">
            <div className="space-y-2">
                <Label htmlFor="refund-amount">Сколько вернуть, ₽</Label>
                <Input
                    id="refund-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    max={maxRefund}
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                />
                <p className="text-12-regular text-fg-tertiary">
                    Можно до {formatRub(maxRefund)}. Деньги вернутся на карту клиента за несколько дней. Комиссия банка
                    не возвращается.
                </p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="refund-reason">Причина (увидит клиент)</Label>
                <Textarea
                    id="refund-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Например: товара нет в наличии"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={refund.isPending}>
                    Назад
                </Button>
                <Button
                    className="flex-1"
                    disabled={!amountValid || refund.isPending}
                    onClick={() =>
                        refund.mutate(
                            { id: payment.id, amount, reason: reason.trim() || undefined },
                            {
                                onSuccess: () => {
                                    setOpen(false);
                                    setReason('');
                                },
                            },
                        )
                    }
                >
                    {refund.isPending && <Loader2 className="size-4 animate-spin" />}
                    Вернуть {amountValid ? formatRub(amount) : ''}
                </Button>
            </div>
        </div>
    );
}
