'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { useCreateSupplier, useUpdateSupplier } from '../hooks';

const supplierSchema = z.object({
    name: z.string().trim().min(1, 'Название обязательно'),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

export function SupplierFormDialog({
    mode,
    item,
}: {
    mode: 'create' | 'edit';
    item?: { id: number; name: string };
}) {
    const [open, setOpen] = useState(false);
    const createMutation = useCreateSupplier();
    const updateMutation = useUpdateSupplier();

    const form = useForm<SupplierFormValues>({
        resolver: zodResolver(supplierSchema),
        defaultValues: { name: item?.name ?? '' },
    });

    useEffect(() => {
        form.reset({ name: item?.name ?? '' });
    }, [item?.id, item?.name, form]);

    const isPending = createMutation.isPending || updateMutation.isPending;

    function onSubmit(values: SupplierFormValues) {
        if (mode === 'create') {
            createMutation.mutate(values, {
                onSuccess: () => {
                    setOpen(false);
                    form.reset({ name: '' });
                },
            });
        } else if (item) {
            updateMutation.mutate(
                { id: item.id, ...values },
                {
                    onSuccess: () => {
                        setOpen(false);
                    },
                },
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {mode === 'create' ? (
                    <Button size="sm" className="shrink-0">
                        Добавить поставщика
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Новый поставщик' : 'Редактировать поставщика'}</DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)();
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Input
                            id="supplierName"
                            autoFocus
                            placeholder="Поставщик №1"
                            {...form.register('name')}
                        />
                        {form.formState.errors.name && (
                            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'create' ? 'Добавить' : 'Сохранить'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

