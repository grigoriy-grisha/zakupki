'use client';

import { useMemo } from 'react';

import { trpc } from '@/lib/client/trpc';
import { type AttributeListItem, buildAttributesTreeByType } from '@/lib/product-form-utils';

/**
 * Общий хук для каталога атрибутов.
 * Используется в useProductFormState и useProductTree, чтобы не дублировать запросы.
 */
export function useAttributeCatalog() {
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();

    const attrsTreeByType = useMemo(
        () => buildAttributesTreeByType(allAttributes as AttributeListItem[] | undefined),
        [allAttributes],
    );

    return { attributeTypes, allAttributes: allAttributes as AttributeListItem[] | undefined, attrsTreeByType };
}
