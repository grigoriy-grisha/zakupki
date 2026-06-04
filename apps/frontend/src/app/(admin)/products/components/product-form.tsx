'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import { useProductFormState, useProductFormSubmit, type ProductFormExisting } from '../hooks';
import { PhotoUploader } from './photo-uploader';
import { AttributeTreePicker } from './attribute-tree-picker';
import { ProductCharacteristicsFields } from './product-characteristics-fields';

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
                    name="unitId"
                    control={state.form.control}
                    render={({ field }) => {
                        const unitId = Number(field.value) || 0;
                        const units = state.units ?? [];
                        const valueInList = units.some((u) => u.id === unitId);
                        const selectValue = unitId > 0 && valueInList ? String(unitId) : undefined;

                        return (
                            <Select
                                key={`unit-${editId ?? 'new'}-${unitId}-${units.length}`}
                                value={selectValue}
                                onValueChange={(v) => field.onChange(Number(v))}
                                disabled={!units.length}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите единицу" />
                                </SelectTrigger>
                                <SelectContent>
                                    {units.map((u) => (
                                        <SelectItem key={u.id} value={String(u.id)}>
                                            {u.name} ({u.shortName})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    }}
                />
                {errors.unitId && <p className="text-xs text-destructive">{errors.unitId.message}</p>}
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
