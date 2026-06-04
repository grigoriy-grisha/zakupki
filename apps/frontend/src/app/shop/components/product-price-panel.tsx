'use client';

import { getPackDiscountPricingInfo, parsePriceTiers } from '@zakupki/types';
import type { ProductPriceDescriptionFields } from '@/app/shop/lib/format-product-price-rows';

type ProductPricePanelProps = {
    product: ProductPriceDescriptionFields;
    priceOverride?: string | number | null;
    unitShort: string;
    packDiscountPercent: number;
};

function formatQty(amount: number): string {
    return amount % 1 === 0 ? String(amount) : amount.toFixed(3).replace(/\.?0+$/, '');
}

export function ProductPricePanel({
    product,
    priceOverride,
    unitShort,
    packDiscountPercent,
}: ProductPricePanelProps) {
    const packInfo = getPackDiscountPricingInfo(product, packDiscountPercent);

    if (priceOverride != null && priceOverride !== '') {
        const override = Number(priceOverride);
        if (Number.isFinite(override) && override > 0) {
            return (
                <div className="flex items-baseline justify-between gap-4">
                    <span className="text-lg text-muted-foreground">Цена</span>
                    <p>
                        <span className="text-3xl font-bold text-primary">
                            {override.toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-lg text-muted-foreground">/{unitShort}</span>
                    </p>
                </div>
            );
        }
    }

    const tiers = parsePriceTiers(product.priceTiers).sort((a, b) => a.amount - b.amount);

    const packAmount = product.supplierPackageAmount;
    const packUnit = product.supplierPackageUnit;
    const packPrice = product.supplierPackagePrice;
    const hasSupplierPack =
        packAmount != null &&
        packUnit &&
        packPrice != null &&
        Number(packAmount) > 0 &&
        Number(packPrice) > 0;

    if (tiers.length === 0 && !hasSupplierPack) {
        const perUnit = Number(product.pricePerUnit);
        if (!Number.isFinite(perUnit) || perUnit <= 0) return null;
        return (
            <p>
                <span className="text-3xl font-bold text-primary">{perUnit.toLocaleString('ru-RU')} ₽</span>
                <span className="text-lg text-muted-foreground">/{unitShort}</span>
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {tiers.map((tier) => {
                const unit = tier.unit ?? unitShort;
                return (
                    <div
                        key={`${tier.amount}-${tier.price}-${unit}`}
                        className="flex items-baseline justify-between gap-4"
                    >
                        <span className="text-lg text-muted-foreground">
                            {formatQty(tier.amount)} {unit}
                        </span>
                        <span className="text-2xl font-bold text-primary tabular-nums">
                            {tier.price.toLocaleString('ru-RU')} ₽
                        </span>
                    </div>
                );
            })}

            {hasSupplierPack && (
                <div className="space-y-1 border-t border-border/50 pt-3">
                    <p className="text-base text-muted-foreground">Фасовка поставщика</p>
                    <p className="text-lg leading-snug">
                        <span className="font-medium">
                            {formatQty(Number(packAmount))} {packUnit} —{' '}
                        </span>
                        {packInfo != null ? (
                            <>
                                <span className="text-muted-foreground line-through decoration-muted-foreground/80">
                                    {packInfo.packPrice.toLocaleString('ru-RU')} ₽
                                </span>{' '}
                                <span className="text-2xl font-bold text-primary tabular-nums">
                                    {packInfo.discountedPackPrice.toLocaleString('ru-RU')} ₽
                                </span>
                            </>
                        ) : (
                            <span className="text-2xl font-bold text-primary tabular-nums">
                                {Number(packPrice).toLocaleString('ru-RU')} ₽
                            </span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
