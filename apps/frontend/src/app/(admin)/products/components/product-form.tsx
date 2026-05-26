'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { productSchema, type ProductFormValues } from '../lib';
import { useUnits, useCreateProduct, useUpdateProduct, useDeletePhoto } from '../hooks';
import { PhotoUploader } from './photo-uploader';
import type { ProductFormProps } from '../../lib/types';
import { trpc } from '@/lib/client/trpc';

function sanitizeDescription(html: string | undefined | null): string | undefined {
    if (!html) return undefined;
    const stripped = html
        .replace(/<p>\s*<\/p>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
    return stripped.length === 0 ? undefined : html.trim();
}

export function ProductForm({ editId, existing, onSuccess, defaultCategoryId }: ProductFormProps & { defaultCategoryId?: number | null }) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const { data: units } = useUnits(true);
    const { data: categories } = trpc.categories.list.useQuery();
    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();
    const deletePhotoMutation = useDeletePhoto();

    const {
        control,
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: { name: '', unitId: units?.[0]?.id ?? 0, pricePerUnit: 0, categoryId: defaultCategoryId ?? null },
    });

    const currentUnitId = watch('unitId');

    useEffect(() => {
        if (existing && editId) {
            reset({
                name: existing.name,
                description: existing.description ?? '',
                unitId: existing.unitId,
                pricePerUnit: Number(existing.pricePerUnit),
                brand: existing.brand ?? '',
                sku: existing.sku ?? '',
                categoryId: existing.categoryId ?? null,
            });
            setPhotoIds(existing.photos.map((p) => p.id));
        } else if (!editId) {
            reset({
                name: '',
                unitId: units?.[0]?.id ?? 0,
                pricePerUnit: 0,
                description: '',
                brand: '',
                sku: '',
                categoryId: defaultCategoryId ?? null,
            });
            setPhotoIds([]);
        }
    }, [existing, editId, reset, units]);

    async function onSubmit(data: ProductFormValues) {
        const cleanedDescription = sanitizeDescription(data.description);
        const cleaned = {
            ...data,
            sku: data.sku?.trim() || undefined,
            brand: data.brand?.trim() || undefined,
            description: cleanedDescription,
        };
        if (editId) {
            await updateMutation.mutateAsync({ id: editId, ...cleaned });
        } else {
            const result = await createMutation.mutateAsync(cleaned);
            // After creation, prompt to reload with new ID for photo upload
            if (photoIds.length === 0) {
                toast.info('Товар создан. Теперь можно загрузить фото.');
            }
            // Return the new product id so the sheet can switch to edit mode
            return result.id;
        }
        onSuccess();
        return undefined;
    }

    // Wrapper for handleSubmit that also handles create-and-switch
    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        handleSubmit(async (data) => {
            const newId = await onSubmit(data);
            if (newId) {
                // For create: we need to let the parent know to switch to edit mode
                onSuccess();
            }
        })();
    }

    const isPending = createMutation.isPending || updateMutation.isPending;

    async function handleDeletePhoto(id: number) {
        await deletePhotoMutation.mutateAsync({ id });
    }

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 px-4">
            <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Controller
                    control={control}
                    name="description"
                    render={({ field }) => (
                        <NovelEditor
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Опишите товар..."
                        />
                    )}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="brand">Бренд</Label>
                <Input id="brand" {...register('brand')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pricePerUnit">Цена за единицу (₽)</Label>
                    <Input id="pricePerUnit" type="number" step="0.01" {...register('pricePerUnit', { valueAsNumber: true })} />
                    {errors.pricePerUnit && (
                        <p className="text-xs text-destructive">{errors.pricePerUnit.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Единица</Label>
                    <Select value={String(currentUnitId)} onValueChange={(v) => setValue('unitId', Number(v))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Выберите..." />
                        </SelectTrigger>
                        <SelectContent>
                            {units?.map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                    {u.name} ({u.shortName})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.unitId && (
                        <p className="text-xs text-destructive">{errors.unitId.message}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...register('sku')} />
            </div>

            <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                    value={watch('categoryId') ? String(watch('categoryId')) : 'none'}
                    onValueChange={(v) => setValue('categoryId', v === 'none' ? null : Number(v))}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Без категории" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Без категории</SelectItem>
                        {categories?.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Photos — only in edit mode */}
            {editId && (
                <PhotoUploader
                    photoIds={photoIds}
                    onPhotoIdsChange={setPhotoIds}
                    productId={editId}
                    onDeletePhoto={handleDeletePhoto}
                />
            )}

            <SheetFooter>
                <Button type="submit" disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editId ? 'Сохранить' : 'Создать'}
                </Button>
            </SheetFooter>
        </form>
    );
}
