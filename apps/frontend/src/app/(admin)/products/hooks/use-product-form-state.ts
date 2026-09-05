'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { trpc } from '@/lib/client/trpc';
import { type PendingFile, revokePendingFiles } from '@/lib/product-form-utils';

import { type ProductCreateFormValues, productCreateSchema } from '../lib';
import { useAttributeCatalog } from './use-attribute-catalog';
import { useCharacteristicValues } from './use-characteristic-values';
import { usePhotoState } from './use-photo-state';

type ProductAttributeValueShape = {
    attribute: { id: number; typeId: number };
};

type ProductCharacteristicValueShape = {
    characteristicId: number;
    value: string;
    showOnCard?: boolean;
    sortOrder?: number;
    characteristic: { id: number; name: string };
};

export type ProductFormExisting = {
    name: string;
    articleNumber: string | null;
    brandId?: number | null;
    brand?: { id: number; name: string } | null;
    unitCode?: string;
    attributeValues?: ProductAttributeValueShape[];
    characteristicValues?: ProductCharacteristicValueShape[];
    photos: { id: number }[];
};

export function useProductFormState(editId: number | null, existing: ProductFormExisting | null | undefined) {
    const pendingFilesRef = useRef<PendingFile[]>([]);
    const prevEditIdRef = useRef<number | null | undefined>(undefined);
    const loadedSnapshotRef = useRef<string | null>(null);

    const [selectedAttrs, setSelectedAttrs] = useState<Record<number, number | null>>({});

    const { attributeTypes, allAttributes, attrsTreeByType } = useAttributeCatalog();
    const { data: allCharacteristics } = trpc.characteristics.list.useQuery();

    const form = useForm<ProductCreateFormValues>({
        resolver: zodResolver(productCreateSchema),
        defaultValues: {
            name: '',
            articleNumber: '',
            unitCode: '',
        },
    });

    const unitCode = form.watch('unitCode');

    // Attribute tree + children
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

    // Photo state
    const { photoIds, setPhotoIds, pendingFiles, setPendingFiles } = usePhotoState(editId, existing?.photos);
    pendingFilesRef.current = pendingFiles;

    // Characteristic values
    const { charValues, setCharValues, charShowOnCard, setShowOnCard, activeCharFields, characteristicsPayload } =
        useCharacteristicValues(
            selectedAttrs,
            allAttributes,
            attributeTypes as { id: number; name: string; parentId: number | null; position: number }[] | undefined,
            allCharacteristics as { id: number; name: string }[] | undefined,
            existing?.characteristicValues,
        );

    // Build snapshot for detecting real changes
    function buildExistingSnapshot(product: ProductFormExisting) {
        const attrIds = (product.attributeValues ?? []).map((v) => v.attribute.id).join(',');
        const charIds = (product.characteristicValues ?? [])
            .map((v) => `${v.characteristicId}:${v.value}:${v.showOnCard ? 1 : 0}`)
            .join(',');
        const photoIdsStr = product.photos.map((p) => p.id).join(',');
        return `${product.name}|${product.unitCode ?? ''}|${product.articleNumber ?? ''}|${attrIds}|${charIds}|${photoIdsStr}`;
    }

    // Load existing product data
    useEffect(() => {
        if (!editId || !existing) return;

        const snapshot = `${editId}:${buildExistingSnapshot(existing)}`;
        const shouldReset = loadedSnapshotRef.current !== snapshot;
        loadedSnapshotRef.current = snapshot;

        if (shouldReset) {
            form.reset({
                name: existing.name,
                articleNumber: existing.articleNumber ?? '',
                unitCode: existing.unitCode ?? '',
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
            const brandAttr = allAttributes?.find((a) => a.id === existingBrandId);
            if (brandAttr?.typeId != null && map[brandAttr.typeId] == null) {
                map[brandAttr.typeId] = existingBrandId;
            }
        }
        if (shouldReset) {
            setSelectedAttrs(map);
        } else if (existingBrandId != null && allAttributes?.length) {
            setSelectedAttrs((prev) => {
                const brandAttr = allAttributes.find((a) => a.id === existingBrandId);
                if (brandAttr?.typeId == null || prev[brandAttr.typeId] != null) return prev;
                return { ...prev, [brandAttr.typeId]: existingBrandId };
            });
        }

        const serverPhotoIds = existing.photos.map((p) => p.id);
        setPhotoIds((prev) => {
            if (shouldReset) return serverPhotoIds;
            if (prev.length > serverPhotoIds.length && serverPhotoIds.every((id) => prev.includes(id))) return prev;
            if (prev.join(',') === serverPhotoIds.join(',')) return prev;
            return serverPhotoIds;
        });
    }, [editId, existing, form, allAttributes]);

    // Reset for new product
    useEffect(() => {
        const prev = prevEditIdRef.current;
        prevEditIdRef.current = editId;
        if (editId != null) return;
        if (prev === editId) return;

        loadedSnapshotRef.current = null;
        form.reset({
            name: '',
            articleNumber: '',
            unitCode: 'piece',
        });
        setSelectedAttrs({});
        setCharValues({});
    }, [editId, form]);

    function selectedAttributeIds(): number[] {
        return Object.values(selectedAttrs).filter((id): id is number => typeof id === 'number');
    }

    function basePayload(data: ProductCreateFormValues) {
        return {
            name: data.name,
            articleNumber: data.articleNumber?.trim() || null,
            unitCode: data.unitCode,
            attributeIds: selectedAttributeIds(),
            characteristics: characteristicsPayload(),
        };
    }

    return {
        form,
        unitCode,
        attributeTypes,
        attrsTreeByType,
        childrenOfType,
        selectedAttrs,
        charValues,
        setCharValues,
        charShowOnCard,
        setShowOnCard,
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
