'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, X, ZoomIn } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLightboxGallery } from '@/lib/hooks/use-lightbox-gallery';
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
    /** Primary / cover photo id (also the thumbnail in compact mode). */
    photoId: number | null | undefined;
    /** All photo ids of the product. When provided the lightbox becomes a navigable gallery. */
    photoIds?: number[];
    alt?: string;
    thumbClassName?: string;
    /** Фото на всю область карточки; лупа отдельно, клик по фото не открывает лайтбокс. */
    fill?: boolean;
    /** Размер кнопки лупы в режиме fill. */
    zoomSize?: 'sm' | 'lg';
}

export function ProductPhotoPreview({
    photoId,
    photoIds,
    alt = 'Фото товара',
    thumbClassName,
    fill = false,
    zoomSize = 'sm',
}: ProductPhotoPreviewProps) {
    const [open, setOpen] = useState(false);

    // Gallery list: use photoIds if provided, otherwise fall back to a single photo.
    const gallery = photoIds && photoIds.length > 0 ? photoIds : photoId != null ? [photoId] : [];
    const hasGallery = gallery.length > 1;

    const { index, direction, goTo, next, prev, reset, onTouchStart, onTouchEnd } = useLightboxGallery(
        gallery.length,
        open && hasGallery,
    );

    const thumbSrc = photoId != null ? absoluteProductPhotoUrl(photoId) : null;

    const close = useCallback(() => setOpen(false), []);

    const closeAndSwallowClick = useCallback(() => {
        blockClickThroughAfterClose();
        close();
    }, [close]);

    const onOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (nextOpen) {
                reset();
                setOpen(true);
            } else {
                closeAndSwallowClick();
            }
        },
        [closeAndSwallowClick, reset],
    );

    // Escape closes the lightbox.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeAndSwallowClick();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, closeAndSwallowClick]);

    if (!thumbSrc) {
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

    const currentSrc = gallery[index] != null ? absoluteProductPhotoUrl(gallery[index]) : thumbSrc;

    // Лайтбокс — намеренно тёмный «darkroom»: чёрный оверлей, белый текст кнопок.
    // Это сознательное отступление от дизайн-токенов ради UX.
    const lightbox = (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                aria-label={alt}
                className="flex max-h-[100dvh] max-w-[100vw] items-center justify-center border-none bg-transparent p-0 shadow-none data-[state=open]:zoom-in-100"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <DialogTitle className="sr-only">{alt}</DialogTitle>

                {/* Photo — re-mounted on index change so the enter animation runs each time. */}
                <img
                    key={index}
                    src={currentSrc}
                    alt={alt}
                    className={cn(
                        'max-h-[min(85dvh,900px)] max-w-full object-contain',
                        direction === 'right' && 'animate-[lightbox-slide-right_0.25s_ease-out]',
                        direction === 'left' && 'animate-[lightbox-slide-left_0.25s_ease-out]',
                    )}
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                />

                {/* Close (top-right) */}
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

                {/* Counter (top-left) */}
                {hasGallery && (
                    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-10 rounded-full bg-black/50 px-3 py-1 text-14-medium text-white tabular-nums">
                        {index + 1} / {gallery.length}
                    </div>
                )}

                {/* Prev / Next arrows (only in gallery mode) */}
                {hasGallery && (
                    <>
                        <button
                            type="button"
                            className="fixed top-1/2 left-[max(0.5rem,env(safe-area-inset-left))] z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors touch-manipulation hover:bg-black/65"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                prev();
                            }}
                            aria-label="Предыдущее фото"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                            type="button"
                            className="fixed top-1/2 right-[max(0.5rem,env(safe-area-inset-right))] z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors touch-manipulation hover:bg-black/65"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                next();
                            }}
                            aria-label="Следующее фото"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    </>
                )}

                {/* Thumbnail strip (bottom) */}
                {hasGallery && (
                    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex max-w-[90vw] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-xl bg-black/40 p-1.5">
                        {gallery.map((pid, i) => (
                            <button
                                key={pid}
                                type="button"
                                className={cn(
                                    'size-12 shrink-0 overflow-hidden rounded-md border-2 transition-all',
                                    i === index
                                        ? 'border-white opacity-100'
                                        : 'border-transparent opacity-60 hover:opacity-90',
                                )}
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goTo(i);
                                }}
                                aria-label={`Фото ${i + 1}`}
                                aria-current={i === index}
                            >
                                <img
                                    src={absoluteProductPhotoUrl(pid)}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    draggable={false}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );

    if (fill) {
        return (
            <>
                <div className={cn('relative block size-full overflow-hidden bg-muted', thumbClassName)}>
                    <img
                        src={thumbSrc}
                        alt={alt}
                        className="pointer-events-none absolute inset-0 size-full object-cover"
                        loading="lazy"
                    />
                    {/* Multi-photo indicator badge (top-right) */}
                    {hasGallery && (
                        <div className="pointer-events-none absolute top-1.5 left-1.5 z-[1] flex items-center gap-1 rounded-full border border-white/30 bg-black/50 px-2 py-0.5 text-12-medium text-white shadow-sm backdrop-blur-md">
                            {gallery.length}
                        </div>
                    )}
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
                    'relative h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation',
                    thumbClassName,
                )}
                onClick={openPhoto}
                aria-label="Открыть фото товара"
            >
                <img src={thumbSrc} alt={alt} className="h-full w-full object-cover" loading="lazy" />
                {hasGallery && (
                    <span className="pointer-events-none absolute right-0 top-0 rounded-bl-md bg-black/55 px-1.5 py-0.5 text-10-medium text-white tabular-nums">
                        {gallery.length}
                    </span>
                )}
            </button>

            {lightbox}
        </>
    );
}
