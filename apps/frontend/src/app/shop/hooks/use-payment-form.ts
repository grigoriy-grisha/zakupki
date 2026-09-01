'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import { formatRub } from '@/lib/format/money';

export type AppliedPromo = {
    id: number;
    code: string;
    discount: number;
    label?: string;
};

export function usePaymentForm(purchaseId: number, remaining: number) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(String(remaining));
    const [comment, setComment] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
    const [promoError, setPromoError] = useState('');
    const [promoLoading, setPromoLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const utils = trpc.useUtils();

    const mutation = trpc.payments.submit.useMutation({
        onSuccess: () => {
            void utils.payments.getMyPayments.invalidate();
            void utils.orders.getMyOrders.invalidate();
            setOpen(false);
            setComment('');
            setPreview(null);
            setFileData(null);
            setPromoInput('');
            setAppliedPromo(null);
            toast.success('Оплата отправлена · ожидает подтверждения');
        },
        onError: (err) => toast.error(err.message),
    });

    const numAmount = Number(amount);
    const amountError = numAmount > remaining ? `Максимум ${formatRub(remaining)}` : '';
    const canSubmit = fileData && numAmount > 0 && numAmount <= remaining;

    async function applyPromo() {
        if (!promoInput.trim()) return;
        const currentAmount = Number(amount);
        if (currentAmount <= 0) {
            setPromoError('Укажите сумму');
            return;
        }
        setPromoLoading(true);
        setPromoError('');
        try {
            const result = await utils.client.promoCodes.validate.query({
                code: promoInput.trim().toUpperCase(),
                purchaseId,
                orderAmount: currentAmount,
            });
            setAppliedPromo({
                id: result.id,
                code: result.code,
                discount: result.discount,
                label: result.label ?? undefined,
            });
        } catch (err: unknown) {
            setPromoError(err instanceof Error ? err.message : 'Ошибка');
            setAppliedPromo(null);
        } finally {
            setPromoLoading(false);
        }
    }

    function removePromo() {
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
        if (v) setAmount(String(remaining));
    }

    useEffect(() => {
        if (open) setAmount(String(remaining));
    }, [open, remaining]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        mutation.mutate({
            purchaseId,
            amount: numAmount,
            userComment: comment || undefined,
            proofBase64: fileData!.base64,
            proofMimeType: fileData!.mimeType,
            promoCode: appliedPromo?.code,
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
        fileRef,
        numAmount,
        amountError,
        canSubmit,
        applyPromo,
        removePromo,
        handleFile,
        clearFile,
        handleSubmit,
        mutation,
        remaining,
    };
}
