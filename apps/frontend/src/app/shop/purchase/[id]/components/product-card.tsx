'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { formatMinPackageHint } from '@zakupki/types';
import { QuantityButtons } from '@/app/shop/components/quantity-buttons';
import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { cn } from '@/lib/utils';
import type { ShopPurchaseItem } from '@/app/shop/lib/types';

/**
 * Данные PurchaseItem из tRPC + кол-во пользователя.
 * Продукт приходит из tRPC как AttrProduct (Prisma Decimal→string).
 * Хук useItemOrderControls внутри делает Number() для всех полей.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductCardItem = Record<string, any> & {
    id: number;
    purchaseItemId?: number;
    quantity: number;
    packageCount?: number;
};

interface ShopPurchaseItemProductCardProps {
    item: ProductCardItem;
    purchaseId: number;
    packDiscountPercent: number;
    /** baseQuantity — замороженный снимок при входе в SUPPLEMENT */
    baseQuantity?: number | null;
    isSupplement: boolean;
    /** Можно ли добавлять упаковки (COLLECTION или REORDER) */
    canAddPackage: boolean;
    fulfillmentStatus: string;
    onOrderChange?: () => void;
}

export function ProductCard({
    item,
    purchaseId,
    packDiscountPercent,
    baseQuantity: baseQuantityProp,
    isSupplement,
    canAddPackage,
    fulfillmentStatus,
    onOrderChange,
}: ShopPurchaseItemProductCardProps) {
    const purchaseItemId = item.purchaseItemId ?? item.id;
    const product = item.product;

    const ctx = useItemOrderControls({
        purchaseId,
        purchaseItemId,
        item,
        currentQuantity: item.quantity ?? 0,
        currentPackageCount: item.packageCount ?? 0,
        baseQuantity: baseQuantityProp ?? 0,
        fulfillmentStatus,
        packDiscountPercent,
    });

    const photo = product.photos?.[0];
    const minPackageAmount = product.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product.minPackageUnit ?? null;

    return (
        <Card
            className={cn(
                'group relative flex h-full flex-col gap-0 overflow-hidden rounded-lg border py-0 transition-all',
                ctx.isSoldOut && !ctx.hasOrder && 'opacity-60 border-transparent',
                ctx.hasOrder && 'border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]',
                !ctx.hasOrder && 'border-transparent',
                !ctx.isSoldOut && 'hover:shadow-md',
            )}
            onClick={() => {
                window.location.href = `/shop/purchase/${purchaseId}/item/${purchaseItemId}`;
            }}
            role="link"
            style={{ cursor: 'pointer' }}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <ProductPhotoPreview photoId={photo?.id} alt={product.name} fill />
                {ctx.hasOrder && !ctx.isSoldOut && (
                    <>
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1] rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm">
                            В корзине
                        </div>
                        <div className="pointer-events-none absolute top-1.5 right-1.5 z-[1] flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-primary-foreground shadow-sm">
                            <span className="text-[11px] font-bold leading-none tabular-nums">
                                {ctx.currentQuantity}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <CardContent className="flex flex-1 flex-col p-3">
                <div className="min-h-0 flex-1">
                    <PurchaseProductLabel
                        product={product}
                        className="min-w-0 overflow-hidden"
                        primaryClassName="block truncate text-sm font-semibold leading-snug"
                        secondaryClassName="block truncate text-xs text-muted-foreground"
                    />
                    {(() => {
                        const catalogMinHint = formatMinPackageHint({
                            minPackageAmount,
                            minPackageUnit,
                            unitShort: ctx.shortName,
                        });
                        if (!catalogMinHint && !ctx.freeRemainderLabel) return null;
                        return (
                            <div className="mt-0.5 space-y-0.5">
                                {catalogMinHint ? (
                                    <p className="truncate text-xs text-muted-foreground">{catalogMinHint}</p>
                                ) : null}
                                {ctx.freeRemainderLabel ? (
                                    <p className="truncate text-xs font-medium text-warning">
                                        {ctx.freeRemainderLabel}
                                    </p>
                                ) : null}
                            </div>
                        );
                    })()}
                    <div className="mt-2">
                        <span className="text-lg font-bold text-primary">{ctx.price.toLocaleString('ru-RU')} ₽</span>
                        <span className="text-sm text-muted-foreground">/{ctx.shortName}</span>
                    </div>
                </div>

                {ctx.isSoldOut && !ctx.hasOrder ? (
                    <Button className="mt-2.5 h-9 w-full shrink-0 text-xs" variant="secondary" disabled>
                        Разобрано
                    </Button>
                ) : (
                    <div className="mt-auto shrink-0 space-y-2 pt-2.5">
                        <div className="flex min-h-[2.75rem] flex-col justify-center text-center">
                            {ctx.hasOrder && (
                                <>
                                    <span className="text-sm text-muted-foreground">
                                        {ctx.currentQuantity > 0 && `${ctx.currentQuantity} ${ctx.shortName}`}
                                        {ctx.currentQuantity > 0 && ctx.currentPackageCount > 0 && ' + '}
                                        {ctx.currentPackageCount > 0 && `${ctx.currentPackageCount} упак.`} ·{' '}
                                        <span className="font-semibold text-foreground">
                                            {ctx.total.toLocaleString('ru-RU')} ₽
                                        </span>
                                    </span>
                                    {ctx.fullPacks > 0 ? (
                                        <p className="text-[10px] text-success">
                                            Скидка за {ctx.fullPacks} {ctx.fullPacks === 1 ? 'пачку' : 'пачки'}
                                        </p>
                                    ) : (
                                        <span className="block text-[10px] leading-snug opacity-0" aria-hidden>
                                            —
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                            <QuantityButtons
                                activeStep={ctx.activeStep}
                                shortName={ctx.shortName}
                                canAdd={ctx.canAdd}
                                canDecrease={ctx.canDecrease}
                                onAdd={ctx.handleAdd}
                                onRemove={ctx.handleRemove}
                                isPending={ctx.isPending}
                                showPackage={ctx.showPackageButtons}
                                packSize={ctx.packSize}
                                packageCount={ctx.currentPackageCount}
                                onAddPackage={ctx.handleAddPackage}
                                onRemovePackage={ctx.handleRemovePackage}
                                size="sm"
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
