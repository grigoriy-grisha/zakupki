import { normalizeNovelHtml } from '@/lib/product-description';

import { GRAM_UNIT } from './sections/pack-pricing-section';

export function toNum(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function roundCurrency4(value: number): number {
    return Math.round(value * 10000) / 10000;
}

export function gramsOrDefault(
    saved: string | number | null | undefined,
    unit: string | null | undefined,
    gramDefault: number,
): number | null {
    const num = toNum(saved);
    if (num != null) return num;
    return unit === GRAM_UNIT ? gramDefault : null;
}

export function mergeTemplateIntoDescription(current: string, prevAuto: string | null, nextAuto: string): string {
    if (!prevAuto) return nextAuto;
    const normCurrent = normalizeNovelHtml(current);
    const normPrev = normalizeNovelHtml(prevAuto);
    const normNext = normalizeNovelHtml(nextAuto);
    if (normCurrent === normPrev) return nextAuto;
    if (normCurrent.startsWith(normPrev)) {
        return nextAuto + current.slice(prevAuto.length);
    }
    if (normCurrent !== normNext) {
        return current;
    }
    return nextAuto;
}
