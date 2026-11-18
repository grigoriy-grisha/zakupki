export const ANALYTICS_PERIODS = ['7d', '30d', '90d', '365d'] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
    '7d': '7 дней',
    '30d': '30 дней',
    '90d': '90 дней',
    '365d': 'Год',
};

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = '30d';

/** Москва живёт в UTC+3 без перехода на летнее время с 2014 года. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_SHAPE: Record<AnalyticsPeriod, { bucketDays: number; buckets: number }> = {
    '7d': { bucketDays: 1, buckets: 7 },
    '30d': { bucketDays: 1, buckets: 30 },
    '90d': { bucketDays: 7, buckets: 13 },
    '365d': { bucketDays: 7, buckets: 52 },
};

export type ResolvedPeriod = {
    period: AnalyticsPeriod;
    /** Начало периода (включительно) — полночь по Москве. */
    from: Date;
    /** Конец периода (не включительно) — конец сегодняшнего дня по Москве. */
    to: Date;
    /** Предыдущий период такой же длины, для сравнения. */
    prevFrom: Date;
    prevTo: Date;
    bucketMs: number;
    bucketCount: number;
};

export function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
    return typeof value === 'string' && (ANALYTICS_PERIODS as readonly string[]).includes(value);
}

/** Полночь по Москве для дня, в который попадает момент `date`. */
export function startOfMskDay(date: Date): Date {
    const shifted = date.getTime() + MSK_OFFSET_MS;
    return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - MSK_OFFSET_MS);
}

/**
 * Период заканчивается концом сегодняшнего дня (по Москве) и состоит из
 * `bucketCount` равных корзин: дни для 7/30 дней, недели для 90 дней и года.
 */
export function resolvePeriod(period: AnalyticsPeriod, now: Date = new Date()): ResolvedPeriod {
    const { bucketDays, buckets } = PERIOD_SHAPE[period];
    const bucketMs = bucketDays * DAY_MS;
    const to = new Date(startOfMskDay(now).getTime() + DAY_MS);
    const length = bucketMs * buckets;
    const from = new Date(to.getTime() - length);
    return {
        period,
        from,
        to,
        prevFrom: new Date(from.getTime() - length),
        prevTo: from,
        bucketMs,
        bucketCount: buckets,
    };
}

/** Номер корзины для момента внутри периода, иначе -1. */
export function bucketIndex(resolved: Pick<ResolvedPeriod, 'from' | 'bucketMs' | 'bucketCount'>, date: Date): number {
    const offset = date.getTime() - resolved.from.getTime();
    if (offset < 0) return -1;
    const index = Math.floor(offset / resolved.bucketMs);
    return index < resolved.bucketCount ? index : -1;
}

/** Раскладывает значения по корзинам периода: сумма по каждой корзине. */
export function bucketize<T>(
    resolved: Pick<ResolvedPeriod, 'from' | 'bucketMs' | 'bucketCount'>,
    rows: readonly T[],
    getDate: (row: T) => Date,
    getValue: (row: T) => number = () => 1,
): number[] {
    const series = new Array<number>(resolved.bucketCount).fill(0);
    for (const row of rows) {
        const index = bucketIndex(resolved, getDate(row));
        if (index >= 0) series[index] += getValue(row);
    }
    return series.map((value) => Math.round(value * 100) / 100);
}
