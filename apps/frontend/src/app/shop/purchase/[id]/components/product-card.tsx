'use client';

import type { CurrencyRate } from '@zakupki/types';
import { useRouter } from 'next/navigation';
import { memo, useCallback } from 'react';

import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { buildStepHint } from '@/app/shop/lib/format-step-hint';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { formatPriceRub } from '@/lib/format/money';
import { pluralRu } from '@/lib/format/plural';
import { cn } from '@/lib/utils';

import { ProductCardControls } from './product-card-controls';
import { ProductCardMedia } from './product-card-media';
import type { ProductGridItem } from './product-grid';

interface ShopPurchaseItemProductCardProps {
    item: ProductGridItem;
    purchaseId: number;
    packDiscountPercent: number;
    orgFeeDefaultPercent: number;
    currencyRates: CurrencyRate[];
    currentQuantity?: number;
    currentPackageCount?: number;
    baseQuantity?: number | null;
    isSupplement: boolean;
    canAddPackage: boolean;
    fulfillmentStatus: string;
    onOrderChange?: () => void;
}

function ProductCardImpl({
    item,
    purchaseId,
    packDiscountPercent,
    orgFeeDefaultPercent,
    currencyRates,
    currentQuantity = 0,
    currentPackageCount = 0,
    baseQuantity: baseQuantityProp,
    fulfillmentStatus,
}: ShopPurchaseItemProductCardProps) {
    const router = useRouter();
    const purchaseItemId = item.purchaseItemId ?? item.id;
    const product = item.product;

    const ctx = useItemOrderControls({
        purchaseId,
        purchaseItemId,
        item,
        currentQuantity,
        currentPackageCount,
        baseQuantity: baseQuantityProp ?? 0,
        fulfillmentStatus,
        packDiscountPercent,
        orgFeeDefaultPercent,
        currencyRates,
    });

    const photo = product.photos?.[0];
    const photoIds = product.photos?.map((p: { id: number }) => p.id);
    const detailHref = `/shop/purchase/${purchaseId}/item/${purchaseItemId}`;

    const goToDetail = useCallback(() => {
        router.push(detailHref);
    }, [router, detailHref]);

    const stop = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    const packInfo = ctx.packDiscountInfo;

    const minHint = buildStepHint(
        {
            minPackageAmount: item.minPackageAmount,
            minPackageUnit: item.minPackageUnit,
            supplementStep: item.supplementStep,
        },
        fulfillmentStatus,
        ctx.shortName,
    );

    const hasOrder = ctx.hasOrder;
    const packagesOrderable = ctx.showPackageButtons && ctx.canAddPackage;
    const isSoldOutNoOrder = ctx.isSoldOut && !hasOrder && !packagesOrderable;
    const looseOrderable = ctx.currentQuantity > 0 || ctx.maxAllowed > ctx.currentQuantity;
    const showPackHint = packInfo != null && (hasOrder ? ctx.fullPacks > 0 : true);
    const showMinHint = minHint != null && !hasOrder && looseOrderable;

    const orderSubtitle = hasOrder
        ? `${ctx.currentQuantity > 0 ? `${ctx.currentQuantity} ${ctx.shortName}` : ''}${
              ctx.currentQuantity > 0 && ctx.currentPackageCount > 0 ? ' + ' : ''
          }${ctx.currentPackageCount > 0 ? `${ctx.currentPackageCount} упак.` : ''}`
        : null;

    return (
        <div
            className={cn(
                'group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-bg-soft',
                'transition-all duration-200 ease-out hover:shadow-lg max-sm:flex-row',
                hasOrder ? 'border-gold' : 'border-transparent',
                isSoldOutNoOrder && 'opacity-80',
            )}
        >
            <ProductCardMedia
                productName={product.name}
                photoId={photo?.id}
                photoIds={photoIds}
                goToDetail={goToDetail}
                isSoldOutNoOrder={isSoldOutNoOrder}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
                <button
                    type="button"
                    onClick={goToDetail}
                    aria-label={`Открыть карточку товара ${product.name}`}
                    className="block text-left"
                >
                    <PurchaseProductLabel
                        product={product}
                        className="min-w-0 overflow-hidden"
                        primaryClassName={cn(
                            'block font-display text-18-bold leading-tight text-fg-primary line-clamp-2',
                            'transition-colors group-hover:text-secondary sm:text-20-bold',
                        )}
                        secondaryClassName="mt-1 block line-clamp-2 text-11-regular text-fg-tertiary sm:text-12-regular"
                    />
                </button>

                {showMinHint && <p className="text-11-regular text-fg-tertiary sm:text-12-regular">{minHint}</p>}

                {ctx.freeRemainderLabel && (
                    <p className="text-12-bold text-secondary tabular-nums sm:text-14-bold">
                        {ctx.freeRemainderLabel}
                    </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1.5">
                    <span className="whitespace-nowrap font-display text-18-semibold text-fg-primary tabular-nums sm:text-20-semibold">
                        {formatPriceRub(hasOrder ? ctx.total : ctx.price)}
                        <span className="ml-1 font-sans text-11-regular font-normal text-fg-tertiary sm:text-12-regular">
                            /{ctx.shortName}
                        </span>
                    </span>
                    {showPackHint && (
                        <span
                            className={cn(
                                'inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5',
                                'text-11-semibold text-secondary sm:text-12-semibold',
                            )}
                        >
                            {ctx.hasOrder
                                ? `−${packInfo.discountPercent}% · ${ctx.fullPacks} ${pluralRu(ctx.fullPacks, ['пачка', 'пачки', 'пачек'])}`
                                : `−${packInfo.discountPercent}% на целую пачку`}
                        </span>
                    )}
                </div>

                {hasOrder && orderSubtitle && (
                    <p className="text-11-regular text-fg-secondary tabular-nums sm:text-12-regular">
                        В заказе: {orderSubtitle}
                    </p>
                )}

                <div className="mt-1.5" onClick={stop} onPointerDown={stop}>
                    <ProductCardControls ctx={ctx} isSoldOutNoOrder={isSoldOutNoOrder} stop={stop} />
                </div>
            </div>
        </div>
    );
}

function arePropsEqual(prev: ShopPurchaseItemProductCardProps, next: ShopPurchaseItemProductCardProps): boolean {
    return (
        prev.purchaseId === next.purchaseId &&
        prev.packDiscountPercent === next.packDiscountPercent &&
        prev.fulfillmentStatus === next.fulfillmentStatus &&
        prev.isSupplement === next.isSupplement &&
        prev.canAddPackage === next.canAddPackage &&
        prev.baseQuantity === next.baseQuantity &&
        prev.currentQuantity === next.currentQuantity &&
        prev.currentPackageCount === next.currentPackageCount &&
        prev.item === next.item
    );
}

export const ProductCard = memo(ProductCardImpl, arePropsEqual);
ProductCard.displayName = 'ProductCard';
