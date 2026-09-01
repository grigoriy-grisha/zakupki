'use client';

import { UNITS } from '@zakupki/types';
import { Loader2, Plus, X } from 'lucide-react';
import { Controller } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { type ProductFormExisting,useProductFormState, useProductFormSubmit } from '../hooks';
import { AttributeTreePicker } from './attribute-tree-picker';
import { PhotoUploader } from './photo-uploader';
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
        <form onSubmit={state.form.handleSubmit(submit.submitForm)} className="flex flex-col gap-4">
            {/* === Основное === */}
            <FormSection card title="Основное">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Артикул" htmlFor="articleNumber">
                        <Input
                            id="articleNumber"
                            className="h-9 rounded-xl"
                            {...state.form.register('articleNumber')}
                        />
                    </FormField>
                    <FormField
                        label="Название"
                        required
                        htmlFor="name"
                        error={errors.name?.message}
                    >
                        <Input
                            id="name"
                            className="h-9 rounded-xl"
                            {...state.form.register('name')}
                        />
                    </FormField>
                </div>
            </FormSection>

            {/* === Единица + Категории === */}
            <FormSection card title="Единица и категории">
                <FormField label="Единица учёта" required error={errors.unitCode?.message}>
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
                                    <SelectTrigger className="h-9 rounded-xl">
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
                </FormField>

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
                    onChange={(id, value) =>
                        state.setCharValues((prev) => ({ ...prev, [id]: value }))
                    }
                />
            </FormSection>

            {/* === Фото === */}
            <FormSection card title="Фото">
                {state.isCreating ? (
                    <div className="flex flex-wrap gap-2">
                        {state.pendingFiles.map((f) => (
                            <div key={f.id} className="relative">
                                <img
                                    src={f.preview}
                                    alt=""
                                    className="h-20 w-20 rounded-xl object-cover"
                                />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon-xs"
                                    aria-label="Удалить фото"
                                    onClick={() =>
                                        state.setPendingFiles((prev) => {
                                            const item = prev.find((x) => x.id === f.id);
                                            if (item) URL.revokeObjectURL(item.preview);
                                            return prev.filter((x) => x.id !== f.id);
                                        })
                                    }
                                    className="absolute -top-1 -right-1 size-5 rounded-full bg-error p-0 text-error-foreground hover:bg-error/90"
                                >
                                    <X className="size-3" />
                                </Button>
                            </div>
                        ))}
                        <label
                            className={cn(
                                'flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border text-fg-tertiary transition-colors',
                                'hover:border-primary hover:text-primary',
                            )}
                        >
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
            </FormSection>

            {/* === Sticky footer === */}
            <FormFooter>
                <Button
                    type="submit"
                    variant="brand"
                    className="rounded-full"
                    disabled={submit.isPending}
                >
                    {submit.isPending && <Loader2 className="size-4 animate-spin" />}
                    {state.isCreating ? 'Создать товар' : 'Сохранить'}
                </Button>
            </FormFooter>
        </form>
    );
}
