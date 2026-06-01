'use client';

import { Percent } from 'lucide-react';
import { formatPackDiscountBanner } from '@zakupki/types';

type PackDiscountBannerProps = {
    discountPercent: number;
};

export function PackDiscountBanner({ discountPercent }: PackDiscountBannerProps) {
    return (
        <div className="flex gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-foreground">
            <Percent className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>{formatPackDiscountBanner(discountPercent)}</p>
        </div>
    );
}
