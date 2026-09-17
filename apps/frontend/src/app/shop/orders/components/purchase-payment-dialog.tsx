'use client';

import { Check, Copy, CreditCard, Loader2, Tag, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { usePaymentForm } from '@/app/shop/hooks/use-payment-form';
import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRub } from '@/lib/format/money';
import { PAYMENT_DETAILS, type PaymentPromoInfo } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';

const COPYABLE_PAYMENT_FIELDS = [
    { key: 'phone', label: 'Номер телефона', value: PAYMENT_DETAILS.phone },
    { key: 'recipient', label: 'Получатель', value: PAYMENT_DETAILS.recipient },
] as const;

function toAmountString(value: number): string {
    return String(Math.round(value * 100) / 100);
}

export type PurchasePaymentDialogProps = {
    purchaseId: number;
    remaining: number;
    due: number;
    paymentOpen: boolean;
    pinnedPromo?: PaymentPromoInfo;
    triggerVariant?: 'button' | 'link';
    buttonClassName?: string;
    buttonSize?: 'sm' | 'default';
};

export function PurchasePaymentDialog({
    purchaseId,
    remaining,
    due,
    paymentOpen,
    pinnedPromo,
    triggerVariant = 'button',
    buttonClassName,
    buttonSize = 'sm',
}: PurchasePaymentDialogProps) {
    const form = usePaymentForm(purchaseId, remaining, due, pinnedPromo);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        };
    }, []);

    function handleCopy(key: string, value: string) {
        void navigator.clipboard.writeText(value);
        setCopiedKey(key);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setCopiedKey(null), 1500);
    }

    const payLabel = `Оплатить ${formatRub(remaining)}`;

    const amountValid =
        form.numAmount > 0 && form.numAmount <= form.maxTransfer && !Number.isNaN(form.numAmount);
    const closesFully = amountValid && form.numAmount === form.maxTransfer;
    const promoReduces = form.maxTransfer < remaining;

    const payButton = !paymentOpen ? (
        <div className={cn('relative w-full', buttonClassName)}>
            <Button
                variant="brand"
                size={buttonSize}
                disabled
                className="w-full blur-[3px] opacity-50 pointer-events-none"
            >
                <CreditCard className="h-4 w-4" />
                Оплатить {formatRub(remaining)}
            </Button>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
                <span className="rounded-md bg-background/90 px-2 py-1 text-center text-12-medium text-fg-secondary shadow-sm">
                    Ждём начала оплаты
                </span>
            </div>
        </div>
    ) : triggerVariant === 'link' ? (
        <Button
            variant="link"
            size="sm"
            className={cn('h-auto gap-1 p-0 text-14-medium text-primary', buttonClassName)}
            onClick={() => form.handleOpenChange(true)}
        >
            <CreditCard className="size-3.5" />
            {payLabel}
        </Button>
    ) : (
        <Button
            variant="brand"
            size={buttonSize}
            className={cn('w-full gap-2', buttonClassName)}
            onClick={() => form.handleOpenChange(true)}
        >
            <CreditCard className="h-4 w-4" />
            {payLabel}
        </Button>
    );

    return (
        <Dialog open={form.open} onOpenChange={form.handleOpenChange}>
            {payButton}
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Оплата — прикрепите чек</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-bg-soft p-3">
                    <p className="text-13-semibold text-fg-primary">Реквизиты для оплаты</p>
                    <p className="mt-1.5 text-13-regular text-fg-secondary">
                        Способ оплаты: <span className="text-fg-primary">{PAYMENT_DETAILS.method}</span>
                    </p>
                    <div className="mt-1 space-y-0.5">
                        {COPYABLE_PAYMENT_FIELDS.map((field) => {
                            const copied = copiedKey === field.key;
                            return (
                                <button
                                    key={field.key}
                                    type="button"
                                    onClick={() => handleCopy(field.key, field.value)}
                                    aria-label={`Скопировать: ${field.label}`}
                                    className={cn(
                                        '-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-1.5 rounded-md px-1.5 py-1 text-left',
                                        'transition-colors hover:bg-bg-card active:bg-bg-card',
                                    )}
                                >
                                    <span className="min-w-0 text-13-regular text-fg-secondary">
                                        {field.label}:{' '}
                                        <span
                                            className={cn(
                                                'text-fg-primary',
                                                field.key === 'phone' && 'tabular-nums',
                                            )}
                                        >
                                            {field.value}
                                        </span>
                                    </span>
                                    {copied ? (
                                        <Check className="size-3.5 shrink-0 text-success" />
                                    ) : (
                                        <Copy className="size-3.5 shrink-0 text-fg-tertiary" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-1 text-13-regular text-fg-secondary">
                        Банк: <span className="text-fg-primary">{PAYMENT_DETAILS.banks}</span>
                    </p>
                </div>
                <div
                    className={cn(
                        'rounded-lg border p-3',
                        closesFully ? 'border-success/30 bg-success/10' : 'border-border-low bg-bg-soft',
                    )}
                >
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-13-regular text-fg-secondary">Осталось оплатить</span>
                        {promoReduces ? (
                            <span className="flex items-baseline gap-2">
                                <span className="text-14-regular text-fg-tertiary line-through tabular-nums">
                                    {formatRub(remaining)}
                                </span>
                                <span className="text-18-semibold tabular-nums text-success">
                                    {formatRub(form.maxTransfer)}
                                </span>
                            </span>
                        ) : (
                            <span
                                className={cn(
                                    'text-18-semibold tabular-nums',
                                    closesFully ? 'text-success' : 'text-fg-primary',
                                )}
                            >
                                {formatRub(remaining)}
                            </span>
                        )}
                    </div>
                    {promoReduces && !amountValid && (
                        <div className="mt-2 flex items-start gap-1.5 border-t border-border-low pt-2 text-12-regular text-fg-secondary">
                            <span>
                                Промокод {form.appliedPromo?.code} уменьшает платёж на{' '}
                                {formatRub(remaining - form.maxTransfer)}
                            </span>
                        </div>
                    )}
                    {amountValid && (
                        <div
                            className={cn(
                                'mt-2 flex items-start gap-1.5 border-t pt-2 text-12-regular',
                                closesFully ? 'border-success/20 text-success' : 'border-border-low text-fg-secondary',
                            )}
                        >
                            {closesFully ? (
                                <>
                                    <Check className="mt-0.5 size-3.5 shrink-0" />
                                    <span>
                                        Перевод{' '}
                                        <span className="text-12-semibold tabular-nums">
                                            {formatRub(form.finalAmount)}
                                        </span>{' '}
                                        закроет остаток полностью
                                        {form.promoDiscount > 0 && ` (скидка ${formatRub(form.promoDiscount)})`}
                                    </span>
                                </>
                            ) : (
                                <span>
                                    Этот платёж{' '}
                                    <span className="text-12-semibold tabular-nums">
                                        {formatRub(form.finalAmount)}
                                    </span>{' '}
                                    · после него останется{' '}
                                    {formatRub(Math.max(remaining - form.submittedAmount, 0))}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <form onSubmit={form.handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" />
                            Промокод
                        </Label>
                        {form.appliedPromo ? (
                            <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 p-2">
                                <div className="flex items-center gap-2 text-success">
                                    <Tag className="h-4 w-4" />
                                    <span className="text-13-medium">{form.appliedPromo.code}</span>
                                    <span className="text-12-regular">
                                        {form.appliedPromo.type === 'PERCENT'
                                            ? `${form.appliedPromo.value}%`
                                            : `−${formatRub(form.appliedPromo.value)} ₽`}
                                        {form.appliedPromo.pinned && ' · закреплён за заказом'}
                                    </span>
                                </div>
                                {!form.appliedPromo.pinned && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={form.removePromo}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Введите промокод"
                                    value={form.promoInput}
                                    onChange={(e) => {
                                        form.setPromoInput(e.target.value);
                                        form.setPromoError('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void form.applyPromo();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void form.applyPromo()}
                                    disabled={!form.promoInput.trim() || form.promoLoading}
                                >
                                    {form.promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Применить'}
                                </Button>
                            </div>
                        )}
                        {form.promoError && <p className="text-12-regular text-error">{form.promoError}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Сумма перевода (₽)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            max={form.maxTransfer}
                            placeholder={`До ${formatRub(form.maxTransfer)}`}
                            value={form.amount}
                            onChange={(e) => form.setAmount(e.target.value)}
                            required
                        />
                        {form.amountError && <p className="text-12-regular text-error">{form.amountError}</p>}
                        {form.promoIssue && <p className="text-12-regular text-warning">{form.promoIssue}</p>}
                        {form.appliedPromo && form.numAmount > 0 && (
                            <div className="rounded-lg border border-success/30 bg-success/10 p-2 space-y-1">
                                <div className="flex items-center justify-between text-12-regular">
                                    <span className="text-fg-secondary">
                                        Сумма до скидки: {formatRub(form.submittedAmount)}
                                    </span>
                                    <span className="text-success">
                                        Скидка: −{formatRub(form.promoDiscount)}
                                    </span>
                                </div>
                                <p className="text-12-medium text-success">
                                    К оплате: {formatRub(form.finalAmount)}
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => form.setAmount(toAmountString(form.maxTransfer * 0.7))}
                            >
                                Оплатить 70%
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => form.setAmount(toAmountString(form.maxTransfer))}
                            >
                                Оплатить всё
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Комментарий</Label>
                        <Textarea
                            placeholder="Примечание к оплате..."
                            value={form.comment}
                            onChange={(e) => form.setComment(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>
                            Подтверждение оплаты <span className="text-error">*</span>
                        </Label>
                        {form.preview ? (
                            <div className="relative rounded-lg border-border-low p-2 bg-bg-card/70">
                                {form.fileData?.mimeType.startsWith('image/') ? (
                                    <img src={form.preview} alt="Preview" className="max-h-40 rounded mx-auto" />
                                ) : (
                                    <div className="flex items-center gap-2 p-2">
                                        <Upload className="h-4 w-4" />
                                        <span className="text-13-regular">Файл прикреплён</span>
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon-xs"
                                    onClick={form.clearFile}
                                    aria-label="Удалить файл"
                                    className="absolute -top-2 -right-2 size-6 rounded-full"
                                >
                                    <X className="size-3" />
                                </Button>
                            </div>
                        ) : (
                            <div
                                onClick={() => form.fileRef.current?.click()}
                                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-fg-secondary hover:border-primary/50 hover:text-primary transition-colors"
                            >
                                <Upload className="h-8 w-8" />
                                <span className="text-13-medium">Загрузите скриншот или документ</span>
                                <span className="text-12-regular">Обязательно · PNG, JPG, PDF до 5 МБ</span>
                            </div>
                        )}
                        <input
                            ref={form.fileRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={form.handleFile}
                            className="hidden"
                        />
                        {!form.fileData && <p className="text-12-regular text-error">Прикрепите подтверждение оплаты</p>}
                    </div>

                    {form.consentRequired && (
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-bg-soft p-3 text-13-regular text-fg-secondary">
                            <Checkbox
                                checked={form.consentChecked}
                                onCheckedChange={(v) => form.setConsentChecked(v === true)}
                            />
                            <span>
                                Я даю{' '}
                                <AppLink
                                    href="/privacy"
                                    className="text-secondary underline underline-offset-2 hover:text-primary"
                                >
                                    согласие на обработку персональных данных
                                </AppLink>
                            </span>
                        </label>
                    )}

                    <Button
                        type="submit"
                        variant="brand"
                        disabled={!form.canSubmit || form.mutation.isPending}
                        className="w-full"
                    >
                        {form.mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Отправить
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
