'use client';

import { Package } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { cn } from '@/lib/utils';

export function ProductCardMedia({
    productName,
    photoId,
    photoIds,
    goToDetail,
    isSoldOutNoOrder,
}: {
    productName: string;
    photoId?: number;
    photoIds?: number[];
    goToDetail: () => void;
    isSoldOutNoOrder: boolean;
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
            className={cn('relative block w-full shrink-0 text-left', 'max-sm:w-[45%]', 'max-sm:self-stretch')}
        >
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#d9d9d9] sm:aspect-[6/5] max-sm:absolute max-sm:inset-0 max-sm:aspect-auto max-sm:h-full">
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

                {isSoldOutNoOrder && (
                    <>
                        <div
                            className={cn(
                                'pointer-events-none absolute inset-0',
                                'bg-gradient-to-t from-black/55 via-black/15 to-transparent',
                            )}
                        />
                        <div className="absolute right-2 bottom-2 left-2 z-[1]">
                            <div
                                className={cn(
                                    'flex items-center justify-center gap-1.5 rounded-full bg-bg-card/95 px-2.5',
                                    'py-1.5 shadow-sm backdrop-blur',
                                )}
                            >
                                <Package className="size-3 shrink-0 text-warning" />
                                <span className="text-12-semibold text-fg-primary">Разобрано</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export type StopHandler = (e: React.MouseEvent) => void;
