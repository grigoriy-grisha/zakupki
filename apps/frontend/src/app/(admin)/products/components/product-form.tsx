'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';

import { PACKAGE_UNITS, productCreateSchema, productSchema, type ProductCreateFormValues, type ProductFormValues } from '../lib';
import { useCreateProduct, useDeletePhoto, useUnits, useUpdateProduct } from '../hooks';
import { PhotoUploader } from './photo-uploader';

interface ProductFormProps {
    editId: number | null;
    existing:
        | {
              name: string;
              description: string | null;
              unitId: number;
              pricePerUnit: string | number;
              categoryId: number | null;
              minPackageAmount: string | number | null;
              minPackageUnit: string | null;
              priceTiers: unknown;
              supplierPackageAmount: string | number | null;
              supplierPackageUnit: string | null;
              supplierPackagePrice: string | number | null;
              availableAmount: string | number | null;
              availableUnit: string | null;
              photos: { id: number }[];
          }
        | null
        | undefined;
    onSuccess: (newId?: number) => void;
}

type ExistingProduct = NonNullable<ProductFormProps['existing']>;

export function ProductForm({
    editId,
    existing,
    onSuccess,
    defaultCategoryId,
}: ProductFormProps & { defaultCategoryId?: number | null }) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([]);
    const utils = trpc.useUtils();
    const { data: units } = useUnits(true);
    const { data: categories } = trpc.categories.list.useQuery();
    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();
    const deletePhotoMutation = useDeletePhoto();

    const isCreating = !editId;

    // ─── Create form (name + category + photo only) ───
    const createForm = useForm<ProductCreateFormValues>({
        resolver: zodResolver(productCreateSchema),
        defaultValues: {
            name: '',
            categoryId: defaultCategoryId ?? null,
        },
    });

    // ─── Edit form (full fields) ───
    const editForm = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            description: '',
            unitId: 0,
            categoryId: defaultCategoryId ?? null,
            minPackageAmount: null,
            minPackageUnit: PACKAGE_UNITS[0],
            priceTiers: [{ amount: 1, unit: PACKAGE_UNITS[0], price: 0 }],
            supplierPackageAmount: null,
            supplierPackageUnit: PACKAGE_UNITS[0],
            supplierPackagePrice: null,
            availableAmount: null,
            availableUnit: PACKAGE_UNITS[0],
        },
    });

    const tiers = useFieldArray({ control: editForm.control, name: 'priceTiers' });
    const currentUnitId = editForm.watch('unitId');
    const currentCategoryId = isCreating ? createForm.watch('categoryId') : editForm.watch('categoryId');

    useEffect(() => {
        if (existing && editId) {
            editForm.reset({
                name: existing.name,
                description: existing.description ?? '',
                unitId: existing.unitId,
                categoryId: existing.categoryId ?? null,
                minPackageAmount: nullableNumber(existing.minPackageAmount),
                minPackageUnit: existing.minPackageUnit ?? PACKAGE_UNITS[0],
                priceTiers: parseTiers(existing.priceTiers),
                supplierPackageAmount: nullableNumber(existing.supplierPackageAmount),
                supplierPackageUnit: existing.supplierPackageUnit ?? PACKAGE_UNITS[0],
                supplierPackagePrice: nullableNumber(existing.supplierPackagePrice),
                availableAmount: nullableNumber(existing.availableAmount),
                availableUnit: existing.availableUnit ?? PACKAGE_UNITS[0],
            });
            setPhotoIds(existing.photos.map((p) => p.id));
            setPendingFiles([]);
        } else if (!editId) {
            createForm.reset({
                name: '',
                categoryId: defaultCategoryId ?? null,
            });
            setPhotoIds([]);
            setPendingFiles([]);
        }
    }, [existing, editId, editForm, createForm, defaultCategoryId]);

    const currentCategoryName = categories?.find((c) => c.id === currentCategoryId)?.name;
    useAutoDescription(editForm.control, editForm.setValue, currentCategoryName);

    // ─── Create submit ───
    async function handleCreate(data: ProductCreateFormValues) {
        try {
            const result = await createMutation.mutateAsync({
                name: data.name,
                categoryId: data.categoryId ?? undefined,
            });
            await utils.products.list.invalidate();

            // Upload pending photos
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
            return result.id;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
            return undefined;
        }
    }

    // ─── Edit submit ───
    async function handleEdit(data: ProductFormValues) {
        const firstTier = data.priceTiers?.[0];
        if (!firstTier || !firstTier.amount || firstTier.price <= 0) {
            toast.error('Укажите хотя бы одну цену');
            return;
        }
        if (!data.unitId) {
            toast.error('Выберите единицу учёта');
            return;
        }

        const pricePerUnit = firstTier.price / firstTier.amount;

        const payload = {
            name: data.name,
            description: data.description?.trim() || undefined,
            unitId: data.unitId,
            pricePerUnit,
            categoryId: data.categoryId ?? undefined,
            minPackageAmount: data.minPackageAmount ?? undefined,
            minPackageUnit: data.minPackageUnit ?? undefined,
            priceTiers: data.priceTiers,
            supplierPackageAmount: data.supplierPackageAmount ?? undefined,
            supplierPackageUnit: data.supplierPackageUnit ?? undefined,
            supplierPackagePrice: data.supplierPackagePrice ?? undefined,
            availableAmount: data.availableAmount ?? undefined,
            availableUnit: data.availableUnit ?? undefined,
        };

        try {
            if (editId) {
                await updateMutation.mutateAsync({ id: editId, ...payload });
                await utils.products.list.invalidate();
                toast.success('Товар обновлён');
            }
            onSuccess();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
        }
    }

    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isCreating) {
            createForm.handleSubmit(async (data) => {
                const newId = await handleCreate(data);
                if (newId) onSuccess(newId);
            })();
        } else {
            editForm.handleSubmit(async (data) => {
                await handleEdit(data);
            })();
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending;

    async function handleDeletePhoto(id: number) {
        await deletePhotoMutation.mutateAsync({ id });
    }

    // ─── Category selector (shared) ───
    const categorySelect = (
        <div className="space-y-2">
            <Label>Категория</Label>
            <Select
                value={currentCategoryId ? String(currentCategoryId) : 'none'}
                onValueChange={(v) => {
                    const val = v === 'none' ? null : Number(v);
                    if (isCreating) createForm.setValue('categoryId', val, { shouldDirty: true });
                    else editForm.setValue('categoryId', val, { shouldDirty: true });
                }}
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
    );

    // ─── CREATE mode: minimal form ───
    if (isCreating) {
        const createErrors = createForm.formState.errors;
        return (
            <form onSubmit={handleFormSubmit} className="space-y-4 px-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Название</Label>
                    <Input id="name" {...createForm.register('name')} />
                    {createErrors.name && <p className="text-xs text-destructive">{createErrors.name.message}</p>}
                </div>

                {categorySelect}

                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Фото</label>
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
                </div>

                <SheetFooter>
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Создать
                    </Button>
                </SheetFooter>
            </form>
        );
    }

    // ─── EDIT mode: full form ───
    const { control, register, setValue, watch, formState: { errors } } = editForm;

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 px-4">
            <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <Label>Описание</Label>
                <Controller
                    control={control}
                    name="description"
                    render={({ field }) => (
                        <NovelEditor
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Описание заполнится автоматически из полей ниже..."
                        />
                    )}
                />
                <p className="text-xs text-muted-foreground">
                    Заполняется автоматически из полей ниже. Можно дописать вручную после сохранения.
                </p>
            </div>

            <div className="space-y-2">
                <Label>Минимальная фасовка</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        placeholder="5"
                        className="flex-1"
                        {...register('minPackageAmount', { setValueAs: emptyAsNull })}
                    />
                    <UnitSelect
                        value={watch('minPackageUnit') ?? PACKAGE_UNITS[0]}
                        onValueChange={(v) => setValue('minPackageUnit', v, { shouldDirty: true })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Цены</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            tiers.append({
                                amount: 1,
                                unit: PACKAGE_UNITS[0],
                                price: 0,
                            })
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Добавить тир
                    </Button>
                </div>

                <div className="space-y-2">
                    {tiers.fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                            <Input
                                type="number"
                                step="0.001"
                                placeholder="1"
                                className="w-20"
                                {...register(`priceTiers.${index}.amount`, { valueAsNumber: true })}
                            />
                            <UnitSelect
                                value={watch(`priceTiers.${index}.unit`) ?? PACKAGE_UNITS[0]}
                                onValueChange={(v) => setValue(`priceTiers.${index}.unit`, v, { shouldDirty: true })}
                            />
                            <span className="text-muted-foreground">—</span>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="41"
                                className="flex-1"
                                {...register(`priceTiers.${index}.price`, { valueAsNumber: true })}
                            />
                            <span className="text-sm text-muted-foreground">₽</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                disabled={tiers.fields.length <= 1}
                                onClick={() => tiers.remove(index)}
                                aria-label="Удалить тир"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                {errors.priceTiers && <p className="text-xs text-destructive">{errors.priceTiers.message}</p>}
            </div>

            <div className="space-y-2">
                <Label>Фасовка поставщика</Label>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        placeholder="50"
                        className="w-24"
                        {...register('supplierPackageAmount', { setValueAs: emptyAsNull })}
                    />
                    <UnitSelect
                        value={watch('supplierPackageUnit') ?? PACKAGE_UNITS[0]}
                        onValueChange={(v) => setValue('supplierPackageUnit', v, { shouldDirty: true })}
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="2066"
                        className="flex-1"
                        {...register('supplierPackagePrice', { setValueAs: emptyAsNull })}
                    />
                    <span className="text-sm text-muted-foreground">₽</span>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Свободно</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        placeholder="5"
                        className="flex-1"
                        {...register('availableAmount', { setValueAs: emptyAsNull })}
                    />
                    <UnitSelect
                        value={watch('availableUnit') ?? PACKAGE_UNITS[0]}
                        onValueChange={(v) => setValue('availableUnit', v, { shouldDirty: true })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Единица учёта</Label>
                    <Select
                        value={currentUnitId ? String(currentUnitId) : ''}
                        onValueChange={(v) => setValue('unitId', Number(v), { shouldDirty: true })}
                    >
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
                    {errors.unitId && <p className="text-xs text-destructive">{errors.unitId.message}</p>}
                </div>

                {categorySelect}
            </div>

            <PhotoUploader
                photoIds={photoIds}
                onPhotoIdsChange={setPhotoIds}
                productId={editId!}
                onDeletePhoto={handleDeletePhoto}
            />

            <SheetFooter>
                <Button type="submit" disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить
                </Button>
            </SheetFooter>
        </form>
    );
}

function UnitSelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="w-24">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {PACKAGE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                        {u}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function useAutoDescription(
    control: import('react-hook-form').Control<ProductFormValues>,
    setValue: import('react-hook-form').UseFormSetValue<ProductFormValues>,
    categoryName?: string,
) {
    const watched = useWatch({
        control,
        name: [
            'name',
            'minPackageAmount',
            'minPackageUnit',
            'priceTiers',
            'supplierPackageAmount',
            'supplierPackageUnit',
            'supplierPackagePrice',
            'availableAmount',
            'availableUnit',
        ],
    });

    const lastGeneratedRef = useRef<string>('');
    const stableKey = useMemo(() => JSON.stringify([watched, categoryName]), [watched, categoryName]);

    useEffect(() => {
        const [
            name,
            minPackageAmount,
            minPackageUnit,
            priceTiers,
            supplierPackageAmount,
            supplierPackageUnit,
            supplierPackagePrice,
            availableAmount,
            availableUnit,
        ] = watched;

        const html = buildDescriptionHtml({
            name,
            categoryName,
            minPackageAmount,
            minPackageUnit,
            priceTiers,
            supplierPackageAmount,
            supplierPackageUnit,
            supplierPackagePrice,
            availableAmount,
            availableUnit,
        });

        if (html === lastGeneratedRef.current) return;
        lastGeneratedRef.current = html;
        setValue('description', html, { shouldDirty: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableKey]);
}

interface DescriptionInput {
    name?: string;
    categoryName?: string;
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    priceTiers?: { amount?: number; unit?: string; price?: number }[];
    supplierPackageAmount?: number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: number | null;
    availableAmount?: number | null;
    availableUnit?: string | null;
}

function buildDescriptionHtml(input: DescriptionInput): string {
    const lines: string[] = [];
    const cat = (input.categoryName ?? '').trim();
    const name = (input.name ?? '').trim();

    if (cat) lines.push(`<p><strong>${escapeHtml(cat)}</strong><br/><strong>${escapeHtml(name)}</strong></p>`);
    else if (name) lines.push(`<p><strong>${escapeHtml(name)}</strong></p>`);

    if (isPositive(input.minPackageAmount) && input.minPackageUnit) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p><strong>Минимальная фасовка - ${formatNumber(input.minPackageAmount)} ${escapeHtml(input.minPackageUnit)}</strong></p>`,
        );
    }

    const validTiers =
        input.priceTiers?.filter((t) => t && isPositive(t.amount) && t.unit && isPositive(t.price)) ?? [];

    if (validTiers.length > 0) {
        if (lines.length) lines.push('<p></p>');
        for (const tier of validTiers) {
            lines.push(
                `<p>${formatNumber(tier.amount!)} ${escapeHtml(tier.unit!)} - ${formatNumber(tier.price!)} руб</p>`,
            );
        }
    }

    if (
        isPositive(input.supplierPackageAmount) &&
        input.supplierPackageUnit &&
        isPositive(input.supplierPackagePrice)
    ) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p><strong>Фасовка поставщика:</strong><br/>${formatNumber(input.supplierPackageAmount)} ${escapeHtml(input.supplierPackageUnit)} - ${formatNumber(input.supplierPackagePrice)} руб</p>`,
        );
    }

    if (input.availableAmount != null && Number(input.availableAmount) >= 0 && input.availableUnit) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p><strong>СВОБОДНО:</strong> ${formatNumber(input.availableAmount)} ${escapeHtml(input.availableUnit)}</p>`,
        );
    }

    return lines.join('');
}

function isPositive(v: number | null | undefined): v is number {
    return typeof v === 'number' && isFinite(v) && v > 0;
}

function formatNumber(v: number | null | undefined): string {
    if (v == null || !isFinite(Number(v))) return '';
    const n = Number(v);
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(2).replace(/\.?0+$/, '');
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emptyAsNull(v: unknown): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function nullableNumber(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function parseTiers(raw: ExistingProduct['priceTiers']): ProductFormValues['priceTiers'] {
    if (!Array.isArray(raw)) {
        return [{ amount: 1, unit: PACKAGE_UNITS[0], price: 0 }];
    }
    const tiers = (raw as unknown[])
        .map((t) => {
            if (!t || typeof t !== 'object') return null;
            const obj = t as Record<string, unknown>;
            const amount = Number(obj.amount);
            const price = Number(obj.price);
            const unit = typeof obj.unit === 'string' ? obj.unit : PACKAGE_UNITS[0];
            if (!Number.isFinite(amount) || amount <= 0) return null;
            if (!Number.isFinite(price)) return null;
            return { amount, unit, price };
        })
        .filter((t): t is { amount: number; unit: string; price: number } => t !== null);
    return tiers.length > 0 ? tiers : [{ amount: 1, unit: PACKAGE_UNITS[0], price: 0 }];
}
