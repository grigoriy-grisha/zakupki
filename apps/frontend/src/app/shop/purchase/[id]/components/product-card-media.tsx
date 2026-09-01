'use client';

import { Package, Percent, ShoppingCart } from 'lucide-react';
import type { KeyboardEvent,MouseEvent } from 'react';

import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ProductCardMedia({
    productName,
    photoId,
    photoIds,
    goToDetail,
    showPackHint,
    discountPercent,
    hasOrder,
    isSoldOut,
    isSoldOutNoOrder,
    currentQuantity,
    currentPackageCount,
}: {
    productName: string;
    photoId?: number;
    photoIds?: number[];
    goToDetail: () => void;
    showPackHint: boolean;
    discountPercent?: number;
    hasOrder: boolean;
    isSoldOut: boolean;
    isSoldOutNoOrder: boolean;
    currentQuantity: number;
    currentPackageCount: number;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={goToDetail}
            onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToDetail();
                }
            }}
            aria-label={`Открыть карточку товара ${productName}`}
            className="block w-full text-left"
        >
            <div className="relative aspect-square w-full overflow-hidden bg-bg-soft">
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className={cn(
                            'h-full w-full transition-transform duration-500 ease-out',
                            'group-hover:scale-105',
                        )}
                    >
                        <ProductPhotoPreview photoId={photoId} photoIds={photoIds} alt={productName} fill />
                    </div>
                </div>

                {showPackHint && (
                    <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1]">
                        <Badge type="glass" variant="success" size="sm">
                            <Percent className="mr-0.5 size-3" />−{discountPercent}% за пачку
                        </Badge>
                    </div>
                )}

                {hasOrder && !isSoldOut && (
                    <div
                        className={cn(
                            'pointer-events-none absolute top-1.5 left-1.5 z-[1] flex items-center gap-1',
                            'rounded-full bg-primary px-2 py-0.5 text-12-semibold leading-none',
                            'text-white shadow-sm',
                        )}
                    >
                        <ShoppingCart className="size-2.5" />В корзине
                    </div>
                )}

                {hasOrder && !isSoldOut && (
                    <div
                        className={cn(
                            'pointer-events-none absolute top-1.5 right-1.5 z-[1] flex h-6 min-w-6',
                            'items-center justify-center rounded-full border border-white/40',
                            'bg-bg-card/80 px-2 text-12-semibold text-fg-primary shadow-sm',
                            'backdrop-blur-md tabular-nums',
                        )}
                    >
                        {currentQuantity}
                        {currentPackageCount > 0 && (
                            <span className="ml-0.5 text-12-regular text-fg-tertiary">+{currentPackageCount}</span>
                        )}
                    </div>
                )}

                {isSoldOutNoOrder && (
                    <>
                        <div
                            className={cn(
                                'pointer-events-none absolute inset-0',
                                'bg-gradient-to-t from-black/55 via-black/15 to-transparent',
                            )}
                        />
                        <div className="absolute right-1.5 bottom-1.5 left-1.5 z-[1]">
                            <div
                                className={cn(
                                    'flex items-center gap-1.5 rounded-lg bg-bg-card/95 px-2.5',
                                    'py-1.5 shadow-sm backdrop-blur',
                                )}
                            >
                                <div
                                    className={cn(
                                        'flex h-5 w-5 shrink-0 items-center justify-center',
                                        'rounded-md bg-warning/15',
                                    )}
                                >
                                    <Package className="size-3 text-warning" />
                                </div>
                                <span className="text-12-semibold text-fg-primary">Разобрано</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export type StopHandler = (e: MouseEvent) => void;
