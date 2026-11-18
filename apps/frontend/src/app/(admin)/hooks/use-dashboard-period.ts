'use client';

import { type AnalyticsPeriod, DEFAULT_ANALYTICS_PERIOD, isAnalyticsPeriod } from '@zakupki/types';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/** Параметр адреса: значение по умолчанию из адреса убираем, чтобы ссылки оставались короткими. */
function useSearchParam<T extends string>(name: string, parse: (raw: string | null) => T, fallback: T) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const value = parse(searchParams.get(name));
    const setValue = useCallback(
        (next: T) => {
            const params = new URLSearchParams(searchParams.toString());
            if (next === fallback) params.delete(name);
            else params.set(name, next);
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [fallback, name, pathname, router, searchParams],
    );

    return [value, setValue] as [T, (next: T) => void];
}

const parsePeriod = (raw: string | null): AnalyticsPeriod => (isAnalyticsPeriod(raw) ? raw : DEFAULT_ANALYTICS_PERIOD);

/** Период сводки хранится в адресе (?period=30d), чтобы ссылкой можно было поделиться. */
export function useDashboardPeriod(): [AnalyticsPeriod, (period: AnalyticsPeriod) => void] {
    return useSearchParam('period', parsePeriod, DEFAULT_ANALYTICS_PERIOD);
}

export type DashboardTab = 'summary' | 'stats';

const parseTab = (raw: string | null): DashboardTab => (raw === 'stats' ? 'stats' : 'summary');

/** Вкладка сводки тоже в адресе (?tab=stats). */
export function useDashboardTab(): [DashboardTab, (tab: DashboardTab) => void] {
    return useSearchParam('tab', parseTab, 'summary');
}
