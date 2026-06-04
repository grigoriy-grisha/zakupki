'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, X, ZoomIn } from 'lucide-react';

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

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, close]);

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

    const lightbox =
        open && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4"
                      role="dialog"
                      aria-modal="true"
                      aria-label={alt}
                      onPointerDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          e.preventDefault();
                          e.stopPropagation();
                          closeAndSwallowClick();
                      }}
                  >
                      <button
                          type="button"
                          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white touch-manipulation"
                          onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              closeAndSwallowClick();
                          }}
                          aria-label="Закрыть"
                      >
                          <X className="h-5 w-5" />
                      </button>
                      <img
                          src={src}
                          alt={alt}
                          className="max-h-[min(85dvh,900px)] max-w-full object-contain"
                          onClick={(e) => e.stopPropagation()}
                      />
                  </div>,
                  document.body,
              )
            : null;

    if (fill) {
        return (
            <>
                <div
                    className={cn(
                        'relative block size-full overflow-hidden bg-muted',
                        thumbClassName,
                    )}
                >
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
                            zoomSize === 'lg'
                                ? 'bottom-4 right-4 h-11 w-11'
                                : 'bottom-2 right-2 h-8 w-8',
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
