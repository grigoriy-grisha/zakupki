'use client';

import { trpc } from '@/lib/client/trpc';

/**
 * Единый клиентский хук для настроек ценообразования.
 *
 * Заменяет паттерн:
 *   const { data } = trpc.settings.getPricing.useQuery();
 *   const percent = data?.beadPackPriceDiscountPercent ?? 3;
 *
 * Возвращает два значения:
 * - `serverValue` — сырое серверное (undefined пока грузится, есть только когда БД отдала значение).
 *   Использовать в `useEffect` для инициализации форм, чтобы не перетирать ввод пользователя.
 * - `beadPackPriceDiscountPercent` (и другие поля) — стабильное значение с дефолтом.
 *   Использовать в расчётах/UI. Не мерцает до загрузки.
 */
export function usePricingSettings() {
    const { data, isLoading } = trpc.settings.getPricing.useQuery(undefined, {
        staleTime: 60_000,
    });

    return {
        isLoading,
        serverValue: data,
        beadPackPriceDiscountPercent: data?.beadPackPriceDiscountPercent ?? 3,
    };
}
