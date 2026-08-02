'use client';

import { useState } from 'react';
import { Eye, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAddPayment } from '../../hooks';
import { PAYMENT_STATUS } from '../../../../lib/constants';
import { paymentTotal } from '../../../lib/utils';
import type { PaymentRef } from '../../lib/types';

interface ParticipantPaymentsPanelProps {
    userId: number;
    purchaseId: number;
    payments: PaymentRef[];
    /** Сколько участник должен (для подсказки в диалоге добавления оплаты). */
    due: number;
    onPaymentClick: (id: number) => void;
}

export function ParticipantPaymentsPanel({
    userId,
    purchaseId,
    payments,
    due,
    onPaymentClick,
}: ParticipantPaymentsPanelProps) {
    return (
        <div className="rounded-2xl border border-border bg-bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2">
                <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">
                    Оплаты · {payments.length}
                </span>
                <AddPaymentDialog userId={userId} purchaseId={purchaseId} due={due} />
            </div>
            {payments.length === 0 ? (
                <div className="px-3 py-6 text-center text-13-regular text-fg-tertiary">Оплат пока нет</div>
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
                                    {hasProof && <Eye className="size-3.5 text-fg-tertiary" />}
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
    );
}

// ── AddPaymentDialog: записать оплату от участника (офлайн/СБП/наличные) ──

interface AddPaymentDialogProps {
    userId: number;
    purchaseId: number;
    /** Долг участника — показывается как подсказка «к оплате N ₽». */
    due: number;
}

/** «1 500» / «1,500.50» / «1500,5» → 1500 | 1500.5 | 1500.5; пусто/нечисло → null. */
function parseAmount(raw: string): number | null {
    const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
    if (normalized === '') return null;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

/**
 * Диалог записи оплаты участника. Создаёт CONFIRMED-платёж (см.
 * PaymentRepository.create) — сразу попадает в «Покрыто» карточки участника.
 * Чек не требуется: это для off-line платежей, которые админ уже увидел
 * (наличные, перевод на карту, СБП вне бота).
 */
function AddPaymentDialog({ userId, purchaseId, due }: AddPaymentDialogProps) {
    const [open, setOpen] = useState(false);
    const [amountStr, setAmountStr] = useState('');
    const [note, setNote] = useState('');

    const addPayment = useAddPayment(purchaseId);

    const reset = () => {
        setAmountStr('');
        setNote('');
    };

    const submit = () => {
        const amount = parseAmount(amountStr);
        if (amount == null) return;
        addPayment.mutate(
            { userId, purchaseId, amount, note: note.trim() || undefined },
            {
                onSuccess: () => {
                    setOpen(false);
                    reset();
                },
            },
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Добавить оплату">
                    <Plus />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Добавить оплату</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="payment-amount" className="text-14-semibold">
                                Сумма, ₽
                            </Label>
                            {due > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto px-2 py-0.5 text-12-medium text-fg-secondary"
                                    onClick={() => setAmountStr(String(due))}
                                >
                                    Оплатить всё: {due.toLocaleString('ru-RU')} ₽
                                </Button>
                            )}
                        </div>
                        <Input
                            id="payment-amount"
                            inputMode="decimal"
                            placeholder="0"
                            value={amountStr}
                            autoFocus
                            onChange={(e) => setAmountStr(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submit();
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="payment-note">Комментарий (необязательно)</Label>
                        <Textarea
                            id="payment-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                            placeholder="Например: наличные, перевод на карту"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Отмена</Button>
                    </DialogClose>
                    <Button onClick={submit} disabled={addPayment.isPending || !amountStr}>
                        Добавить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
