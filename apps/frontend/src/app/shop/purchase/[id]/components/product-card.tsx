'use client';

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Package, Percent, Plus, ShoppingCart } from 'lucide-react';
import { type CurrencyRate } from '@zakupki/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import { buildStepHint } from '@/app/shop/lib/format-step-hint';
import { cn } from '@/lib/utils';
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

function formatRubles(value: number): string {
    return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

function pluralPacks(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'пачку';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пачки';
    return 'пачек';
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

    // Поставщик позиции закупки (опц.). Показываем под названием, чтобы
    // различать одинаковые товары у разных поставщиков.
    const supplierName = item.supplier?.name as string | undefined;

    const goToDetail = useCallback(() => {
        router.push(detailHref);
    }, [router, detailHref]);

    const stop = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    // Скидка за целую пачку: packInfo уже посчитан в ctx через новую модель цен.
    const packInfo = ctx.packDiscountInfo;

    // Подсказка шага с учётом этапа: на сборе — «Мин. фасовка: N ед»,
    // на доборе — «Шаг добора: N ед» (supplementStep ?? minPackageAmount).
    // ProductGridItem — пермиссивный ([key: string]: any), поэтому выбираем
    // только нужные поля явно, чтобы TS принимал их без cast.
    const minHint = buildStepHint(
        {
            minPackageAmount: item.minPackageAmount,
            minPackageUnit: item.minPackageUnit,
            supplementStep: item.supplementStep,
        },
        fulfillmentStatus,
        ctx.shortName,
    );

    // Ценовые тиры (priceTiers) зарезервированы на будущее — показываем базовую цену.

    // Состояния
    const hasOrder = ctx.hasOrder;
    const isSoldOutNoOrder = ctx.isSoldOut && !hasOrder;
    const showPackHint = packInfo != null && !hasOrder && !isSoldOutNoOrder;
    const showInCartDiscount = packInfo != null && hasOrder && ctx.fullPacks > 0;
    const showMinHint = minHint != null && !hasOrder;

    // Подпись под ценой в in-cart состоянии
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
            {/* ── Фото ── */}
            <div
                role="button"
                tabIndex={0}
                onClick={goToDetail}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        goToDetail();
                    }
                }}
                aria-label={`Открыть карточку товара ${product.name}`}
                className="block w-full text-left"
            >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-soft sm:aspect-square">
                    {/* Контейнер с overflow-hidden — оборачиваем, чтобы scale работал корректно */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105">
                            <ProductPhotoPreview
                                photoId={photo?.id}
                                photoIds={photoIds}
                                alt={product.name}
                                fill
                            />
                        </div>
                    </div>

                    {/* Скидочный бейдж — только до добавления в корзину */}
                    {showPackHint && (
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1]">
                            <Badge type="subtle" variant="success" size="sm" className="shadow-sm">
                                <Percent className="mr-0.5 size-3" />−{packInfo.discountPercent}% за пачку
                            </Badge>
                        </div>
                    )}

                    {/* In-cart пилл (сверху-слева) */}
                    {hasOrder && !ctx.isSoldOut && (
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1] flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-12-semibold leading-none text-white shadow-sm">
                            <ShoppingCart className="size-2.5" />В корзине
                        </div>
                    )}

                    {/* In-cart qty-чип (сверху-справа) */}
                    {hasOrder && !ctx.isSoldOut && (
                        <div className="pointer-events-none absolute top-1.5 right-1.5 z-[1] flex h-6 min-w-6 items-center justify-center rounded-full bg-bg-card px-2 text-12-semibold text-fg-primary shadow-sm tabular-nums">
                            {ctx.currentQuantity}
                            {ctx.currentPackageCount > 0 && (
                                <span className="ml-0.5 text-12-regular text-fg-tertiary">
                                    +{ctx.currentPackageCount}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Sold-out затемнение + крупный бейдж */}
                    {isSoldOutNoOrder && (
                        <>
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                            <div className="absolute right-1.5 bottom-1.5 left-1.5 z-[1]">
                                <div className="flex items-center gap-1.5 rounded-lg bg-bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-warning/15">
                                        <Package className="size-3 text-warning" />
                                    </div>
                                    <span className="text-12-semibold text-fg-primary">Разобрано</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Контент ── */}
            <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3.5">
                {/* Заголовок */}
                <button
                    type="button"
                    onClick={goToDetail}
                    aria-label={`Открыть карточку товара ${product.name}`}
                    className="block text-left"
                >
                    <PurchaseProductLabel
                        product={product}
                        className="min-w-0 overflow-hidden"
                        primaryClassName="block text-14-semibold leading-snug text-fg-primary line-clamp-2 transition-colors group-hover:text-primary"
                        secondaryClassName="mt-0.5 block truncate text-12-regular text-fg-tertiary"
                    />
                </button>

                {supplierName && (
                    <p className="-mt-0.5 block truncate text-12-regular text-fg-tertiary" title={supplierName}>
                        {supplierName}
                    </p>
                )}

                {/* Мин. фасовка (подсказка) — подсказка рядом с ценой в одной строке */}
                {showMinHint && <p className="text-12-regular text-fg-tertiary">{minHint}</p>}

                {/* Добор */}
                {ctx.freeRemainderLabel && <p className="text-12-medium text-warning">{ctx.freeRemainderLabel}</p>}

                {/* Цена + скидка в одной строке */}
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    {hasOrder ? (
                        <span className="text-18-semibold text-fg-primary tabular-nums">{formatRubles(ctx.total)}</span>
                    ) : (
                        <>
                            <span className="text-18-semibold text-fg-primary tabular-nums">
                                {formatRubles(ctx.price)}
                            </span>
                            <span className="text-12-regular text-fg-tertiary">/ {ctx.shortName}</span>
                        </>
                    )}
                    {showInCartDiscount && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-success/10 px-1 py-0.5 text-12-semibold text-success tabular-nums">
                            <Percent className="size-2.5" />−{packInfo.discountPercent}% · {ctx.fullPacks}{' '}
                            {pluralPacks(ctx.fullPacks)}
                        </span>
                    )}
                </div>

                {/* In-cart: подпись под ценой с детализацией */}
                {hasOrder && orderSubtitle && (
                    <p className="-mt-1 text-12-regular text-fg-secondary tabular-nums">{orderSubtitle}</p>
                )}

                {/* Контролы — фиксируются внизу карточки через mt-auto */}
                <div className="mt-auto pt-1.5" onClick={stop} onPointerDown={stop}>
                    {isSoldOutNoOrder ? (
                        <Button
                            className="h-9 w-full rounded-lg text-12-medium"
                            variant="secondary"
                            size="default"
                            disabled
                        >
                            <Package className="mr-1 size-3.5" />
                            Разобрано
                        </Button>
                    ) : hasOrder ? (
                        <InCartControls ctx={ctx} />
                    ) : (
                        <div className="flex flex-col gap-1">
                            <Button
                                variant="brand"
                                size="default"
                                className="h-8 w-full rounded-lg text-12-semibold sm:h-9"
                                onClick={(e) => {
                                    stop(e);
                                    ctx.handleAdd();
                                }}
                                disabled={!ctx.canAdd || ctx.isPending}
                            >
                                Добавить
                            </Button>
                            {ctx.showPackageButtons && ctx.packSize != null && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full justify-center text-12-medium"
                                    onClick={(e) => {
                                        stop(e);
                                        ctx.handleAddPackage();
                                    }}
                                    disabled={!ctx.canAddPackage || ctx.isPending}
                                >
                                    <Plus className="mr-1 size-3 shrink-0" />
                                    <span className="truncate">+1 упаковка ({ctx.packSize} {ctx.shortName})</span>
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

/** Компактные ± кнопки в in-cart состоянии (как у маркетплейсов). */
function InCartControls({ ctx }: { ctx: ReturnType<typeof useItemOrderControls> }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-stretch gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    onClick={ctx.handleRemove}
                    disabled={!ctx.canDecrease}
                    aria-label="Уменьшить количество"
                >
                    <Minus className="size-3.5" />
                </Button>
                <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-bg-base text-12-semibold tabular-nums text-fg-primary">
                    {ctx.currentQuantity} {ctx.shortName}
                </div>
                <Button
                    variant="brand"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    onClick={ctx.handleAdd}
                    disabled={!ctx.canAdd}
                    aria-label="Увеличить количество"
                >
                    <Plus className="size-3.5" />
                </Button>
            </div>
            {ctx.showPackageButtons && ctx.packSize != null && (
                <div className="flex items-stretch gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 justify-center text-12-medium"
                        onClick={ctx.handleRemovePackage}
                        disabled={ctx.currentPackageCount <= 0 || ctx.isPending}
                        aria-label="Убрать упаковку"
                    >
                        <span className="truncate">− 1 упак.</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-0 flex-1 justify-center text-12-medium"
                        onClick={ctx.handleAddPackage}
                        disabled={!ctx.canAddPackage || ctx.isPending}
                    >
                        <span className="truncate">+ 1 упак. ({ctx.packSize} {ctx.shortName})</span>
                    </Button>
                </div>
            )}
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
