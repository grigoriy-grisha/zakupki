'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    productAttributeSchema,
    type ProductAttributeFormValues,
    type ProductAttributeKind,
    PRODUCT_ATTRIBUTE_KIND_LABELS,
} from '@/app/(admin)/products/lib/schema';
import { useCreateProductAttribute, useUpdateProductAttribute } from '../hooks';

interface AttributeFormDialogProps {
    kind: ProductAttributeKind;
    mode: 'create' | 'edit';
    item?: { id: number; name: string };
}

export function AttributeFormDialog({ kind, mode, item }: AttributeFormDialogProps) {
    const [open, setOpen] = useState(false);
    const createMutation = useCreateProductAttribute();
    const updateMutation = useUpdateProductAttribute();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProductAttributeFormValues>({
        resolver: zodResolver(productAttributeSchema),
        defaultValues: { name: '' },
    });

    useEffect(() => {
        if (open && mode === 'edit' && item) {
            reset({ name: item.name });
        } else if (open && mode === 'create') {
            reset({ name: '' });
        }
    }, [open, mode, item, reset]);

    function onSubmit(data: ProductAttributeFormValues) {
        if (mode === 'edit' && item) {
            updateMutation.mutate(
                { id: item.id, name: data.name },
                { onSuccess: () => setOpen(false) },
            );
        } else {
            createMutation.mutate(
                { kind, name: data.name },
                { onSuccess: () => setOpen(false) },
            );
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending;
    const isEdit = mode === 'edit' && item;
    const kindLabel = PRODUCT_ATTRIBUTE_KIND_LABELS[kind];

    return (
        <>
            {isEdit ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setOpen(true)}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            ) : (
                <Button type="button" size="sm" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Добавить
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? `Редактировать: ${kindLabel}` : `Новый: ${kindLabel}`}
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={handleSubmit(onSubmit, () => {
                            toast.error('Укажите название');
                        })}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                            <Label htmlFor={`attr-name-${kind}-${mode}`}>Название</Label>
                            <Input
                                id={`attr-name-${kind}-${mode}`}
                                placeholder={kindLabel}
                                autoFocus
                                {...register('name')}
                            />
                            {errors.name && (
                                <p className="text-xs text-destructive">{errors.name.message}</p>
                            )}
                        </div>
                        <Button type="submit" disabled={isPending} className="w-full">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEdit ? 'Сохранить' : 'Создать'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
