'use client';

import { computePromoDiscount } from '@zakupki/types';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';
import type { PaymentPromoInfo } from '@/lib/payment-utils';
import { computeMaxTransfer, computeSubmittedAmount, exceedsMaxTransfer } from '@/lib/payment-utils';

export type AppliedPromo = PaymentPromoInfo & { pinned?: boolean };

export function usePaymentForm(purchaseId: number, available: number, due: number, pinnedPromo?: PaymentPromoInfo) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(
        pinnedPromo ? { ...pinnedPromo, pinned: true } : null,
    );
    const [promoError, setPromoError] = useState('');
    const [promoLoading, setPromoLoading] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const utils = trpc.useUtils();

    const { data: consent } = trpc.users.myConsent.useQuery(undefined, { enabled: open });

    const mutation = trpc.payments.submit.useMutation({
        onSuccess: () => {
            void utils.payments.getMyPayments.invalidate();
            void utils.orders.getMyOrders.invalidate();
            void utils.users.myConsent.invalidate();
            setOpen(false);
            setComment('');
            setPreview(null);
            setFileData(null);
            setPromoInput('');
            setAppliedPromo(pinnedPromo ? { ...pinnedPromo, pinned: true } : null);
            setConsentChecked(false);
            toast.success('Оплата отправлена · ожидает подтверждения');
        },
        onError: (err) => toast.error(err.message),
    });

    const consentRequired = consent != null && !consent.accepted;
    const numAmount = Number(amount);
    const submittedAmount = computeSubmittedAmount(numAmount, available, appliedPromo);
    const promoActive =
        appliedPromo != null && numAmount > 0 && (appliedPromo.minAmount == null || submittedAmount >= appliedPromo.minAmount);
    const promoIssue =
        appliedPromo && numAmount > 0 && !promoActive
            ? `Промокод ${appliedPromo.code} не действует: минимальная сумма ${formatRub(appliedPromo.minAmount ?? 0)}`
            : '';
    const promoDiscount = promoActive ? computePromoDiscount(appliedPromo.type, appliedPromo.value, submittedAmount) : 0;
    const finalAmount = submittedAmount - promoDiscount;
    const maxTransfer = computeMaxTransfer(available, appliedPromo);
    const exceedsMax = exceedsMaxTransfer(numAmount, maxTransfer);
    const amountError = exceedsMax ? `Максимум ${formatRub(maxTransfer)}` : '';
    const canSubmit =
        fileData && numAmount > 0 && !exceedsMax && !promoIssue && (!consentRequired || consentChecked);

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

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Файл слишком большой (макс 5 МБ)');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setFileData({ base64, mimeType: file.type });
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }

    function clearFile() {
        setFileData(null);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
    }

    function handleOpenChange(v: boolean) {
        setOpen(v);
        if (v) setAmount('');
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        mutation.mutate({
            purchaseId,
            amount: submittedAmount,
            userComment: comment || undefined,
            proofBase64: fileData!.base64,
            proofMimeType: fileData!.mimeType,
            promoCode: appliedPromo?.code,
            consentAccepted: consentRequired ? consentChecked : undefined,
        });
    }

    return {
        open,
        handleOpenChange,
        amount,
        setAmount,
        comment,
        setComment,
        preview,
        fileData,
        promoInput,
        setPromoInput,
        appliedPromo,
        promoError,
        setPromoError,
        promoLoading,
        promoIssue,
        promoDiscount,
        finalAmount,
        fileRef,
        numAmount,
        submittedAmount,
        amountError,
        canSubmit,
        maxTransfer,
        applyPromo,
        removePromo,
        handleFile,
        clearFile,
        handleSubmit,
        mutation,
        consentRequired,
        consentChecked,
        setConsentChecked,
    };
}
