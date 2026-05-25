'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, Upload, Loader2, X, AlertCircle, Tag } from 'lucide-react';
import { toast } from 'sonner';

import type { PaymentDialogProps } from '../../../../lib/types';

export function PaymentDialog({ purchaseId, remaining, hasPending }: PaymentDialogProps) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(String(remaining));
    const [comment, setComment] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<{ id: number; code: string; discount: number; label?: string } | null>(null);
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
            toast.success('Оплата отправлена');
        },
        onError: (err) => toast.error(err.message),
    });

    const numAmount = Number(amount);
    const amountError = numAmount > remaining ? `Максимум ${remaining.toLocaleString('ru-RU')} ₽` : '';
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
            setAppliedPromo({ id: result.id, code: result.code, discount: result.discount, label: result.label ?? undefined });
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

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setAmount(String(remaining)); }}>
            <Button size="sm" className="w-full" onClick={() => setOpen(true)} disabled={hasPending}>
                <CreditCard className="h-4 w-4" />
                {hasPending ? 'Ожидает подтверждения' : `Оплатить ${remaining.toLocaleString('ru-RU')} ₽`}
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Сообщить об оплате</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-warning-50 p-3 flex items-center gap-2 text-warning text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Осталось оплатить: <strong>{remaining.toLocaleString('ru-RU')} ₽</strong></span>
                </div>
                <form
                    onSubmit={(e) => {
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
                    }}
                    className="space-y-4"
                >
                    {/* Promo code */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" />
                            Промокод
                        </Label>
                        {appliedPromo ? (
                            <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success-50 p-2">
                                <div className="flex items-center gap-2 text-success">
                                    <Tag className="h-4 w-4" />
                                    <span className="text-sm font-medium">{appliedPromo.code}</span>
                                    <span className="text-xs">−{appliedPromo.discount.toLocaleString('ru-RU')} ₽</span>
                                </div>
                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={removePromo}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Введите промокод"
                                    value={promoInput}
                                    onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }}
                                />
                                <Button type="button" variant="outline" onClick={applyPromo} disabled={!promoInput.trim() || promoLoading}>
                                    {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Применить'}
                                </Button>
                            </div>
                        )}
                        {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Сумма к покрытию (₽)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            max={remaining}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                        {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                        {appliedPromo && (
                            <div className="rounded-lg border border-success/30 bg-success-50 p-2 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Сумма: {numAmount.toLocaleString('ru-RU')} ₽</span>
                                    <span className="text-success">Скидка: −{appliedPromo.discount.toLocaleString('ru-RU')} ₽</span>
                                </div>
                                <p className="text-xs font-medium text-success">
                                    К оплате: {(numAmount - appliedPromo.discount).toLocaleString('ru-RU')} ₽
                                </p>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Максимум: {remaining.toLocaleString('ru-RU')} ₽
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>Комментарий</Label>
                        <Textarea placeholder="Примечание к оплате..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            Подтверждение оплаты <span className="text-destructive">*</span>
                        </Label>
                        {preview ? (
                            <div className="relative rounded-lg border p-2 bg-muted/50">
                                {fileData?.mimeType.startsWith('image/') ? (
                                    <img src={preview} alt="Preview" className="max-h-40 rounded mx-auto" />
                                ) : (
                                    <div className="flex items-center gap-2 p-2">
                                        <Upload className="h-4 w-4" />
                                        <span className="text-sm">Файл прикреплён</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={clearFile}
                                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                            >
                                <Upload className="h-8 w-8" />
                                <span className="text-sm font-medium">Загрузите скриншот или документ</span>
                                <span className="text-xs">Обязательно · PNG, JPG, PDF до 5 МБ</span>
                            </div>
                        )}
                        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
                        {!fileData && (
                            <p className="text-xs text-destructive">Прикрепите подтверждение оплаты</p>
                        )}
                    </div>
                    <Button type="submit" disabled={!canSubmit || mutation.isPending} className="w-full">
                        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Отправить
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
