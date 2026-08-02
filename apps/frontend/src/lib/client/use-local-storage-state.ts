'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseLocalStorageStateOptions<T> {
    /** Парсер сырой строки. Должен вернуть null, если строка невалидна (тогда используется initialValue). */
    parse?: (raw: string) => T | null;
    /** Сериализатор значения. Дефолт — JSON.stringify. */
    serialize?: (value: T) => string;
}

const defaultParse = <T,>(raw: string): T | null => {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

/**
 * Generic SSR-safe хук для состояния, персистентного в `localStorage`.
 * До монтирования компонента возвращается `initialValue` (без обращения к `window`).
 * Любые ошибки (приватный режим, квота, невалидный JSON) — silent fallback на initialValue.
 *
 * @example
 *   const [progress, setProgress, reset] = useLocalStorageState<Record<string, number>>(
 *     `zakupki:packing:${purchaseId}:${itemId}`,
 *     {},
 *   );
 */
export function useLocalStorageState<T>(
    key: string,
    initialValue: T,
    options: UseLocalStorageStateOptions<T> = {},
): readonly [T, (next: T | ((prev: T) => T)) => void, () => void] {
    const parse = options.parse ?? defaultParse<T>;
    const serialize = options.serialize ?? JSON.stringify;

    const [value, setValueState] = useState<T>(initialValue);
    const [mounted, setMounted] = useState(false);
    // Чтобы setValue, вызванный до монтирования, не затирал реальное значение
    // из localStorage при первом effect-чтении.
    const hasHydrated = useRef(false);

    // Hydrate from localStorage on mount.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(key);
            if (raw != null) {
                const parsed = parse(raw);
                if (parsed != null) setValueState(parsed);
            }
        } catch {
            /* ignore */
        }
        hasHydrated.current = true;
        setMounted(true);
    }, [key, parse]);

    const setValue = useCallback(
        (next: T | ((prev: T) => T)) => {
            setValueState((prev) => {
                const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
                if (hasHydrated.current && typeof window !== 'undefined') {
                    try {
                        window.localStorage.setItem(key, serialize(resolved));
                    } catch {
                        /* ignore quota / private mode */
                    }
                }
                return resolved;
            });
        },
        [key, serialize],
    );

    const reset = useCallback(() => {
        setValueState(initialValue);
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem(key);
            } catch {
                /* ignore */
            }
        }
    }, [key, initialValue]);

    // До монтирования возвращаем initialValue — иначе SSR/CSR-расхождение.
    return [mounted ? value : initialValue, setValue, reset] as const;
}
