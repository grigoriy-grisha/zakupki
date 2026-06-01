'use client';

import { Percent } from 'lucide-react';
import {
    formatPackDiscountHint,
    getPackDiscountPricingInfo,
    type SupplierPackProductFields,
} from '@zakupki/types';

type PackDiscountHintProps = {
    product: SupplierPackProductFields;
    discountPercent: number;
    className?: string;
};

export function PackDiscountHint({ product, discountPercent, className }: PackDiscountHintProps) {
    const info = getPackDiscountPricingInfo(product, discountPercent);
    if (!info) return null;

    return (
        <p className={`flex items-start gap-1.5 text-xs text-success ${className ?? ''}`}>
            <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{formatPackDiscountHint(info)}</span>
        </p>
    );
}
