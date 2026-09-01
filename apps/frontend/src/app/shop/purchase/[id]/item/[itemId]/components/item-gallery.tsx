'use client';

import { Package } from 'lucide-react';
import { useState } from 'react';

import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

export function ItemGallery({ photoIds, alt }: { photoIds: number[]; alt: string }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activePhotoId = photoIds[activeIndex] ?? null;

    return (
        <div className="min-w-0">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border-low bg-bg-soft">
                {activePhotoId != null ? (
                    <ProductPhotoPreview photoId={activePhotoId} photoIds={photoIds} alt={alt} fill zoomSize="lg" />
                ) : (
                    <div className="flex size-full items-center justify-center">
                        <Package className="size-12 text-fg-disabled" />
                    </div>
                )}
            </div>
            {photoIds.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {photoIds.map((photoId, index) => (
                        <button
                            key={photoId}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            className={cn(
                                'size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:size-20',
                                index === activeIndex
                                    ? 'border-secondary opacity-100'
                                    : 'border-transparent opacity-60 hover:opacity-100',
                            )}
                            aria-label={`Фото ${index + 1}`}
                            aria-current={index === activeIndex}
                        >
                            <img
                                src={absoluteProductPhotoUrl(photoId)}
                                alt=""
                                loading="lazy"
                                draggable={false}
                                className="size-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
