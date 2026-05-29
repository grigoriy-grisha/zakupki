'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';

import { productCreateSchema, type ProductCreateFormValues } from '../lib';
import { useCreateProduct, useDeletePhoto, useUpdateProduct, useUnits } from '../hooks';
import { PhotoUploader } from './photo-uploader';
import { AttributeTreePicker } from './attribute-tree-picker';
import { ProductCharacteristicsFields } from './product-characteristics-fields';

type ProductAttributeValueShape = {
    attribute: { id: number; typeId: number };
};

type ProductCharacteristicValueShape = {
    characteristicId: number;
    value: string;
    characteristic: { id: number; name: string };
};

interface ProductFormProps {
    editId: number | null;
    existing:
        | {
              name: string;
              articleNumber: string | null;
              unitId: number;
              attributeValues?: ProductAttributeValueShape[];
              characteristicValues?: ProductCharacteristicValueShape[];
              photos: { id: number }[];
          }
        | null
        | undefined;
    onSuccess: () => void;
}

export function ProductForm({ editId, existing, onSuccess }: ProductFormProps) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const pendingFilesRef = useRef(pendingFiles);
    const prevEditIdRef = useRef<number | null | undefined>(undefined);
    pendingFilesRef.current = pendingFiles;
    // typeId -> attributeId (выбранное значение для каждого типа)
    const [selectedAttrs, setSelectedAttrs] = useState<Record<number, number | null>>({});
    const [charValues, setCharValues] = useState<Record<number, string>>({});
    const [manualCharIds, setManualCharIds] = useState<number[]>([]);
    const utils = trpc.useUtils();
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();
    const { data: allCharacteristics } = trpc.characteristics.list.useQuery();
    const { data: units } = useUnits(true);
    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();
    const deletePhotoMutation = useDeletePhoto();

    const isCreating = !editId;

    const form = useForm<ProductCreateFormValues>({
        resolver: zodResolver(productCreateSchema),
        defaultValues: {
            name: '',
            articleNumber: '',
            unitId: 0,
        },
    });

    const unitId = form.watch('unitId');

    useEffect(() => {
        if (editId || !units?.length) return;
        if (!unitId || unitId <= 0) {
            form.setValue('unitId', units[0].id, { shouldValidate: true });
        }
    }, [editId, units, unitId, form]);

    const attrsByType = useMemo(() => groupAttributesByType(allAttributes), [allAttributes]);

    // Типы по родителю — для иерархического выбора (как в дереве каталога).
    const typesByParent = useMemo(() => {
        const map = new Map<number | null, { id: number; name: string; parentId: number | null; position: number }[]>();
        for (const t of attributeTypes ?? []) {
            const key = t.parentId ?? null;
            const list = map.get(key) ?? [];
            list.push(t);
            map.set(key, list);
        }
        for (const list of map.values()) list.sort((a, b) => a.position - b.position || a.id - b.id);
        return map;
    }, [attributeTypes]);

    const childrenOfType = (parentId: number | null) => typesByParent.get(parentId) ?? [];

    function descendantTypeIds(typeId: number): number[] {
        return childrenOfType(typeId).flatMap((child) => [child.id, ...descendantTypeIds(child.id)]);
    }

    function handleSelectType(typeId: number, attributeId: number | null) {
        setSelectedAttrs((prev) => {
            const next = { ...prev, [typeId]: attributeId };
            // При смене/сбросе родителя очищаем выбранные значения подтипов.
            for (const id of descendantTypeIds(typeId)) delete next[id];
            return next;
        });
    }

    const linkedCharIds = useMemo(() => {
        const ids = new Set<number>();
        for (const attrId of Object.values(selectedAttrs)) {
            if (attrId == null) continue;
            const attr = allAttributes?.find((a) => a.id === attrId);
            for (const cid of getAttributeCharacteristicIds(attr)) ids.add(cid);
        }
        return ids;
    }, [selectedAttrs, allAttributes]);

    const activeCharIds = useMemo(
        () => [...new Set([...linkedCharIds, ...manualCharIds])],
        [linkedCharIds, manualCharIds],
    );

    const activeCharFields = useMemo(() => {
        const ids = new Set(activeCharIds);
        return (allCharacteristics ?? [])
            .filter((c) => ids.has(c.id))
            .map((c) => ({ id: c.id, name: c.name }));
    }, [activeCharIds, allCharacteristics]);

    function handleActiveCharIdsChange(ids: number[]) {
        const manual = ids.filter((id) => !linkedCharIds.has(id));
        setManualCharIds(manual);
        setCharValues((prev) => {
            const next = { ...prev };
            const keep = new Set(ids);
            for (const key of Object.keys(next)) {
                if (!keep.has(Number(key))) delete next[Number(key)];
            }
            return next;
        });
    }

    function characteristicsPayload() {
        return activeCharFields
            .map((f) => ({ characteristicId: f.id, value: (charValues[f.id] ?? '').trim() }))
            .filter((c) => c.value);
    }

    useEffect(() => {
        return () => revokePendingFiles(pendingFilesRef.current);
    }, []);

    useEffect(() => {
        if (!editId || !existing) return;

        form.reset({
            name: existing.name,
            articleNumber: existing.articleNumber ?? '',
            unitId: existing.unitId,
        });
        const map: Record<number, number | null> = {};
        for (const v of existing.attributeValues ?? []) {
            map[v.attribute.typeId] = v.attribute.id;
        }
        setSelectedAttrs(map);
        const chars: Record<number, string> = {};
        const manual: number[] = [];
        const linked = new Set<number>();
        for (const attrId of Object.values(map)) {
            if (attrId == null) continue;
            const attr = allAttributes?.find((a) => a.id === attrId);
            for (const cid of getAttributeCharacteristicIds(attr)) linked.add(cid);
        }
        for (const cv of existing.characteristicValues ?? []) {
            chars[cv.characteristicId] = cv.value;
            if (!linked.has(cv.characteristicId)) manual.push(cv.characteristicId);
        }
        setCharValues(chars);
        setManualCharIds(manual);
        setPhotoIds(existing.photos.map((p) => p.id));
        setPendingFiles((prev) => {
            revokePendingFiles(prev);
            return [];
        });
    }, [editId, existing, form, allAttributes]);

    useEffect(() => {
        const prev = prevEditIdRef.current;
        prevEditIdRef.current = editId;
        if (editId != null) return;
        if (prev === editId) return;

        form.reset({
            name: '',
            articleNumber: '',
            unitId: units?.[0]?.id ?? 0,
        });
        setSelectedAttrs({});
        setCharValues({});
        setManualCharIds([]);
        setPhotoIds([]);
        setPendingFiles((prev) => {
            revokePendingFiles(prev);
            return [];
        });
    }, [editId, form, units]);

    function selectedAttributeIds(): number[] {
        return Object.values(selectedAttrs).filter((id): id is number => typeof id === 'number');
    }

    function basePayload(data: ProductCreateFormValues) {
        return {
            name: data.name,
            articleNumber: data.articleNumber?.trim() || null,
            unitId: data.unitId,
            attributeIds: selectedAttributeIds(),
            characteristics: characteristicsPayload(),
        };
    }

    async function handleCreate(data: ProductCreateFormValues) {
        try {
            const result = await createMutation.mutateAsync(basePayload(data));
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
                await utils.products.getById.invalidate({ id: result.id });
                await utils.products.list.invalidate();
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
            await updateMutation.mutateAsync({
                id: editId,
                ...basePayload(data),
            });
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

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 px-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="articleNumber">Номер</Label>
                    <Input id="articleNumber" {...form.register('articleNumber')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Название</Label>
                    <Input id="name" {...form.register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Единица учёта</Label>
                <Select
                    value={unitId > 0 ? String(unitId) : undefined}
                    onValueChange={(v) => form.setValue('unitId', Number(v), { shouldValidate: true })}
                    disabled={!units?.length}
                >
                    <SelectTrigger>
                        <SelectValue />
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

            {(attributeTypes?.length ?? 0) > 0 && (
                <AttributeTreePicker
                    rootTypes={childrenOfType(null)}
                    childrenOfType={childrenOfType}
                    attrsByType={attrsByType}
                    selectedAttrs={selectedAttrs}
                    onSelect={handleSelectType}
                />
            )}

            {(allCharacteristics?.length ?? 0) > 0 && (
                <ProductCharacteristicsFields
                    fields={activeCharFields}
                    values={charValues}
                    onChange={(id, value) => setCharValues((prev) => ({ ...prev, [id]: value }))}
                    onRemove={(id) => handleActiveCharIdsChange(activeCharIds.filter((x) => x !== id))}
                    canRemove={(id) => !linkedCharIds.has(id)}
                    allCharacteristics={(allCharacteristics ?? []).map((c) => ({ id: c.id, name: c.name }))}
                    activeIds={activeCharIds}
                    lockedIds={linkedCharIds}
                    onActiveIdsChange={handleActiveCharIdsChange}
                />
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Фото</label>
                {isCreating ? (
                    <div className="flex flex-wrap gap-2">
                        {pendingFiles.map((f) => (
                            <div key={f.id} className="relative">
                                <img src={f.preview} alt="" className="h-20 w-20 rounded-md object-cover" />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPendingFiles((prev) => {
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

type AttributeListItem = {
    id: number;
    typeId: number;
    name: string;
    characteristics?: { characteristic: { id: number } }[];
};

function getAttributeCharacteristicIds(attr: AttributeListItem | undefined): number[] {
    return attr?.characteristics?.map((l) => l.characteristic.id) ?? [];
}

type PendingFile = { id: string; file: File; preview: string };

function revokePendingFiles(files: PendingFile[]) {
    for (const f of files) URL.revokeObjectURL(f.preview);
}

function groupAttributesByType(
    items: AttributeListItem[] | undefined,
): Record<number, { id: number; name: string }[]> {
    const result: Record<number, { id: number; name: string }[]> = {};
    if (!items) return result;
    for (const item of items) {
        (result[item.typeId] ??= []).push({ id: item.id, name: item.name });
    }
    return result;
}
