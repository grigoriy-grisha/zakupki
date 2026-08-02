'use client';

import { Percent } from 'lucide-react';
import { formatPackDiscountHint, type PackDiscountPricingInfo } from '@zakupki/types';

type PackDiscountHintProps = {
    info: PackDiscountPricingInfo | null;
    className?: string;
};

export function PackDiscountHint({ info, className }: PackDiscountHintProps) {
    if (!info) return null;

    return (
        <p className={`flex items-start gap-1.5 text-xs text-success ${className ?? ''}`}>
            <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{formatPackDiscountHint(info)}</span>
        </p>
    );
}
