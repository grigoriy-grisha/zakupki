'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, X, ZoomIn } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

/** После закрытия лайтбокса тот же клик не должен попасть в карточку под оверлеем. */
function blockClickThroughAfterClose() {
    const swallow = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };
    document.addEventListener('click', swallow, true);
    document.addEventListener('pointerup', swallow, true);
    window.setTimeout(() => {
        document.removeEventListener('click', swallow, true);
        document.removeEventListener('pointerup', swallow, true);
    }, 400);
}

interface ProductPhotoPreviewProps {
    photoId: number | null | undefined;
    alt?: string;
    thumbClassName?: string;
    /** Фото на всю область карточки; лупа отдельно, клик по фото не открывает лайтбокс. */
    fill?: boolean;
    /** Размер кнопки лупы в режиме fill. */
    zoomSize?: 'sm' | 'lg';
}

export function ProductPhotoPreview({
    photoId,
    alt = 'Фото товара',
    thumbClassName,
    fill = false,
    zoomSize = 'sm',
}: ProductPhotoPreviewProps) {
    const [open, setOpen] = useState(false);
    const src = photoId != null ? absoluteProductPhotoUrl(photoId) : null;

    const close = useCallback(() => setOpen(false), []);

    const closeAndSwallowClick = useCallback(() => {
        blockClickThroughAfterClose();
        close();
    }, [close]);

    const onOpenChange = useCallback(
        (next: boolean) => {
            if (next) {
                setOpen(true);
            } else {
                closeAndSwallowClick();
            }
        },
        [closeAndSwallowClick],
    );

    // Снимаем блокировку body-scroll (Dialog сам это делает) — но Escape и focus нам не нужны отдельно.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeAndSwallowClick();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, closeAndSwallowClick]);

    if (!src) {
        return (
            <div
                className={cn(
                    fill
                        ? 'flex size-full items-center justify-center bg-muted'
                        : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted',
                    thumbClassName,
                )}
                aria-hidden
            >
                <Package className={cn(fill ? 'h-8 w-8' : 'h-4 w-4', 'text-muted-foreground/40')} />
            </div>
        );
    }

    const openPhoto = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setOpen(true);
    };

    // Лайтбокс — намеренно тёмный «darkroom»: чёрный оверлей, белый текст кнопок.
    // Это сознательное отступление от дизайн-токенов ради UX.
    const lightbox = (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                aria-label={alt}
                className="flex max-h-[100dvh] max-w-[100vw] items-center justify-center border-none bg-transparent p-0 shadow-none data-[state=open]:zoom-in-100"
            >
                <DialogTitle className="sr-only">{alt}</DialogTitle>
                <img
                    src={src}
                    alt={alt}
                    className="max-h-[min(85dvh,900px)] max-w-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                />
                <button
                    type="button"
                    className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white touch-manipulation hover:bg-black/65"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onClick={closeAndSwallowClick}
                    aria-label="Закрыть"
                >
                    <X className="h-5 w-5" />
                </button>
            </DialogContent>
        </Dialog>
    );

    if (fill) {
        return (
            <>
                <div className={cn('relative block size-full overflow-hidden bg-muted', thumbClassName)}>
                    <img
                        src={src}
                        alt={alt}
                        className="pointer-events-none absolute inset-0 size-full object-cover"
                        loading="lazy"
                    />
                    <button
                        type="button"
                        className={cn(
                            'absolute z-[2] flex items-center justify-center rounded-full bg-black/50 text-white shadow-sm transition-opacity hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation',
                            zoomSize === 'lg' ? 'bottom-4 right-4 h-11 w-11' : 'bottom-2 right-2 h-8 w-8',
                        )}
                        onClick={openPhoto}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Увеличить фото товара"
                    >
                        <ZoomIn className={cn(zoomSize === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} aria-hidden />
                    </button>
                </div>
                {lightbox}
            </>
        );
    }

    return (
        <>
            <button
                type="button"
                className={cn(
                    'h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation',
                    thumbClassName,
                )}
                onClick={openPhoto}
                aria-label="Открыть фото товара"
            >
                <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
            </button>

            {lightbox}
        </>
    );
}
