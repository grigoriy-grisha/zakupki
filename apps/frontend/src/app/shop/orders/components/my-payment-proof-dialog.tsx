'use client';

import { FileText } from 'lucide-react';

import {
    paymentHasProof,
    paymentProofIsImage,
    SHOP_PAYMENT_STATUS,
    type ShopPaymentView,
} from '@/components/shop/payment-proof';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatRub } from '@/lib/format/money';
import { paymentTotal } from '@/lib/payment-utils';

type MyPaymentProofDialogProps = {
    payment: ShopPaymentView;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function MyPaymentProofDialog({ payment, open, onOpenChange }: MyPaymentProofDialogProps) {
    const status = payment.status;
    const statusCfg = SHOP_PAYMENT_STATUS[status] ?? {
        label: status,
        className: 'text-fg-tertiary',
    };
    const hasProof = paymentHasProof(payment);
    const proofUrl = `/api/payment-proof/${payment.id}`;
    const total = paymentTotal(payment);
    const children = payment.children ?? [];
    const child = children[0];
    const childAmount = child ? Number(child.amount) : 0;
    const promoCode = child?.promoCode;
    const isImage = paymentProofIsImage(payment);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Оплата #{payment.id}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-13-regular text-fg-secondary">Сумма</p>
                            <p className="text-lg font-bold">{formatRub(total)}</p>
                            {childAmount > 0 && (
                                <p className="text-xs text-success">
                                    {formatRub(Number(payment.amount))} + промокод {promoCode?.code}
                                </p>
                            )}
                        </div>
                        <div>
                            <p className="text-13-regular text-fg-secondary">Статус</p>
                            <p className={`font-medium ${statusCfg.className}`}>{statusCfg.label}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-13-regular text-fg-secondary">Дата отправки</p>
                            <p>
                                {new Date(payment.submittedAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </div>

                    {payment.userComment ? (
                        <div>
                            <p className="text-13-regular text-fg-secondary">Ваш комментарий</p>
                            <p className="mt-1 text-sm">{payment.userComment}</p>
                        </div>
                    ) : null}

                    {status === 'REJECTED' && payment.adminNote ? (
                        <div className="rounded-lg bg-error/10 p-3 text-13-regular text-error">
                            <p className="text-12-medium text-fg-secondary">Причина отклонения</p>
                            <p className="mt-1">{payment.adminNote}</p>
                        </div>
                    ) : null}

                    {hasProof ? (
                        <div>
                            <p className="mb-2 text-13-regular text-fg-secondary">Отправленный чек</p>
                            {isImage ? (
                                <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={proofUrl}
                                        alt="Чек об оплате"
                                        className="max-h-80 w-full rounded-lg border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    />
                                </a>
                            ) : (
                                <div className="flex items-center gap-3 rounded-lg border p-4">
                                    <FileText className="h-8 w-8 shrink-0 text-fg-tertiary" />
                                    <div>
                                        <p className="text-sm font-medium">Документ</p>
                                        <a
                                            href={proofUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary underline"
                                        >
                                            Открыть / скачать чек
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-13-regular text-fg-secondary">К этой оплате чек не прикреплён.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
