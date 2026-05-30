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

    if (!label.line1 && !label.line2) {
        return <Tag className={className}>{product.name}</Tag>;
    }

    return (
        <Tag className={className}>
            {label.line1 ? <div className={cn('leading-snug', primaryClassName)}>{label.line1}</div> : null}
            {label.line2 ? (
                <div className={cn('leading-snug', label.line1 ? secondaryClassName ?? 'text-muted-foreground' : primaryClassName)}>
                    {label.line2}
                </div>
            ) : null}
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
