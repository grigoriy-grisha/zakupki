'use client';

import type { PackDiscountPricingInfo } from '@zakupki/types';

type ProductPricePanelProps = {
    product: { name?: string };
    unitShort: string;
    /** Цена за единицу по новой модели (валюта × курс × оргсбор). */
    unitPriceRub?: number | null;
    /** Информация о скидке за целую пачку (опц.). */
    packDiscountInfo?: PackDiscountPricingInfo | null;
};

function formatQty(amount: number): string {
    return amount % 1 === 0 ? String(amount) : amount.toFixed(3).replace(/\.?0+$/, '');
}

export function ProductPricePanel({ unitShort, unitPriceRub, packDiscountInfo }: ProductPricePanelProps) {
    if (unitPriceRub == null || unitPriceRub <= 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
                <span className="text-lg text-muted-foreground">Цена</span>
                <p>
                    <span className="text-3xl font-bold text-primary">
                        {unitPriceRub.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                    </span>
                    <span className="text-lg text-muted-foreground">/{unitShort}</span>
                </p>
            </div>
            {packDiscountInfo && (
                <div className="space-y-1 border-t border-border/50 pt-3">
                    <p className="text-base text-muted-foreground">Скидка за целую пачку</p>
                    <p className="text-lg leading-snug">
                        <span className="font-medium">
                            {formatQty(packDiscountInfo.packSize)} {unitShort} —{' '}
                        </span>
                        <span className="text-muted-foreground line-through decoration-muted-foreground/80">
                            {packDiscountInfo.packPrice.toLocaleString('ru-RU')} ₽
                        </span>{' '}
                        <span className="text-2xl font-bold text-primary tabular-nums">
                            {packDiscountInfo.discountedPackPrice.toLocaleString('ru-RU')} ₽
                        </span>
                    </p>
                </div>
            )}
        </div>
    );
}
