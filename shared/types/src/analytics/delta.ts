export type MetricDelta =
    /** В обоих периодах ноль — сравнивать нечего. */
    | { kind: 'none' }
    /** В прошлом периоде был ноль, сейчас есть — процент не имеет смысла. */
    | { kind: 'new' }
    | { kind: 'change'; percent: number };

/** Изменение к прошлому периоду в процентах, округлённое до десятых. */
export function computeDelta(current: number, previous: number): MetricDelta {
    if (previous === 0) return current === 0 ? { kind: 'none' } : { kind: 'new' };
    const percent = ((current - previous) / Math.abs(previous)) * 100;
    return { kind: 'change', percent: Math.round(percent * 10) / 10 };
}
