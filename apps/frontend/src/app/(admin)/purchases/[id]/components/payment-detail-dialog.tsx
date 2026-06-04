'use client';

import { useState } from 'react';
import { Loader2, Check, X, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PAYMENT_STATUS } from '../../../lib/constants';
import { useConfirmPayment, useRejectPayment } from '../hooks';
interface PaymentDetailDialogProps {
    payment: {
        id: number;
        userId: number;
        amount: unknown;
        status: string;
        paidAt: string;
        userComment?: string;
        adminNote?: string;
        proofData?: unknown;
        proofMimeType?: string;
        user?: { firstName: string; lastName?: string | null };
        children?: { amount: unknown; promoCode: { code: string } | null }[];
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchaseId: number;
}

export function PaymentDetailDialog({ payment, open, onOpenChange, purchaseId }: PaymentDetailDialogProps) {
    const status = payment.status;
    const cfg = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING;
    const hasProof = Boolean((payment as { proofObjectKey?: string | null }).proofObjectKey || payment.proofData);
    const userName = payment.user
        ? [payment.user.firstName, payment.user.lastName].filter(Boolean).join(' ')
        : `User #${payment.userId}`;

    const [adminNote, setAdminNote] = useState('');
    const [rejectNote, setRejectNote] = useState('');
    const [showReject, setShowReject] = useState(false);

    const children = payment.children ?? [];
    const child = children[0];
    const childAmount = child ? Number(child.amount) : 0;
    const promoCode = child?.promoCode;
    const totalAmount = Number(payment.amount) + childAmount;

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
                    <DialogTitle>Оплата #{payment.id}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Участник</p>
                            <p className="font-medium">{userName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Сумма</p>
                            <p className="text-xl font-bold">{totalAmount.toLocaleString('ru-RU')} ₽</p>
                            {childAmount > 0 && (
                                <p className="text-xs text-success">
                                    Оплачено {Number(payment.amount).toLocaleString('ru-RU')} ₽ + промокод{' '}
                                    {promoCode?.code} {childAmount.toLocaleString('ru-RU')} ₽
                                </p>
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Статус</p>
                            <Badge className={cfg.className}>{cfg.label}</Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Дата</p>
                            <p>
                                {new Date(payment.paidAt).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </p>
                        </div>
                    </div>

                    {payment.userComment && (
                        <div>
                            <p className="text-sm text-muted-foreground">Комментарий участника</p>
                            <p className="text-sm mt-1">{payment.userComment}</p>
                        </div>
                    )}
                    {payment.adminNote && (
                        <div className={cn('rounded-md p-3', status === 'REJECTED' ? 'bg-error-50' : 'bg-muted')}>
                            <p className="text-xs font-medium text-muted-foreground">
                                {status === 'REJECTED' ? 'Причина отклонения:' : 'Комментарий магазина:'}
                            </p>
                            <p className="text-sm mt-1">{payment.adminNote}</p>
                        </div>
                    )}

                    {hasProof && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Подтверждение оплаты</p>
                            {payment.proofMimeType?.startsWith('image/') ? (
                                <a href={`/api/payment-proof/${payment.id}`} target="_blank">
                                    <img
                                        src={`/api/payment-proof/${payment.id}`}
                                        alt="Подтверждение оплаты"
                                        className="max-h-72 w-auto rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                    />
                                </a>
                            ) : (
                                <div className="flex items-center gap-3 rounded-lg border p-4">
                                    <Package className="h-8 w-8 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">Документ загружен</p>
                                        <a
                                            href={`/api/payment-proof/${payment.id}`}
                                            target="_blank"
                                            className="text-sm text-primary underline"
                                        >
                                            Скачать файл
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!showReject && (
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
                                        {confirmMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                        <Check className="h-4 w-4" />
                                        Подтвердить
                                    </Button>
                                )}
                                {status !== 'REJECTED' && (
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => setShowReject(true)}
                                    >
                                        <X className="h-4 w-4" />
                                        Отклонить
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {showReject && (
                        <div className="space-y-3 border-t pt-4">
                            <div className="rounded-lg bg-error-50 p-3 text-sm text-error">
                                Участник будет уведомлён, что оплата отклонена
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Причина отклонения <span className="text-destructive">*</span>
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
