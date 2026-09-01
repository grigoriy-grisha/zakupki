'use client';

import { useEffect, useMemo, useState } from 'react';

import {
    type AttributeListItem,
    buildAutoCharacteristicValues,
    collectLinkedCharacteristicIds,
} from '@/lib/product-form-utils';

type CharacteristicSource = {
    id: number;
    name: string;
};

type AttributeTypeRow = {
    id: number;
    name: string;
    parentId: number | null;
    position: number;
};

export function useCharacteristicValues(
    selectedAttrs: Record<number, number | null>,
    attributesList: AttributeListItem[] | undefined,
    attributeTypes: AttributeTypeRow[] | undefined,
    allCharacteristics: CharacteristicSource[] | undefined,
    existingCharValues?: { characteristicId: number; value: string }[],
) {
    const [charValues, setCharValues] = useState<Record<number, string>>({});

    const linkedCharIdsOrdered = useMemo(
        () => collectLinkedCharacteristicIds(selectedAttrs, attributesList ?? []),
        [selectedAttrs, attributesList],
    );

    const activeCharFields = useMemo(() => {
        const names = new Map((allCharacteristics ?? []).map((c) => [c.id, c.name]));
        return linkedCharIdsOrdered.map((id) => ({
            id,
            name: names.get(id) ?? `#${id}`,
        }));
    }, [linkedCharIdsOrdered, allCharacteristics]);

    const savedCharValuesById = useMemo(() => {
        const map = new Map<number, string>();
        for (const cv of existingCharValues ?? []) {
            const value = cv.value?.trim();
            if (value) map.set(cv.characteristicId, cv.value);
        }
        return map;
    }, [existingCharValues]);

    const selectedAttrsKey = useMemo(() => JSON.stringify(selectedAttrs), [selectedAttrs]);
    const linkedCharIdsKey = useMemo(() => linkedCharIdsOrdered.join(','), [linkedCharIdsOrdered]);

    useEffect(() => {
        if (!attributesList?.length || !attributeTypes?.length || !allCharacteristics?.length) return;
        if (linkedCharIdsOrdered.length === 0) return;

        const suggested = buildAutoCharacteristicValues(
            selectedAttrs,
            attributesList,
            attributeTypes,
            allCharacteristics,
        );

        setCharValues((prev) => {
            const next: Record<number, string> = {};
            for (const cid of linkedCharIdsOrdered) {
                const prevVal = prev[cid]?.trim();
                const savedVal = savedCharValuesById.get(cid)?.trim();
                const suggestedVal = suggested[cid]?.trim();
                if (prevVal) {
                    next[cid] = prev[cid];
                } else if (savedVal) {
                    next[cid] = savedCharValuesById.get(cid)!;
                } else if (suggestedVal) {
                    next[cid] = suggestedVal;
                } else {
                    next[cid] = '';
                }
            }
            return next;
        });
    }, [
        selectedAttrsKey,
        linkedCharIdsKey,
        attributeTypes,
        allCharacteristics,
        attributesList,
        linkedCharIdsOrdered,
        savedCharValuesById,
    ]);

    function characteristicsPayload() {
        return linkedCharIdsOrdered
            .map((id, index) => ({
                characteristicId: id,
                value: (charValues[id] ?? '').trim(),
                sortOrder: index,
            }))
            .filter((c) => c.value);
    }

    return { charValues, setCharValues, activeCharFields, linkedCharIdsOrdered, characteristicsPayload };
}
