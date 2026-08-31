'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD_PX = 50;

/**
 * Gallery navigation state for the photo lightbox.
 *
 * Encapsulates index tracking, prev/next/goTo, keyboard arrows and touch swipe
 * handling. The consumer is responsible for rendering — this hook is pure logic.
 *
 * @param count   total number of photos in the gallery
 * @param enabled when `false` all listeners are detached (use for single-photo mode)
 */
export function useLightboxGallery(count: number, enabled: boolean) {
    const [index, setIndex] = useState(0);
    /** Direction of the last transition — drives the slide-in animation class. */
    const [direction, setDirection] = useState<'left' | 'right' | null>(null);
    const touchStartX = useRef<number | null>(null);

    const goTo = useCallback(
        (next: number) => {
            if (count <= 1) return;
            // Clamp + wrap around.
            const wrapped = ((next % count) + count) % count;
            setDirection(next > index || (index === count - 1 && next === 0) ? 'right' : 'left');
            setIndex(wrapped);
        },
        [count, index],
    );

    const next = useCallback(() => goTo(index + 1), [goTo, index]);
    const prev = useCallback(() => goTo(index - 1), [goTo, index]);

    const reset = useCallback(() => {
        setIndex(0);
        setDirection(null);
    }, []);

    // Keyboard: ← → arrows. Escape is handled by the Dialog/consumer.
    useEffect(() => {
        if (!enabled || count <= 1) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prev();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled, count, next, prev]);

    // Touch swipe (mobile / Telegram Mini App).
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
    }, []);

    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (touchStartX.current == null || count <= 1) return;
            const delta = e.changedTouches[0]?.clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
            // Swipe left (drag right→left) → next; swipe right → prev.
            if (delta < 0) next();
            else prev();
        },
        [count, next, prev],
    );

    return { index, direction, goTo, next, prev, reset, onTouchStart, onTouchEnd };
}
