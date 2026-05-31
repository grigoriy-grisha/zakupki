'use client';

import { useMemo } from 'react';

import {
    buildShowInTitleByTypeId,
    formatPurchaseProductLabel,
    type ProductLabelSource,
} from '@/app/(admin)/products/lib';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

interface PurchaseProductLabelProps {
    product: ProductLabelSource;
    className?: string;
    primaryClassName?: string;
    secondaryClassName?: string;
    as?: 'div' | 'span';
}

export function PurchaseProductLabel({
    product,
    className,
    primaryClassName,
    secondaryClassName,
    as: Tag = 'div',
}: PurchaseProductLabelProps) {
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const showInTitleByTypeId = useMemo(
        () => buildShowInTitleByTypeId(attributeTypes),
        [attributeTypes],
    );
    const label = formatPurchaseProductLabel(product, showInTitleByTypeId, attributeTypes);
    const LineTag = Tag === 'span' ? 'span' : 'div';
    const lineClass = Tag === 'span' ? 'block leading-snug' : 'leading-snug';

    if (label.lines.length === 0) {
        return <Tag className={className}>{product.name}</Tag>;
    }

    return (
        <Tag className={className}>
            {label.lines.map((line, index) => (
                <LineTag
                    key={`${index}-${line}`}
                    className={cn(
                        lineClass,
                        index === 0 ? primaryClassName : secondaryClassName ?? 'text-muted-foreground',
                    )}
                >
                    {line}
                </LineTag>
            ))}
        </Tag>
    );
}

export function usePurchaseProductLabelText(product: ProductLabelSource) {
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();
    const showInTitleByTypeId = useMemo(
        () => buildShowInTitleByTypeId(attributeTypes),
        [attributeTypes],
    );

    return formatPurchaseProductLabel(product, showInTitleByTypeId, attributeTypes).text || product.name;
}
