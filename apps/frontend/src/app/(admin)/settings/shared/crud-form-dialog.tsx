'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useForm, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodSchema } from 'zod';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Конфигурация поля формы.
 */
export interface FormFieldConfig {
    name: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'number';
    hint?: ReactNode;
}

/**
 * Пропсы для CrudFormDialog.
 */
export interface CrudFormDialogProps<T extends FieldValues> {
    mode: 'create' | 'edit';
    item?: T & { id: number };
    fields: FormFieldConfig[];
    schema: ZodSchema<T>;
    defaultValues: T;
    createTitle: string;
    editTitle: string;
    createButtonLabel?: string;
    createMutation: {
        mutate: (data: T, opts?: { onSuccess?: () => void }) => void;
        isPending: boolean;
    };
    updateMutation: {
        mutate: (data: { id: number } & Partial<T>, opts?: { onSuccess?: () => void }) => void;
        isPending: boolean;
    };
}

/**
 * Универсальный диалог для CRUD операций.
 * Устраняет дублирование диалогов создания/редактирования.
 */
export function CrudFormDialog<T extends FieldValues>({
    mode,
    item,
    fields,
    schema,
    defaultValues,
    createTitle,
    editTitle,
    createButtonLabel,
    createMutation,
    updateMutation,
}: CrudFormDialogProps<T>) {
    const [open, setOpen] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<T>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(schema as any) as never,
        defaultValues: defaultValues as never,
    });

    useEffect(() => {
        if (open && mode === 'edit' && item) {
            reset(item);
        } else if (open && mode === 'create') {
            reset(defaultValues);
        }
    }, [open, mode, item, reset, defaultValues]);

    function onSubmit(data: T) {
        if (mode === 'edit' && item) {
            updateMutation.mutate({ id: item.id, ...data } as { id: number } & Partial<T>, {
                onSuccess: () => setOpen(false),
            });
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
                    {createButtonLabel ?? 'Добавить'}
                </Button>
            )}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? editTitle : createTitle}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {fields.map((field) => (
                        <div key={field.name} className="space-y-2">
                            <Label>{field.label}</Label>
                            <Input
                                {...register(field.name as Path<T>)}
                                type={field.type ?? 'text'}
                                placeholder={field.placeholder}
                                autoFocus
                            />
                            {errors[field.name as Path<T>] && (
                                <p className="text-xs text-destructive">
                                    {String(errors[field.name as Path<T>]?.message ?? '')}
                                </p>
                            )}
                        </div>
                    ))}
                    {fields[0]?.hint && <p className="text-xs text-muted-foreground">{fields[0].hint}</p>}
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending && <span className="mr-2">⏳</span>}
                        {isEdit ? 'Сохранить' : 'Создать'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
