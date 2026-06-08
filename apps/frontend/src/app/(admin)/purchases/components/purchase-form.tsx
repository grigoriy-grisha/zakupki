'use client';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { newPurchaseSchema, type NewPurchaseValues } from '../lib';

export function PurchaseForm() {
    const router = useAppRouter();

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<NewPurchaseValues>({
        resolver: zodResolver(newPurchaseSchema),
        defaultValues: { tag: '', supplier: '', minAmount: undefined, deadline: undefined },
    });

    const deadline = watch('deadline');

    const createMutation = trpc.purchases.create.useMutation({
        onSuccess: (data) => {
            toast.success('Закупка создана');
            reset();
            router.push(`/purchases/${data.id}`);
        },
        onError: (err) => toast.error(err.message),
    });

    function onSubmit(values: NewPurchaseValues) {
        createMutation.mutate({
            tag: values.tag,
            supplier: values.supplier,
            minAmount: values.minAmount,
            deadline: values.deadline.toISOString(),
        });
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="tag">Тег</Label>
                <Input id="tag" placeholder="#СЗ10" {...register('tag')} />
                <p className="text-xs text-muted-foreground">
                    Уникальный идентификатор закупки (например #СЗ11). Нельзя повторить уже существующий тег.
                </p>
                {errors.tag && <p className="text-xs text-destructive">{errors.tag.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="supplier">Поставщик</Label>
                <Input id="supplier" placeholder="Поставщик №1" {...register('supplier')} />
                {errors.supplier && <p className="text-xs text-destructive">{errors.supplier.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="minAmount">Мин. сумма (₽)</Label>
                    <Input
                        id="minAmount"
                        type="number"
                        step="0.01"
                        placeholder="10000"
                        {...register('minAmount', { valueAsNumber: true })}
                    />
                    {errors.minAmount && <p className="text-xs text-destructive">{errors.minAmount.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Дедлайн</Label>
                    <DatePicker
                        value={deadline}
                        onChange={(d) => {
                            if (d) setValue('deadline', d, { shouldValidate: true });
                        }}
                        placeholder="Выберите дату"
                    />
                    {errors.deadline && <p className="text-xs text-destructive">{errors.deadline.message}</p>}
                </div>
            </div>

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать закупку
            </Button>
        </form>
    );
}
