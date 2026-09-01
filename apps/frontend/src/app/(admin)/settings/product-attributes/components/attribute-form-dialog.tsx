'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2,Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { type ProductAttributeFormValues,productAttributeSchema } from '@/app/(admin)/products/lib';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useCreateProductAttribute, useUpdateProductAttribute } from '../hooks';

interface AttributeFormDialogProps {
    typeId: number;
    typeName: string;
    mode: 'create' | 'edit';
    isBrand?: boolean;
    parentId?: number | null;
    parentName?: string;
    item?: { id: number; name: string; showInTitle?: boolean };
    trigger?: React.ReactNode;
}

export function AttributeFormDialog({
    typeId,
    typeName,
    mode,
    isBrand = false,
    parentId,
    parentName,
    item,
    trigger,
}: AttributeFormDialogProps) {
    const [open, setOpen] = useState(false);
    const [showInTitle, setShowInTitle] = useState(true);
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
            setShowInTitle(item.showInTitle !== false);
        } else if (open && mode === 'create') {
            reset({ name: '' });
            setShowInTitle(true);
        }
    }, [open, mode, item, reset]);

    function onSubmit(data: ProductAttributeFormValues) {
        if (mode === 'edit' && item) {
            updateMutation.mutate(
                {
                    id: item.id,
                    name: data.name,
                    ...(isBrand ? { showInTitle } : {}),
                },
                { onSuccess: () => setOpen(false) },
            );
        } else {
            createMutation.mutate(
                {
                    typeId,
                    name: data.name,
                    isBrand,
                    parentId: parentId ?? null,
                    ...(isBrand ? { showInTitle } : {}),
                },
                { onSuccess: () => setOpen(false) },
            );
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending;
    const isEdit = mode === 'edit' && item;

    const createTitle = isBrand
        ? `Новый бренд: ${typeName}`
        : parentName
          ? `Новое значение: ${parentName}`
          : `Новое значение: ${typeName}`;

    return (
        <>
            {trigger ? (
                <span className="contents" onClick={() => setOpen(true)}>
                    {trigger}
                </span>
            ) : isEdit ? (
                <Button type="button" variant="ghost" size="sm" className="size-8 p-0" onClick={() => setOpen(true)}>
                    <Pencil className="size-4" />
                </Button>
            ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                    <Plus className="size-4" />
                    Значение
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? `Редактировать ${isBrand ? 'бренд' : 'значение'}: ${typeName}` : createTitle}
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={handleSubmit(onSubmit, () => {
                            toast.error('Укажите название');
                        })}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                            <Label htmlFor={`attr-name-${typeId}-${mode}`}>Название</Label>
                            <Input
                                id={`attr-name-${typeId}-${mode}`}
                                placeholder={parentName ?? typeName}
                                autoFocus
                                {...register('name')}
                            />
                            {errors.name && <p className="text-12-regular text-error">{errors.name.message}</p>}
                        </div>
                        {isBrand && (
                            <label className="flex cursor-pointer items-center gap-2 text-14-regular">
                                <Checkbox checked={showInTitle} onCheckedChange={(v) => setShowInTitle(v === true)} />
                                Включать в заголовок описания
                            </label>
                        )}
                        <Button type="submit" disabled={isPending} className="w-full">
                            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {isEdit ? 'Сохранить' : 'Создать'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
