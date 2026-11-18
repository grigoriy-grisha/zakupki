import { type AnalyticsPeriod, DAY_MS, startOfMskDay } from '@zakupki/types';

const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });

/** Целые рубли: на сводке копейки только мешают читать. */
export function formatRubShort(value: number): string {
    return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

/** «19 октября – 18 ноября»; `to` — конец периода (не включительно). */
export function formatPeriodRange(from: Date | string, to: Date | string): string {
    const last = new Date(new Date(to).getTime() - 1);
    return `${DATE_FORMAT.format(new Date(from))} – ${DATE_FORMAT.format(last)}`;
}

export function pluralize(count: number, one: string, few: string, many: string): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
}

/** «сегодня», «вчера», «5 дней назад» — по календарным дням Москвы, а не по скользящим суткам. */
export function formatDaysAgo(date: Date | string, now: Date = new Date()): string {
    const days = Math.round((startOfMskDay(now).getTime() - startOfMskDay(new Date(date)).getTime()) / DAY_MS);
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'вчера';
    return `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`;
}

/** Подпись сравнения с прошлым периодом под KPI. */
export const COMPARISON_LABELS: Record<AnalyticsPeriod, string> = {
    '7d': 'к прошлой неделе',
    '30d': 'к прошлым 30 дням',
    '90d': 'к прошлым 90 дням',
    '365d': 'к прошлому году',
};
