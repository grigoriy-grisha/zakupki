'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { productPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

interface ProductPhotoPreviewProps {
    photoId: number | null | undefined;
    alt?: string;
    thumbClassName?: string;
}

export function ProductPhotoPreview({ photoId, alt = 'Фото товара', thumbClassName }: ProductPhotoPreviewProps) {
    const [open, setOpen] = useState(false);

    if (photoId == null) {
        return (
            <div
                className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted',
                    thumbClassName,
                )}
                aria-hidden
            >
                <Package className="h-4 w-4 text-muted-foreground/40" />
            </div>
        );
    }

    const src = productPhotoUrl(photoId);

    return (
        <>
            <button
                type="button"
                className={cn(
                    'h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    thumbClassName,
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setOpen(true);
                }}
                aria-label="Открыть фото товара"
            >
                <img src={src} alt={alt} className="h-full w-full object-cover" />
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[min(calc(100vw-2rem),28rem)] gap-0 border-0 bg-transparent p-0 shadow-none sm:max-w-lg">
                    <DialogTitle className="sr-only">{alt}</DialogTitle>
                    <div className="overflow-hidden rounded-lg border bg-background shadow-lg">
                        <img src={src} alt={alt} className="max-h-[min(80vh,640px)] w-full object-contain" />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
