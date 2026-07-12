'use client';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { newPurchaseSchema, type NewPurchaseValues } from '../lib';

export function PurchaseForm() {
    const router = useAppRouter();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<NewPurchaseValues>({
        resolver: zodResolver(newPurchaseSchema),
        defaultValues: { tag: '' },
    });

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

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать закупку
            </Button>
        </form>
    );
}
