'use client';

import { Percent } from 'lucide-react';
import { getPackDiscountPricingInfo } from '@zakupki/types';
import type { SupplierPackProductFields } from '@zakupki/types';

type PackDiscountBannerProps = {
    product: SupplierPackProductFields;
    discountPercent: number;
};

export function PackDiscountBanner({ product, discountPercent }: PackDiscountBannerProps) {
    const info = getPackDiscountPricingInfo(product, discountPercent);
    if (!info) return null;

    return (
        <div className="flex gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-foreground">
            <Percent className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>
                Пачка {info.packSize} гр = {info.discountedPackPrice.toLocaleString('ru-RU')} ₽ (−{info.discountPercent}
                %)
            </p>
        </div>
    );
}
