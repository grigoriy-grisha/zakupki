'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { useCreateUnit, useUpdateUnit } from '../hooks';
import { unitSchema, type UnitFormValues } from '../lib';
import type { UnitFormDialogProps } from '../../../lib/types';

export function UnitFormDialog({ mode, unit }: UnitFormDialogProps) {
    const [open, setOpen] = useState(false);
    const createMutation = useCreateUnit();
    const updateMutation = useUpdateUnit();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<UnitFormValues>({
        resolver: zodResolver(unitSchema),
        defaultValues: { name: '', shortName: '', multiplicity: 1 },
    });

    useEffect(() => {
        if (open && mode === 'edit' && unit) {
            reset({
                name: unit.name,
                shortName: unit.shortName,
                multiplicity: Number(unit.multiplicity),
            });
        } else if (open && mode === 'create') {
            reset({ name: '', shortName: '', multiplicity: 1 });
        }
    }, [open, mode, unit, reset]);

    function onSubmit(data: UnitFormValues) {
        if (mode === 'edit' && unit) {
            updateMutation.mutate({ id: unit.id, ...data }, { onSuccess: () => setOpen(false) });
        } else {
            createMutation.mutate(data, { onSuccess: () => setOpen(false) });
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending;
    const isEdit = mode === 'edit' && unit;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {isEdit ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setOpen(true)}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            ) : (
                <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Добавить единицу
                </Button>
            )}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Редактировать единицу' : 'Новая единица'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Название</Label>
                        <Input placeholder="Граммы" {...register('name')} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Краткое название</Label>
                        <Input placeholder="г" {...register('shortName')} />
                        {errors.shortName && <p className="text-xs text-destructive">{errors.shortName.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Кратность (шаг заказа)</Label>
                        <Input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="5"
                            {...register('multiplicity', { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Минимальный шаг при заказе. Например, 5 = можно заказать 5, 10, 15...
                        </p>
                        {errors.multiplicity && <p className="text-xs text-destructive">{errors.multiplicity.message}</p>}
                    </div>
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isEdit ? 'Сохранить' : 'Создать'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
