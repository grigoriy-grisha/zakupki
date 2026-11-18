'use client';

import { computePromoDiscount, roundMoney } from '@zakupki/types';
import { useState } from 'react';
import { toast } from 'sonner';

import { canRedirectWithoutGesture } from '@/lib/client/open-external-url';
import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import { computeOnlineFee, SBP_MIN_TOTAL } from '@/lib/online-payment-fee';
import type { PaymentPromoInfo } from '@/lib/payment-utils';
import { computeMaxTransfer, computeSubmittedAmount, exceedsMaxTransfer } from '@/lib/payment-utils';

export type AppliedPromo = PaymentPromoInfo & { pinned?: boolean };

export type OnlineMethod = 'TBANK_CARD' | 'TBANK_SBP';

type CreatedPayment = {
    paymentUrl: string;
    method: OnlineMethod;
    total: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidReceiptContact(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    if (v.includes('@')) return EMAIL_RE.test(v);
    const digits = v.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

export function usePaymentForm(purchaseId: number, available: number, due: number, pinnedPromo?: PaymentPromoInfo) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(
        pinnedPromo ? { ...pinnedPromo, pinned: true } : null,
    );
    const [promoError, setPromoError] = useState('');
    const [promoLoading, setPromoLoading] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [receiptContact, setReceiptContact] = useState<string | null>(null);
    const [created, setCreated] = useState<CreatedPayment | null>(null);
    const utils = trpc.useUtils();

    const { data: consent } = trpc.users.myConsent.useQuery(undefined, { enabled: open });
    const { data: config } = trpc.payments.onlineConfig.useQuery(undefined, { enabled: open });

    const contactValue = receiptContact ?? config?.receiptContact ?? '';

    const mutation = trpc.payments.createOnline.useMutation({
        onSuccess: (result, variables) => {
            // Список оплат обновляем при закрытии окна: новая AWAITING-оплата перестраивает
            // блок оплаты, и окно со ссылкой размонтировалось бы сразу после создания.
            void utils.users.myConsent.invalidate();
            void utils.payments.onlineConfig.invalidate();
            setCreated({ paymentUrl: result.paymentUrl, method: variables.method, total: result.total });
            if (canRedirectWithoutGesture()) {
                window.location.assign(result.paymentUrl);
            }
        },
        onError: (err) => toast.error(err.message),
    });

    const consentRequired = consent != null && !consent.accepted;
    const numAmount = Number(amount);
    const submittedAmount = computeSubmittedAmount(numAmount, available, appliedPromo);
    const promoActive =
        appliedPromo != null &&
        numAmount > 0 &&
        (appliedPromo.minAmount == null || submittedAmount >= appliedPromo.minAmount);
    const promoIssue =
        appliedPromo && numAmount > 0 && !promoActive
            ? `Промокод ${appliedPromo.code} не действует: минимальная сумма ${formatRub(appliedPromo.minAmount ?? 0)}`
            : '';
    const promoDiscount = promoActive
        ? computePromoDiscount(appliedPromo.type, appliedPromo.value, submittedAmount)
        : 0;
    const finalAmount = roundMoney(submittedAmount - promoDiscount);
    const maxTransfer = computeMaxTransfer(available, appliedPromo);
    const exceedsMax = exceedsMaxTransfer(numAmount, maxTransfer);
    const amountError = exceedsMax ? `Максимум ${formatRub(maxTransfer)}` : '';

    const cardFee = computeOnlineFee(finalAmount, config?.cardFeePercent ?? 0);
    const sbpFee = computeOnlineFee(finalAmount, config?.sbpFeePercent ?? 0);
    const cardTotal = roundMoney(finalAmount + cardFee);
    const sbpTotal = roundMoney(finalAmount + sbpFee);

    const receiptRequired = config?.receiptEnabled ?? false;
    const contactError =
        receiptRequired && contactValue.trim() && !isValidReceiptContact(contactValue)
            ? 'Введите email или номер телефона'
            : '';

    const baseReady =
        config?.enabled === true &&
        numAmount > 0 &&
        !exceedsMax &&
        !promoIssue &&
        (!consentRequired || consentChecked) &&
        (!receiptRequired || isValidReceiptContact(contactValue)) &&
        !mutation.isPending;
    const canPayCard = baseReady && cardTotal >= 1;
    const canPaySbp = baseReady && sbpTotal >= SBP_MIN_TOTAL;

    async function applyPromo() {
        if (appliedPromo?.pinned || !promoInput.trim()) return;
        setPromoLoading(true);
        setPromoError('');
        try {
            const result = await utils.client.promoCodes.validate.query({
                code: promoInput.trim().toUpperCase(),
                purchaseId,
                orderAmount: due,
            });
            setAppliedPromo({
                id: result.id,
                code: result.code,
                type: result.type,
                value: result.value,
                minAmount: result.minAmount,
            });
        } catch (err: unknown) {
            setPromoError(err instanceof Error ? err.message : 'Ошибка');
            setAppliedPromo(null);
        } finally {
            setPromoLoading(false);
        }
    }

    function removePromo() {
        if (appliedPromo?.pinned) return;
        setAppliedPromo(null);
        setPromoInput('');
        setPromoError('');
    }

    function handleOpenChange(v: boolean) {
        setOpen(v);
        if (!v && created) {
            void utils.payments.getMyPayments.invalidate();
            void utils.orders.getMyOrders.invalidate();
        }
        if (v) {
            setAmount('');
            setCreated(null);
            // Остаток фиксированного промокода меняется после каждой оплаты — берём актуальный.
            setAppliedPromo((prev) => (pinnedPromo ? { ...pinnedPromo, pinned: true } : prev?.pinned ? null : prev));
        }
    }

    function pay(method: OnlineMethod) {
        if (method === 'TBANK_CARD' ? !canPayCard : !canPaySbp) return;
        mutation.mutate({
            purchaseId,
            amount: submittedAmount,
            method,
            promoCode: appliedPromo?.code,
            receiptContact: receiptRequired ? contactValue.trim() : undefined,
            consentAccepted: consentRequired ? consentChecked : undefined,
        });
    }

    return {
        open,
        handleOpenChange,
        config,
        amount,
        setAmount,
        promoInput,
        setPromoInput,
        appliedPromo,
        promoError,
        setPromoError,
        promoLoading,
        promoIssue,
        promoDiscount,
        finalAmount,
        numAmount,
        submittedAmount,
        amountError,
        maxTransfer,
        applyPromo,
        removePromo,
        cardFee,
        sbpFee,
        cardTotal,
        sbpTotal,
        canPayCard,
        canPaySbp,
        receiptRequired,
        contactValue,
        setReceiptContact,
        contactError,
        pay,
        created,
        setCreated,
        mutation,
        consentRequired,
        consentChecked,
        setConsentChecked,
    };
}
