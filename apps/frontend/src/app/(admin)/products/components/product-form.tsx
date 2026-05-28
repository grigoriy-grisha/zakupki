'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';

import { productCreateSchema, type ProductCreateFormValues } from '../lib';
import { useCreateProduct, useDeletePhoto, useUpdateProduct } from '../hooks';
import { PhotoUploader } from './photo-uploader';
import { ProductAttributeSelect } from './product-attribute-select';
import type { ProductAttributeKind } from '../lib/schema';

interface ProductFormProps {
    editId: number | null;
    existing:
        | {
              name: string;
              articleNumber: string | null;
              categoryId: number | null;
              manufacturerId: number | null;
              sizeId: number | null;
              formId: number | null;
              productLineId: number | null;
              photos: { id: number }[];
          }
        | null
        | undefined;
    onSuccess: () => void;
}

export function ProductForm({
    editId,
    existing,
    onSuccess,
    defaultCategoryId,
}: ProductFormProps & { defaultCategoryId?: number | null }) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([]);
    const utils = trpc.useUtils();
    const { data: categories } = trpc.categories.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();
    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();
    const deletePhotoMutation = useDeletePhoto();

    const isCreating = !editId;

    const form = useForm<ProductCreateFormValues>({
        resolver: zodResolver(productCreateSchema),
        defaultValues: {
            name: '',
            articleNumber: '',
            categoryId: defaultCategoryId ?? null,
            manufacturerId: null,
            sizeId: null,
            formId: null,
            productLineId: null,
        },
    });

    const currentCategoryId = form.watch('categoryId');
    const attrsByKind = useMemo(() => groupAttributesByKind(allAttributes), [allAttributes]);

    useEffect(() => {
        if (existing && editId) {
            form.reset({
                name: existing.name,
                articleNumber: existing.articleNumber ?? '',
                categoryId: existing.categoryId ?? null,
                manufacturerId: existing.manufacturerId ?? null,
                sizeId: existing.sizeId ?? null,
                formId: existing.formId ?? null,
                productLineId: existing.productLineId ?? null,
            });
            setPhotoIds(existing.photos.map((p) => p.id));
            setPendingFiles([]);
        } else if (!editId) {
            form.reset({
                name: '',
                articleNumber: '',
                categoryId: defaultCategoryId ?? null,
                manufacturerId: null,
                sizeId: null,
                formId: null,
                productLineId: null,
            });
            setPhotoIds([]);
            setPendingFiles([]);
        }
    }, [existing, editId, form, defaultCategoryId]);

    function catalogPayload(data: ProductCreateFormValues, mode: 'create' | 'update') {
        const opt = (id: number | null) => (mode === 'create' ? (id ?? undefined) : id);
        return {
            name: data.name,
            articleNumber: data.articleNumber?.trim() || null,
            categoryId: mode === 'create' ? (data.categoryId ?? undefined) : data.categoryId,
            manufacturerId: opt(data.manufacturerId),
            sizeId: opt(data.sizeId),
            formId: opt(data.formId),
            productLineId: opt(data.productLineId),
        };
    }

    async function handleCreate(data: ProductCreateFormValues) {
        try {
            const result = await createMutation.mutateAsync(catalogPayload(data, 'create'));
            await utils.products.list.invalidate();

            if (pendingFiles.length > 0) {
                for (let i = 0; i < pendingFiles.length; i++) {
                    const formData = new FormData();
                    formData.append('file', pendingFiles[i].file);
                    formData.append('productId', String(result.id));
                    formData.append('sortOrder', String(i));
                    try {
                        const res = await fetch('/api/upload', { method: 'POST', body: formData });
                        if (res.ok) {
                            const { id } = await res.json();
                            setPhotoIds((prev) => [...prev, id]);
                        }
                    } catch {
                        /* skip failed photo */
                    }
                }
                setPendingFiles([]);
            }

            toast.success('Товар создан');
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
            return false;
        }
    }

    async function handleUpdate(data: ProductCreateFormValues) {
        if (!editId) return false;
        try {
            await updateMutation.mutateAsync({ id: editId, ...catalogPayload(data, 'update') });
            await utils.products.list.invalidate();
            toast.success('Товар обновлён');
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
            return false;
        }
    }

    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        form.handleSubmit(async (data) => {
            const ok = isCreating ? await handleCreate(data) : await handleUpdate(data);
            if (ok) onSuccess();
        })();
    }

    const isPending = createMutation.isPending || updateMutation.isPending;
    const errors = form.formState.errors;

    async function handleDeletePhoto(id: number) {
        await deletePhotoMutation.mutateAsync({ id });
    }

    function renderAttributeSelect(
        kind: ProductAttributeKind,
        field: 'manufacturerId' | 'sizeId' | 'formId' | 'productLineId',
    ) {
        return (
            <ProductAttributeSelect
                kind={kind}
                value={form.watch(field)}
                options={attrsByKind[kind]}
                onChange={(id) => form.setValue(field, id, { shouldDirty: true })}
            />
        );
    }

    const folderSelect = (
        <div className="space-y-2">
            <Label>Папка в каталоге</Label>
            <Select
                value={currentCategoryId ? String(currentCategoryId) : 'none'}
                onValueChange={(v) => {
                    const val = v === 'none' ? null : Number(v);
                    form.setValue('categoryId', val, { shouldDirty: true });
                }}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Без папки" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Без папки</SelectItem>
                    {categories?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 px-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="articleNumber">Номер</Label>
                    <Input id="articleNumber" placeholder="DB-0002" {...form.register('articleNumber')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Название</Label>
                    <Input id="name" placeholder="синий ирис" {...form.register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {renderAttributeSelect('MANUFACTURER', 'manufacturerId')}
                {renderAttributeSelect('SIZE', 'sizeId')}
            </div>
            <div className="grid grid-cols-2 gap-4">
                {renderAttributeSelect('FORM', 'formId')}
                {renderAttributeSelect('PRODUCT_LINE', 'productLineId')}
            </div>

            {folderSelect}

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Фото</label>
                {isCreating ? (
                    <div className="flex flex-wrap gap-2">
                        {pendingFiles.map((f, i) => (
                            <div key={i} className="relative">
                                <img src={f.preview} alt="" className="h-20 w-20 rounded-md object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                                    className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files ?? []);
                                    const withPreviews = files.map((file) => ({
                                        file,
                                        preview: URL.createObjectURL(file),
                                    }));
                                    setPendingFiles((prev) => [...prev, ...withPreviews]);
                                    e.target.value = '';
                                }}
                            />
                            <Plus className="h-5 w-5" />
                        </label>
                    </div>
                ) : (
                    <PhotoUploader
                        photoIds={photoIds}
                        onPhotoIdsChange={setPhotoIds}
                        productId={editId!}
                        onDeletePhoto={handleDeletePhoto}
                    />
                )}
            </div>

            <SheetFooter>
                <Button type="submit" disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isCreating ? 'Создать' : 'Сохранить'}
                </Button>
            </SheetFooter>
        </form>
    );
}

function groupAttributesByKind(
    items: { id: number; kind: ProductAttributeKind; name: string }[] | undefined,
): Record<ProductAttributeKind, { id: number; name: string }[]> {
    const empty: Record<ProductAttributeKind, { id: number; name: string }[]> = {
        MANUFACTURER: [],
        SIZE: [],
        FORM: [],
        PRODUCT_LINE: [],
    };
    if (!items) return empty;
    for (const item of items) {
        empty[item.kind].push({ id: item.id, name: item.name });
    }
    return empty;
}
