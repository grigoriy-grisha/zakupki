'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trpc } from '@/lib/client/trpc';
import { productCreateSchema, type ProductCreateFormValues } from '../lib';
import { useUnits } from './use-products';
import {
    getAttributeCharacteristicIds,
    groupAttributesByType,
    revokePendingFiles,
    type AttributeListItem,
    type PendingFile,
} from '../lib/product-form-utils';

type ProductAttributeValueShape = {
    attribute: { id: number; typeId: number };
};

type ProductCharacteristicValueShape = {
    characteristicId: number;
    value: string;
    characteristic: { id: number; name: string };
};

export type ProductFormExisting = {
    name: string;
    articleNumber: string | null;
    unitId: number;
    attributeValues?: ProductAttributeValueShape[];
    characteristicValues?: ProductCharacteristicValueShape[];
    photos: { id: number }[];
};

export function useProductFormState(editId: number | null, existing: ProductFormExisting | null | undefined) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const pendingFilesRef = useRef(pendingFiles);
    const prevEditIdRef = useRef<number | null | undefined>(undefined);
    pendingFilesRef.current = pendingFiles;

    const [selectedAttrs, setSelectedAttrs] = useState<Record<number, number | null>>({});
    const [charValues, setCharValues] = useState<Record<number, string>>({});
    const [manualCharIds, setManualCharIds] = useState<number[]>([]);

    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();
    const { data: allCharacteristics } = trpc.characteristics.list.useQuery();
    const { data: units } = useUnits(true);

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

    const attrsByType = useMemo(
        () => groupAttributesByType(allAttributes as AttributeListItem[] | undefined),
        [allAttributes],
    );

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
            for (const id of descendantTypeIds(typeId)) delete next[id];
            return next;
        });
    }

    const linkedCharIds = useMemo(() => {
        const ids = new Set<number>();
        for (const attrId of Object.values(selectedAttrs)) {
            if (attrId == null) continue;
            const attr = (allAttributes as AttributeListItem[] | undefined)?.find((a) => a.id === attrId);
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
            const attr = (allAttributes as AttributeListItem[] | undefined)?.find((a) => a.id === attrId);
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

    return {
        form,
        unitId,
        units,
        attributeTypes,
        allCharacteristics,
        attrsByType,
        childrenOfType,
        selectedAttrs,
        charValues,
        setCharValues,
        linkedCharIds,
        activeCharIds,
        activeCharFields,
        handleSelectType,
        handleActiveCharIdsChange,
        photoIds,
        setPhotoIds,
        pendingFiles,
        setPendingFiles,
        basePayload,
        isCreating: !editId,
    };
}
