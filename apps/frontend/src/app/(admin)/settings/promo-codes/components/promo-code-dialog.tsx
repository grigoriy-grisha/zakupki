'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2,Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';

import { useCreatePromoCode } from '../hooks';
import { type PromoCodeFormValues,promoCodeSchema } from '../lib';

export function PromoCodeDialog() {
    const [open, setOpen] = useState(false);
    const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
    const createMutation = useCreatePromoCode();
    const { data: purchases } = trpc.purchases.list.useQuery({ status: 'ACTIVE' });

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<PromoCodeFormValues>({
        resolver: zodResolver(promoCodeSchema),
        defaultValues: {
            code: '',
            label: '',
            type: 'PERCENT',
            value: 0,
            purchaseId: undefined,
            maxUses: undefined,
            minAmount: undefined,
            expiresAt: undefined,
        },
    });

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (nextOpen) {
            reset({ code: '', label: '', type: 'PERCENT', value: 0 });
            setDiscountType('PERCENT');
        }
    }

    function onSubmit(data: PromoCodeFormValues) {
        createMutation.mutate(
            {
                ...data,
                code: data.code.toUpperCase().trim(),
                label: data.label || undefined,
                purchaseId: data.purchaseId || undefined,
                maxUses: data.maxUses || undefined,
                minAmount: data.minAmount || undefined,
                expiresAt: data.expiresAt || undefined,
            },
            { onSuccess: () => setOpen(false) },
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button size="sm" onClick={() => handleOpenChange(true)}>
                <Plus className="size-4" />
                Создать промокод
            </Button>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Новый промокод</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                        <p className="text-14-semibold text-fg-secondary">Основное</p>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label>Код промокода</Label>
                                <Input
                                    placeholder="SALE10"
                                    className="font-mono text-18-semibold tracking-widest h-11"
                                    {...register('code', {
                                        onChange: (e) => (e.target.value = e.target.value.toUpperCase()),
                                    })}
                                />
                                {errors.code && <p className="text-12-regular text-error">{errors.code.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Описание</Label>
                                <Input placeholder="Скидка 10% на первую закупку" {...register('label')} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-14-semibold text-fg-secondary">Скидка</p>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={discountType === 'PERCENT' ? 'default' : 'outline'}
                                    className="flex-1 h-10"
                                    onClick={() => {
                                        setDiscountType('PERCENT');
                                        setValue('type', 'PERCENT');
                                    }}
                                >
                                    Процент
                                </Button>
                                <Button
                                    type="button"
                                    variant={discountType === 'FIXED' ? 'default' : 'outline'}
                                    className="flex-1 h-10"
                                    onClick={() => {
                                        setDiscountType('FIXED');
                                        setValue('type', 'FIXED');
                                    }}
                                >
                                    Фиксированная сумма
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Label>{discountType === 'PERCENT' ? 'Размер скидки (%)' : 'Размер скидки (₽)'}</Label>
                                <Input
                                    type="number"
                                    step={discountType === 'PERCENT' ? '1' : '0.01'}
                                    placeholder={discountType === 'PERCENT' ? '10' : '500'}
                                    className="h-11"
                                    {...register('value', { valueAsNumber: true })}
                                />
                                {errors.value && <p className="text-12-regular text-error">{errors.value.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-14-semibold text-fg-secondary">Ограничения</p>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label>Закупка</Label>
                                <Select
                                    onValueChange={(v) => setValue('purchaseId', v === 'all' ? undefined : Number(v))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Любая закупка" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Любая закупка</SelectItem>
                                        {purchases?.map((p) => (
                                            <SelectItem key={p.id} value={String(p.id)}>
                                                {p.tag}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Макс. использований</Label>
                                    <Input
                                        type="number"
                                        placeholder="Безлимит"
                                        {...register('maxUses', {
                                            setValueAs: (v) =>
                                                v === '' || v === null || Number.isNaN(v)
                                                    ? undefined
                                                    : Number(v),
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Мин. сумма (₽)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Без минимума"
                                        {...register('minAmount', {
                                            setValueAs: (v) =>
                                                v === '' || v === null || Number.isNaN(v)
                                                    ? undefined
                                                    : Number(v),
                                        })}
                                    />
                                </div>
                            </div>

                            <PromoCodeDatePicker onChange={(date) => setValue('expiresAt', date?.toISOString())} />
                        </div>
                    </div>

                    <Button type="submit" size="lg" disabled={createMutation.isPending} className="w-full">
                        {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                        Создать промокод
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PromoCodeDatePicker({ onChange }: { onChange: (date: Date | undefined) => void }) {
    const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);

    return (
        <div className="space-y-2">
            <Label>Действует до</Label>
            <DatePicker
                value={expiresAt}
                onChange={(date) => {
                    setExpiresAt(date);
                    onChange(date);
                }}
                placeholder="Бессрочно"
            />
        </div>
    );
}
