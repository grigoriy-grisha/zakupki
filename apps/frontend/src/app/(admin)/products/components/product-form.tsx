'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { UNITS } from '@zakupki/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller, useFormContext } from 'react-hook-form';
import { useProductFormState, useProductFormSubmit, type ProductFormExisting } from '../hooks';
import { PhotoUploader } from './photo-uploader';
import { AttributeTreePicker } from './attribute-tree-picker';
import { ProductCharacteristicsFields } from './product-characteristics-fields';
import { PriceTierEditor, PackageEditor } from './package-fields';
import { PACKAGE_UNITS } from '../lib';

interface ProductFormProps {
    editId: number | null;
    existing: ProductFormExisting | null | undefined;
    onSuccess: () => void;
}

export function ProductForm({ editId, existing, onSuccess }: ProductFormProps) {
    const state = useProductFormState(editId, existing);
    const submit = useProductFormSubmit({
        editId,
        isCreating: state.isCreating,
        basePayload: state.basePayload,
        pendingFiles: state.pendingFiles,
        setPhotoIds: state.setPhotoIds,
        setPendingFiles: state.setPendingFiles,
        onSuccess,
    });

    const errors = state.form.formState.errors;

    return (
        <form onSubmit={state.form.handleSubmit(submit.submitForm)} className="space-y-4 px-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="articleNumber">Номер</Label>
                    <Input id="articleNumber" {...state.form.register('articleNumber')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Название</Label>
                    <Input id="name" {...state.form.register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Единица учёта</Label>
                <Controller
                    name="unitCode"
                    control={state.form.control}
                    render={({ field }) => {
                        const unitCode = field.value || '';
                        const valueInList = UNITS.some((u) => u.code === unitCode);
                        const selectValue = unitCode && valueInList ? unitCode : undefined;

                        return (
                            <Select
                                key={`unit-${editId ?? 'new'}-${unitCode}`}
                                value={selectValue}
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите единицу" />
                                </SelectTrigger>
                                <SelectContent>
                                    {UNITS.map((u) => (
                                        <SelectItem key={u.code} value={u.code}>
                                            {u.name} ({u.shortName})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    }}
                />
                {errors.unitCode && <p className="text-xs text-destructive">{errors.unitCode.message}</p>}
            </div>

            {(state.attributeTypes?.length ?? 0) > 0 && (
                <AttributeTreePicker
                    rootTypes={state.childrenOfType(null)}
                    childrenOfType={state.childrenOfType}
                    attrsTreeByType={state.attrsTreeByType}
                    selectedAttrs={state.selectedAttrs}
                    onSelect={state.handleSelectType}
                />
            )}

            <ProductCharacteristicsFields
                fields={state.activeCharFields}
                values={state.charValues}
                onChange={(id, value) => state.setCharValues((prev) => ({ ...prev, [id]: value }))}
            />

            {/* Pricing section */}
            <div className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-medium">Цены</h3>

                <div className="space-y-2">
                    <Label htmlFor="pricePerUnit">Цена за единицу (₽)</Label>
                    <Input
                        id="pricePerUnit"
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        {...state.form.register('pricePerUnit', { valueAsNumber: true })}
                    />
                </div>

                <Controller
                    name="priceTiers"
                    control={state.form.control}
                    render={({ field }) => (
                        <PriceTierEditor
                            tiers={field.value ?? []}
                            onChange={field.onChange}
                            label="Ценовые тиры"
                            required={false}
                            addTierLabel="Добавить тир"
                        />
                    )}
                />
            </div>

            {/* Packaging section */}
            <div className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-medium">Фасовка</h3>

                <Controller
                    name="minPackageAmount"
                    control={state.form.control}
                    render={({ field }) => (
                        <PackageEditor
                            label="Мин. фасовка"
                            amount={field.value ?? null}
                            unit={state.form.watch('minPackageUnit') ?? PACKAGE_UNITS[0]}
                            onAmountChange={(v) => field.onChange(v)}
                            onUnitChange={(v) => state.form.setValue('minPackageUnit', v)}
                        />
                    )}
                />

                <Controller
                    name="supplierPackageAmount"
                    control={state.form.control}
                    render={({ field }) => (
                        <PackageEditor
                            label="Поставка (упаковка)"
                            amount={field.value ?? null}
                            unit={state.form.watch('supplierPackageUnit') ?? PACKAGE_UNITS[0]}
                            onAmountChange={(v) => field.onChange(v)}
                            onUnitChange={(v) => state.form.setValue('supplierPackageUnit', v)}
                        />
                    )}
                />

                <Controller
                    name="supplierPackagePrice"
                    control={state.form.control}
                    render={({ field }) => (
                        <div className="space-y-1">
                            <Label htmlFor="supplierPackagePrice">Цена поставки (₽)</Label>
                            <Input
                                id="supplierPackagePrice"
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                            />
                        </div>
                    )}
                />
            </div>

            {/* Reference stock */}
            <div className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-medium">Остаток</h3>

                <div className="space-y-2">
                    <Label htmlFor="referenceStock">Доступно (шт.)</Label>
                    <Input
                        id="referenceStock"
                        type="number"
                        step="1"
                        min={0}
                        placeholder="0"
                        {...state.form.register('referenceStock', { valueAsNumber: true })}
                    />
                    <p className="text-xs text-muted-foreground">Справочная информация — не лимит</p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Фото</label>
                {state.isCreating ? (
                    <div className="flex flex-wrap gap-2">
                        {state.pendingFiles.map((f) => (
                            <div key={f.id} className="relative">
                                <img src={f.preview} alt="" className="h-20 w-20 rounded-md object-cover" />
                                <button
                                    type="button"
                                    onClick={() =>
                                        state.setPendingFiles((prev) => {
                                            const item = prev.find((x) => x.id === f.id);
                                            if (item) URL.revokeObjectURL(item.preview);
                                            return prev.filter((x) => x.id !== f.id);
                                        })
                                    }
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
                                        id: crypto.randomUUID(),
                                        file,
                                        preview: URL.createObjectURL(file),
                                    }));
                                    state.setPendingFiles((prev) => [...prev, ...withPreviews]);
                                    e.target.value = '';
                                }}
                            />
                            <Plus className="h-5 w-5" />
                        </label>
                    </div>
                ) : (
                    <PhotoUploader
                        photoIds={state.photoIds}
                        onPhotoIdsChange={state.setPhotoIds}
                        productId={editId!}
                        onDeletePhoto={submit.handleDeletePhoto}
                    />
                )}
            </div>

            <SheetFooter>
                <Button type="submit" disabled={submit.isPending} className="w-full">
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {state.isCreating ? 'Создать' : 'Сохранить'}
                </Button>
            </SheetFooter>
        </form>
    );
}
