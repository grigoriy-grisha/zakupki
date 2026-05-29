'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { useCreateCharacteristic, useUpdateCharacteristic } from '../hooks';
import { characteristicSchema, type CharacteristicFormValues } from '../lib';

interface CharacteristicFormDialogProps {
    mode: 'create' | 'edit';
    item?: { id: number; name: string };
}

export function CharacteristicFormDialog({ mode, item }: CharacteristicFormDialogProps) {
    const [open, setOpen] = useState(false);
    const createMutation = useCreateCharacteristic();
    const updateMutation = useUpdateCharacteristic();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CharacteristicFormValues>({
        resolver: zodResolver(characteristicSchema),
        defaultValues: { name: '' },
    });

    useEffect(() => {
        if (open && mode === 'edit' && item) {
            reset({ name: item.name });
        } else if (open && mode === 'create') {
            reset({ name: '' });
        }
    }, [open, mode, item, reset]);

    function onSubmit(data: CharacteristicFormValues) {
        if (mode === 'edit' && item) {
            updateMutation.mutate({ id: item.id, name: data.name }, { onSuccess: () => setOpen(false) });
        } else {
            createMutation.mutate(data, { onSuccess: () => setOpen(false) });
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending;
    const isEdit = mode === 'edit' && item;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {isEdit ? (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(true)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            ) : (
                <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Добавить
                </Button>
            )}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Редактировать характеристику' : 'Новая характеристика'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Название</Label>
                        <Input {...register('name')} autoFocus />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Например: Цвет, Размер, Длина, Упаковка, Страна производитель.
                    </p>
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? 'Сохранить' : 'Создать'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
