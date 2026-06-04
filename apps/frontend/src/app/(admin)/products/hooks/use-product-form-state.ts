'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trpc } from '@/lib/client/trpc';
import { productCreateSchema, type ProductCreateFormValues } from '../lib';
import { useUnits } from './use-products';
import {
    buildAttributesTreeByType,
    buildAutoCharacteristicValues,
    collectLinkedCharacteristicIds,
    revokePendingFiles,
    resolveProductUnitId,
    type AttributeListItem,
    type PendingFile,
} from '../lib/product-form-utils';

type ProductAttributeValueShape = {
    attribute: { id: number; typeId: number };
};

type ProductCharacteristicValueShape = {
    characteristicId: number;
    value: string;
    sortOrder?: number;
    characteristic: { id: number; name: string };
};

export type ProductFormExisting = {
    name: string;
    articleNumber: string | null;
    brandId?: number | null;
    brand?: { id: number; name: string } | null;
    unitId?: number;
    unit?: { id: number; name: string; shortName: string } | null;
    attributeValues?: ProductAttributeValueShape[];
    characteristicValues?: ProductCharacteristicValueShape[];
    photos: { id: number }[];
};

export function useProductFormState(editId: number | null, existing: ProductFormExisting | null | undefined) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const pendingFilesRef = useRef(pendingFiles);
    const prevEditIdRef = useRef<number | null | undefined>(undefined);
    const loadedSnapshotRef = useRef<string | null>(null);

    function buildExistingSnapshot(product: ProductFormExisting) {
        const attrIds = (product.attributeValues ?? []).map((v) => v.attribute.id).join(',');
        const charIds = (product.characteristicValues ?? [])
            .map((v) => `${v.characteristicId}:${v.value}`)
            .join(',');
        const photoIds = product.photos.map((p) => p.id).join(',');
        return `${product.name}|${resolveProductUnitId(product)}|${product.articleNumber ?? ''}|${attrIds}|${charIds}|${photoIds}`;
    }
    pendingFilesRef.current = pendingFiles;

    const [selectedAttrs, setSelectedAttrs] = useState<Record<number, number | null>>({});
    const [charValues, setCharValues] = useState<Record<number, string>>({});

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

    const attrsTreeByType = useMemo(
        () => buildAttributesTreeByType(allAttributes as AttributeListItem[] | undefined),
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

    const attributesList = allAttributes as AttributeListItem[] | undefined;

    const linkedCharIdsOrdered = useMemo(
        () => collectLinkedCharacteristicIds(selectedAttrs, attributesList ?? []),
        [selectedAttrs, attributesList],
    );

    const linkedCharIdsKey = useMemo(() => linkedCharIdsOrdered.join(','), [linkedCharIdsOrdered]);

    const activeCharFields = useMemo(() => {
        const names = new Map((allCharacteristics ?? []).map((c) => [c.id, c.name]));
        return linkedCharIdsOrdered.map((id) => ({
            id,
            name: names.get(id) ?? `#${id}`,
        }));
    }, [linkedCharIdsOrdered, allCharacteristics]);

    function characteristicsPayload() {
        return linkedCharIdsOrdered
            .map((id, index) => ({
                characteristicId: id,
                value: (charValues[id] ?? '').trim(),
                sortOrder: index,
            }))
            .filter((c) => c.value);
    }

    const selectedAttrsKey = useMemo(() => JSON.stringify(selectedAttrs), [selectedAttrs]);

    useEffect(() => {
        if (!attributesList?.length || !attributeTypes?.length || !allCharacteristics?.length) return;

        const suggested = buildAutoCharacteristicValues(
            selectedAttrs,
            attributesList,
            attributeTypes,
            allCharacteristics,
        );

        setCharValues((prev) => {
            const next: Record<number, string> = {};
            for (const cid of linkedCharIdsOrdered) {
                const suggestedVal = suggested[cid]?.trim();
                const prevVal = prev[cid]?.trim();
                if (prevVal) {
                    next[cid] = prev[cid];
                } else if (suggestedVal) {
                    next[cid] = suggestedVal;
                } else {
                    next[cid] = '';
                }
            }
            return next;
        });
    }, [selectedAttrsKey, linkedCharIdsKey, attributeTypes, allCharacteristics, attributesList, linkedCharIdsOrdered]);

    useEffect(() => {
        return () => revokePendingFiles(pendingFilesRef.current);
    }, []);

    useEffect(() => {
        if (!editId || !existing) return;

        const snapshot = `${editId}:${buildExistingSnapshot(existing)}`;
        const shouldReset = loadedSnapshotRef.current !== snapshot;
        loadedSnapshotRef.current = snapshot;

        if (shouldReset) {
            form.reset({
                name: existing.name,
                articleNumber: existing.articleNumber ?? '',
                unitId: resolveProductUnitId(existing),
            });
            setPendingFiles((prev) => {
                revokePendingFiles(prev);
                return [];
            });
        }

        const map: Record<number, number | null> = {};
        for (const v of existing.attributeValues ?? []) {
            map[v.attribute.typeId] = v.attribute.id;
        }
        const existingBrandId = existing.brand?.id ?? existing.brandId ?? null;
        if (existingBrandId != null) {
            const brandAttr = attributesList?.find((a) => a.id === existingBrandId);
            if (brandAttr?.typeId != null && map[brandAttr.typeId] == null) {
                map[brandAttr.typeId] = existingBrandId;
            }
        }
        if (shouldReset) {
            setSelectedAttrs(map);
            const linked = new Set(collectLinkedCharacteristicIds(map, attributesList ?? []));
            const chars: Record<number, string> = {};
            for (const cv of existing.characteristicValues ?? []) {
                if (linked.has(cv.characteristicId)) {
                    chars[cv.characteristicId] = cv.value;
                }
            }
            setCharValues(chars);
        } else if (existingBrandId != null && allAttributes?.length) {
            setSelectedAttrs((prev) => {
                const brandAttr = (allAttributes as AttributeListItem[]).find((a) => a.id === existingBrandId);
                if (brandAttr?.typeId == null || prev[brandAttr.typeId] != null) return prev;
                return { ...prev, [brandAttr.typeId]: existingBrandId };
            });
        }

        const serverPhotoIds = existing.photos.map((p) => p.id);
        setPhotoIds((prev) => {
            if (shouldReset) return serverPhotoIds;
            if (prev.length > serverPhotoIds.length && serverPhotoIds.every((id) => prev.includes(id))) {
                return prev;
            }
            if (prev.join(',') === serverPhotoIds.join(',')) return prev;
            return serverPhotoIds;
        });
    }, [editId, existing, form, allAttributes, attributesList]);

    useEffect(() => {
        const prev = prevEditIdRef.current;
        prevEditIdRef.current = editId;
        if (editId != null) return;
        if (prev === editId) return;

        loadedSnapshotRef.current = null;
        form.reset({
            name: '',
            articleNumber: '',
            unitId: units?.[0]?.id ?? 0,
        });
        setSelectedAttrs({});
        setCharValues({});
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
        attrsTreeByType,
        childrenOfType,
        selectedAttrs,
        charValues,
        setCharValues,
        activeCharFields,
        handleSelectType,
        photoIds,
        setPhotoIds,
        pendingFiles,
        setPendingFiles,
        basePayload,
        isCreating: !editId,
    };
}
