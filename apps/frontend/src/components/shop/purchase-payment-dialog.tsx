'use client';

import { AlertCircle, CreditCard, Loader2, Tag, Upload, X } from 'lucide-react';

import { usePaymentForm } from '@/app/shop/hooks/use-payment-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRub } from '@/lib/format/money';
import { cn } from '@/lib/utils';

export type PurchasePaymentDialogProps = {
    purchaseId: number;
    remaining: number;
    hasPending: boolean;
    paymentOpen: boolean;
    /** «button» — полная кнопка; «link» — текстовая ссылка (заказы). */
    triggerVariant?: 'button' | 'link';
    buttonClassName?: string;
    buttonSize?: 'sm' | 'default';
};

export function PurchasePaymentDialog({
    purchaseId,
    remaining,
    hasPending,
    paymentOpen,
    triggerVariant = 'button',
    buttonClassName,
    buttonSize = 'sm',
}: PurchasePaymentDialogProps) {
    const form = usePaymentForm(purchaseId, remaining);

    const payLabel = hasPending ? 'Ожидает подтверждения' : `Оплатить ${formatRub(remaining)}`;

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
                <span className="rounded-md bg-background/90 px-2 py-1 text-center text-xs font-medium text-muted-foreground shadow-sm">
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
            disabled={hasPending}
        >
            <CreditCard className="size-3.5" />
            {hasPending ? 'Ожидает подтверждения' : 'Оплатить'}
        </Button>
    ) : (
        <Button
            variant="brand"
            size={buttonSize}
            className={cn('w-full gap-2', buttonClassName)}
            onClick={() => form.handleOpenChange(true)}
            disabled={hasPending}
        >
            <CreditCard className="h-4 w-4" />
            {payLabel}
        </Button>
    );

    return (
        <Dialog open={form.open} onOpenChange={form.handleOpenChange}>
            {payButton}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Оплата — прикрепите чек</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-warning-50 p-3 flex items-center gap-2 text-warning text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                        Осталось оплатить: <strong>{formatRub(remaining)}</strong>
                    </span>
                </div>
                <form onSubmit={form.handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" />
                            Промокод
                        </Label>
                        {form.appliedPromo ? (
                            <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success-50 p-2">
                                <div className="flex items-center gap-2 text-success">
                                    <Tag className="h-4 w-4" />
                                    <span className="text-sm font-medium">{form.appliedPromo.code}</span>
                                    <span className="text-xs">−{formatRub(form.appliedPromo.discount)}</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={form.removePromo}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
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
                                    onClick={() => void form.applyPromo()}
                                    disabled={!form.promoInput.trim() || form.promoLoading}
                                >
                                    {form.promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Применить'}
                                </Button>
                            </div>
                        )}
                        {form.promoError && <p className="text-xs text-destructive">{form.promoError}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Сумма к покрытию (₽)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            max={remaining}
                            value={form.amount}
                            onChange={(e) => form.setAmount(e.target.value)}
                            required
                        />
                        {form.amountError && <p className="text-xs text-destructive">{form.amountError}</p>}
                        {form.appliedPromo && (
                            <div className="rounded-lg border border-success/30 bg-success-50 p-2 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Сумма: {formatRub(form.numAmount)}</span>
                                    <span className="text-success">
                                        Скидка: −{formatRub(form.appliedPromo.discount)}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-success">
                                    К оплате: {formatRub(form.numAmount - form.appliedPromo.discount)}
                                </p>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">Максимум: {formatRub(remaining)}</p>
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
                            Подтверждение оплаты <span className="text-destructive">*</span>
                        </Label>
                        {form.preview ? (
                            <div className="relative rounded-lg border p-2 bg-muted/50">
                                {form.fileData?.mimeType.startsWith('image/') ? (
                                    <img src={form.preview} alt="Preview" className="max-h-40 rounded mx-auto" />
                                ) : (
                                    <div className="flex items-center gap-2 p-2">
                                        <Upload className="h-4 w-4" />
                                        <span className="text-sm">Файл прикреплён</span>
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
                                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                            >
                                <Upload className="h-8 w-8" />
                                <span className="text-sm font-medium">Загрузите скриншот или документ</span>
                                <span className="text-xs">Обязательно · PNG, JPG, PDF до 5 МБ</span>
                            </div>
                        )}
                        <input
                            ref={form.fileRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={form.handleFile}
                            className="hidden"
                        />
                        {!form.fileData && <p className="text-xs text-destructive">Прикрепите подтверждение оплаты</p>}
                    </div>

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
