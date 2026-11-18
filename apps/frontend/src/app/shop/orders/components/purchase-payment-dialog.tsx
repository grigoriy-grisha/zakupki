'use client';

import { roundMoney } from '@zakupki/types';
import { Check, CreditCard, ExternalLink, Loader2, QrCode, Tag, X } from 'lucide-react';

import { usePaymentForm } from '@/app/shop/hooks/use-payment-form';
import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { openExternalUrl } from '@/lib/client/open-external-url';
import { formatRub } from '@/lib/format/money';
import { SBP_MIN_TOTAL } from '@/lib/online-payment-fee';
import { exceedsMaxTransfer, type PaymentPromoInfo } from '@/lib/payment-utils';
import { cn } from '@/lib/utils';

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

    const payLabel = `Оплатить ${formatRub(remaining)}`;

    const amountValid =
        form.numAmount > 0 && !exceedsMaxTransfer(form.numAmount, form.maxTransfer) && !Number.isNaN(form.numAmount);
    const closesFully = amountValid && roundMoney(form.numAmount) === form.maxTransfer;
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
                    <DialogTitle>{form.created ? 'Осталось нажать «Оплатить»' : 'Оплата заказа'}</DialogTitle>
                </DialogHeader>
                {form.created ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-13-regular text-fg-secondary">
                            <p>
                                Сумма к оплате:{' '}
                                <span className="text-13-semibold tabular-nums text-fg-primary">
                                    {formatRub(form.created.total)}
                                </span>
                                . Нажмите кнопку ниже — откроется{' '}
                                {form.created.method === 'TBANK_SBP'
                                    ? 'выбор вашего банка'
                                    : 'страница банка, там введите данные карты'}
                                .
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="brand"
                            className="w-full gap-2"
                            onClick={() => openExternalUrl(form.created!.paymentUrl)}
                        >
                            <ExternalLink className="h-4 w-4" />
                            Оплатить {formatRub(form.created.total)}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => form.handleOpenChange(false)}
                        >
                            Закрыть
                        </Button>
                    </div>
                ) : (
                    <>
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
                                        closesFully
                                            ? 'border-success/20 text-success'
                                            : 'border-border-low text-fg-secondary',
                                    )}
                                >
                                    {closesFully ? (
                                        <>
                                            <Check className="mt-0.5 size-3.5 shrink-0" />
                                            <span>
                                                Заказ будет оплачен полностью
                                                {form.promoDiscount > 0 && ` (скидка ${formatRub(form.promoDiscount)})`}
                                            </span>
                                        </>
                                    ) : (
                                        <span>
                                            Потом останется доплатить{' '}
                                            {formatRub(Math.max(remaining - form.submittedAmount, 0))}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
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
                                                    : `−${formatRub(form.appliedPromo.value)}`}
                                                {form.appliedPromo.pinned && ' · уже применён'}
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
                                            {form.promoLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                'Применить'
                                            )}
                                        </Button>
                                    </div>
                                )}
                                {form.promoError && <p className="text-12-regular text-error">{form.promoError}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`pay-amount-${purchaseId}`}>Сколько оплатить, ₽</Label>
                                <Input
                                    id={`pay-amount-${purchaseId}`}
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
                                        <div className="flex flex-wrap items-center justify-between gap-x-3 text-12-regular">
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

                            {form.receiptRequired && (
                                <div className="space-y-2">
                                    <Label htmlFor={`pay-contact-${purchaseId}`}>Почта для чека</Label>
                                    <Input
                                        id={`pay-contact-${purchaseId}`}
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder="mail@example.ru"
                                        value={form.contactValue}
                                        onChange={(e) => form.setReceiptContact(e.target.value)}
                                    />
                                    {form.contactError ? (
                                        <p className="text-12-regular text-error">{form.contactError}</p>
                                    ) : (
                                        <p className="text-12-regular text-fg-tertiary">Сюда придёт чек об оплате</p>
                                    )}
                                </div>
                            )}

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

                            {form.config && !form.config.enabled ? (
                                <p className="rounded-lg bg-bg-soft p-3 text-13-regular text-fg-secondary">
                                    Онлайн-оплата временно недоступна. Попробуйте позже.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    <PayMethodButton
                                        icon={<CreditCard className="h-4 w-4" />}
                                        label="Картой"
                                        total={form.cardTotal}
                                        fee={form.cardFee}
                                        feePercent={form.config?.cardFeePercent ?? 0}
                                        showTotal={form.numAmount > 0 && !form.amountError}
                                        disabled={!form.canPayCard}
                                        loading={
                                            form.mutation.isPending && form.mutation.variables?.method === 'TBANK_CARD'
                                        }
                                        onClick={() => form.pay('TBANK_CARD')}
                                    />
                                    <PayMethodButton
                                        icon={<QrCode className="h-4 w-4" />}
                                        label="По СБП"
                                        total={form.sbpTotal}
                                        fee={form.sbpFee}
                                        feePercent={form.config?.sbpFeePercent ?? 0}
                                        showTotal={form.numAmount > 0 && !form.amountError}
                                        disabled={!form.canPaySbp}
                                        loading={
                                            form.mutation.isPending && form.mutation.variables?.method === 'TBANK_SBP'
                                        }
                                        onClick={() => form.pay('TBANK_SBP')}
                                    />
                                    {form.numAmount > 0 && form.sbpTotal < SBP_MIN_TOTAL && (
                                        <p className="text-12-regular text-fg-tertiary">
                                            Через приложение банка — от {formatRub(SBP_MIN_TOTAL)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

type PayMethodButtonProps = {
    icon: React.ReactNode;
    label: string;
    total: number;
    fee: number;
    feePercent: number;
    showTotal: boolean;
    disabled: boolean;
    loading: boolean;
    onClick: () => void;
};

function PayMethodButton({
    icon,
    label,
    total,
    fee,
    feePercent,
    showTotal,
    disabled,
    loading,
    onClick,
}: PayMethodButtonProps) {
    return (
        <Button
            type="button"
            variant="brand"
            disabled={disabled}
            onClick={onClick}
            className="h-auto min-h-12 w-full justify-between gap-3 py-2 text-left whitespace-normal"
        >
            <span className="flex min-w-0 items-center gap-2.5">
                {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : icon}
                <span className="flex min-w-0 flex-col leading-tight">
                    <span>{label}</span>
                    <span className="text-11-regular opacity-80">
                        {feePercent > 0
                            ? showTotal
                                ? `с комиссией банка ${formatRub(fee)}`
                                : `+ комиссия банка ${feePercent}%`
                            : 'без комиссии'}
                    </span>
                </span>
            </span>
            {showTotal && <span className="shrink-0 tabular-nums">{formatRub(total)}</span>}
        </Button>
    );
}
