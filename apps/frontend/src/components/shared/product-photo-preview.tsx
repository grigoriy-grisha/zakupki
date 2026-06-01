'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, X } from 'lucide-react';

import { absoluteProductPhotoUrl } from '@/lib/product-photo-url';
import { cn } from '@/lib/utils';

interface ProductPhotoPreviewProps {
    photoId: number | null | undefined;
    alt?: string;
    thumbClassName?: string;
}

export function ProductPhotoPreview({ photoId, alt = 'Фото товара', thumbClassName }: ProductPhotoPreviewProps) {
    const [open, setOpen] = useState(false);
    const src = photoId != null ? absoluteProductPhotoUrl(photoId) : null;

    const close = useCallback(() => setOpen(false), []);

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
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted',
                    thumbClassName,
                )}
                aria-hidden
            >
                <Package className="h-4 w-4 text-muted-foreground/40" />
            </div>
        );
    }

    const openPhoto = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const tg = window.Telegram?.WebApp;
        if (tg?.openLink) {
            tg.openLink(src);
            return;
        }
        setOpen(true);
    };

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

            {open && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={alt}
                    onClick={close}
                >
                    <button
                        type="button"
                        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white touch-manipulation"
                        onClick={(e) => {
                            e.stopPropagation();
                            close();
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
                </div>
            )}
        </>
    );
}
