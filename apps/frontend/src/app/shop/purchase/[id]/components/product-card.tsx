'use client';

import type { CurrencyRate } from '@zakupki/types';
import { Percent } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useCallback } from 'react';

import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { buildStepHint } from '@/app/shop/lib/format-step-hint';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Card } from '@/components/ui/card';
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
    isSupplement,
    canAddPackage,
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

    const supplierName = item.supplier?.name as string | undefined;

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
    const isSoldOutNoOrder = ctx.isSoldOut && !hasOrder;
    const showPackHint = packInfo != null && !hasOrder && !isSoldOutNoOrder;
    const showInCartDiscount = packInfo != null && hasOrder && ctx.fullPacks > 0;
    const showMinHint = minHint != null && !hasOrder;

    const orderSubtitle = hasOrder
        ? `${ctx.currentQuantity > 0 ? `${ctx.currentQuantity} ${ctx.shortName}` : ''}${
              ctx.currentQuantity > 0 && ctx.currentPackageCount > 0 ? ' + ' : ''
          }${ctx.currentPackageCount > 0 ? `${ctx.currentPackageCount} упак.` : ''}`
        : null;

    return (
        <Card
            rounded="2xl"
            className={cn(
                'group relative flex h-full flex-col overflow-hidden border py-0 transition-all duration-200 ease-out',
                'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg',
                hasOrder && 'border-primary/50 bg-primary/[0.04] shadow-md shadow-primary/5',
                isSoldOutNoOrder && 'opacity-80',
            )}
        >
            <ProductCardMedia
                productName={product.name}
                photoId={photo?.id}
                photoIds={photoIds}
                goToDetail={goToDetail}
                showPackHint={showPackHint}
                discountPercent={packInfo?.discountPercent}
                hasOrder={hasOrder}
                isSoldOut={ctx.isSoldOut}
                isSoldOutNoOrder={isSoldOutNoOrder}
                currentQuantity={ctx.currentQuantity}
                currentPackageCount={ctx.currentPackageCount}
            />

            <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3.5">
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
                            'block text-13-semibold leading-snug text-fg-primary line-clamp-2',
                            'transition-colors group-hover:text-primary sm:text-14-semibold',
                        )}
                        secondaryClassName="mt-0.5 block truncate text-11-regular text-fg-tertiary sm:text-12-regular"
                    />
                </button>

                {supplierName && (
                    <p
                        className="-mt-0.5 block truncate text-11-regular text-fg-tertiary sm:text-12-regular"
                        title={supplierName}
                    >
                        {supplierName}
                    </p>
                )}

                {showMinHint && <p className="text-11-regular text-fg-tertiary sm:text-12-regular">{minHint}</p>}

                {ctx.freeRemainderLabel && <p className="text-12-medium text-warning">{ctx.freeRemainderLabel}</p>}

                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    {hasOrder ? (
                        <span className="text-16-semibold text-fg-primary tabular-nums sm:text-18-semibold">
                            {formatPriceRub(ctx.total)}
                        </span>
                    ) : (
                        <>
                            <span className="text-16-semibold text-fg-primary tabular-nums sm:text-18-semibold">
                                {formatPriceRub(ctx.price)}
                            </span>
                            <span className="text-11-regular text-fg-tertiary sm:text-12-regular">
                                / {ctx.shortName}
                            </span>
                        </>
                    )}
                    {showInCartDiscount && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-0.5 rounded bg-success/10 px-1 py-0.5',
                                'text-12-semibold text-success tabular-nums',
                            )}
                        >
                            <Percent className="size-2.5" />−{packInfo.discountPercent}% · {ctx.fullPacks}{' '}
                            {pluralRu(ctx.fullPacks, ['пачку', 'пачки', 'пачек'])}
                        </span>
                    )}
                </div>

                {hasOrder && orderSubtitle && (
                    <p className="-mt-1 text-12-regular text-fg-secondary tabular-nums">{orderSubtitle}</p>
                )}

                <div className="mt-auto pt-1.5" onClick={stop} onPointerDown={stop}>
                    <ProductCardControls ctx={ctx} isSoldOutNoOrder={isSoldOutNoOrder} stop={stop} />
                </div>
            </div>
        </Card>
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
