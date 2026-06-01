'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trpc } from '@/lib/client/trpc';
import { productCreateSchema, type ProductCreateFormValues } from '../lib';
import { useUnits } from './use-products';
import {
    getAttributeCharacteristicIds,
    buildAttributesTreeByType,
    revokePendingFiles,
    resolveProductUnitId,
    syncCharacteristicOrder,
    moveCharacteristicOrder,
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
    const [manualCharIds, setManualCharIds] = useState<number[]>([]);
    const [charOrder, setCharOrder] = useState<number[]>([]);

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

    const linkedCharIds = useMemo(() => {
        const ids = new Set<number>();
        for (const attrId of Object.values(selectedAttrs)) {
            if (attrId == null) continue;
            const attr = (allAttributes as AttributeListItem[] | undefined)?.find((a) => a.id === attrId);
            for (const cid of getAttributeCharacteristicIds(attr)) ids.add(cid);
        }
        return ids;
    }, [selectedAttrs, allAttributes]);

    const linkedCharIdsKey = useMemo(
        () => [...linkedCharIds].sort((a, b) => a - b).join(','),
        [linkedCharIds],
    );

    const activeCharIds = useMemo(() => {
        const activeSet = new Set([...linkedCharIds, ...manualCharIds]);
        const ordered = charOrder.filter((id) => activeSet.has(id));
        for (const id of activeSet) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return ordered;
    }, [linkedCharIds, manualCharIds, charOrder]);

    const activeCharFields = useMemo(() => {
        const names = new Map((allCharacteristics ?? []).map((c) => [c.id, c.name]));
        return activeCharIds.map((id) => ({
            id,
            name: names.get(id) ?? `#${id}`,
        }));
    }, [activeCharIds, allCharacteristics]);

    function handleActiveCharIdsChange(ids: number[]) {
        const manual = ids.filter((id) => !linkedCharIds.has(id));
        setManualCharIds(manual);
        setCharOrder((prev) => syncCharacteristicOrder(prev, ids));
        setCharValues((prev) => {
            const next = { ...prev };
            const keep = new Set(ids);
            for (const key of Object.keys(next)) {
                if (!keep.has(Number(key))) delete next[Number(key)];
            }
            return next;
        });
    }

    function handleMoveCharacteristic(characteristicId: number, direction: 'up' | 'down') {
        setCharOrder((prev) => moveCharacteristicOrder(prev, characteristicId, direction));
    }

    function characteristicsPayload() {
        return activeCharIds
            .map((id, index) => ({
                characteristicId: id,
                value: (charValues[id] ?? '').trim(),
                sortOrder: index,
            }))
            .filter((c) => c.value);
    }

    useEffect(() => {
        const activeIds = [...new Set([...linkedCharIds, ...manualCharIds])];
        setCharOrder((prev) => syncCharacteristicOrder(prev, activeIds));
    }, [linkedCharIdsKey, manualCharIds, linkedCharIds]);

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
            const brandAttr = (allAttributes as AttributeListItem[] | undefined)?.find(
                (a) => a.id === existingBrandId,
            );
            if (brandAttr?.typeId != null && map[brandAttr.typeId] == null) {
                map[brandAttr.typeId] = existingBrandId;
            }
        }
        if (shouldReset) {
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
            const serverOrder = [...(existing.characteristicValues ?? [])]
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((cv) => cv.characteristicId);
            const allActive = [...new Set([...linked, ...manual])];
            setCharValues(chars);
            setManualCharIds(manual);
            setCharOrder(syncCharacteristicOrder(serverOrder, allActive));
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
    }, [editId, existing, form, allAttributes]);

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
        setManualCharIds([]);
        setCharOrder([]);
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
        attrsTreeByType,
        childrenOfType,
        selectedAttrs,
        charValues,
        setCharValues,
        linkedCharIds,
        activeCharIds,
        activeCharFields,
        handleSelectType,
        handleActiveCharIdsChange,
        handleMoveCharacteristic,
        photoIds,
        setPhotoIds,
        pendingFiles,
        setPendingFiles,
        basePayload,
        isCreating: !editId,
    };
}
