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

import { PACKAGE_UNITS, productSchema, type ProductFormValues } from '../lib';
import { useCreateProduct, useDeletePhoto, useUnits, useUpdateProduct } from '../hooks';
import { PhotoUploader } from './photo-uploader';

import type { ProductFormProps } from '../../lib/types';

type ExistingProduct = NonNullable<ProductFormProps['existing']>;

export function ProductForm({ editId, existing, onSuccess, defaultCategoryId }: ProductFormProps & { defaultCategoryId?: number | null }) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const utils = trpc.useUtils();
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
        defaultValues: {
            name: '',
            description: '',
            sku: '',
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

    const tiers = useFieldArray({ control, name: 'priceTiers' });
    const currentUnitId = watch('unitId');
    const currentCategoryId = watch('categoryId');

    useEffect(() => {
        if (existing && editId) {
            reset({
                name: existing.name,
                description: existing.description ?? '',
                unitId: existing.unitId,
                sku: existing.sku ?? '',
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
        } else if (!editId) {
            reset({
                name: '',
                description: '',
                sku: '',
                unitId: units?.[0]?.id ?? 0,
                categoryId: defaultCategoryId ?? null,
                minPackageAmount: null,
                minPackageUnit: PACKAGE_UNITS[0],
                priceTiers: [{ amount: 1, unit: PACKAGE_UNITS[0], price: 0 }],
                supplierPackageAmount: null,
                supplierPackageUnit: PACKAGE_UNITS[0],
                supplierPackagePrice: null,
                availableAmount: null,
                availableUnit: PACKAGE_UNITS[0],
            });
            setPhotoIds([]);
        }
    }, [existing, editId, reset, units, defaultCategoryId]);

    useAutoDescription(control, setValue);

    async function onSubmit(data: ProductFormValues) {
        const firstTier = data.priceTiers?.[0];
        if (!firstTier || !firstTier.amount || firstTier.price <= 0) {
            toast.error('Укажите хотя бы одну цену');
            return undefined;
        }
        if (!data.unitId) {
            toast.error('Выберите единицу учёта');
            return undefined;
        }

        const pricePerUnit = firstTier.price / firstTier.amount;

        const payload = {
            name: data.name,
            description: data.description?.trim() || undefined,
            sku: data.sku?.trim() || undefined,
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
            } else {
                const result = await createMutation.mutateAsync(payload);
                await utils.products.list.invalidate();
                toast.success('Товар создан');
                if (photoIds.length === 0) {
                    toast.info('Теперь можно загрузить фото.');
                }
                return result.id;
            }
            onSuccess();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
        }
        return undefined;
    }

    function handleFormSubmit(e: React.FormEvent) {
        e.preventDefault();
        handleSubmit(async (data) => {
            const newId = await onSubmit(data);
            if (newId) onSuccess();
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
                <Label htmlFor="sku">Артикул (SKU)</Label>
                <Input id="sku" {...register('sku')} placeholder="Артикул" />
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
                                onValueChange={(v) =>
                                    setValue(`priceTiers.${index}.unit`, v, { shouldDirty: true })
                                }
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
                {errors.priceTiers && (
                    <p className="text-xs text-destructive">{errors.priceTiers.message}</p>
                )}
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
                    {errors.unitId && (
                        <p className="text-xs text-destructive">{errors.unitId.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Категория</Label>
                    <Select
                        value={currentCategoryId ? String(currentCategoryId) : 'none'}
                        onValueChange={(v) =>
                            setValue('categoryId', v === 'none' ? null : Number(v), { shouldDirty: true })
                        }
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
            </div>

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
) {
    const watched = useWatch({
        control,
        name: [
            'name',
            'sku',
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
    const stableKey = useMemo(() => JSON.stringify(watched), [watched]);

    useEffect(() => {
        const [
            name,
            sku,
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
            sku,
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
    sku?: string;
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
    const name = (input.name ?? '').trim();
    const sku = (input.sku ?? '').trim();

    if (name) lines.push(`<p><strong>${escapeHtml(name)}</strong></p>`);
    if (sku) lines.push(`<p>${escapeHtml(sku)}</p>`);

    if (isPositive(input.minPackageAmount) && input.minPackageUnit) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p>Минимальная фасовка — ${formatNumber(input.minPackageAmount)} ${escapeHtml(input.minPackageUnit)}</p>`,
        );
    }

    const validTiers =
        input.priceTiers?.filter(
            (t) => t && isPositive(t.amount) && t.unit && isPositive(t.price),
        ) ?? [];

    if (validTiers.length > 0) {
        if (lines.length) lines.push('<p></p>');
        for (const tier of validTiers) {
            lines.push(
                `<p>${formatNumber(tier.amount!)} ${escapeHtml(tier.unit!)} — ${formatNumber(tier.price!)} руб</p>`,
            );
        }
    }

    if (
        isPositive(input.supplierPackageAmount) &&
        input.supplierPackageUnit &&
        isPositive(input.supplierPackagePrice)
    ) {
        if (lines.length) lines.push('<p></p>');
        lines.push('<p>Фасовка поставщика:</p>');
        lines.push(
            `<p>${formatNumber(input.supplierPackageAmount)} ${escapeHtml(input.supplierPackageUnit)} — ${formatNumber(input.supplierPackagePrice)} руб.</p>`,
        );
    }

    if (input.availableAmount != null && Number(input.availableAmount) >= 0 && input.availableUnit) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p><strong>СВОБОДНО:</strong> ${formatNumber(input.availableAmount)} ${escapeHtml(input.availableUnit)}.</p>`,
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
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
