import type { PriceTier } from '@zakupki/types';

/**
 * Цена из тиры по количеству (с допуском для float-сравнений).
 * Возвращает null, если тир с таким amount не найден.
 */
export function tierPrice(tiers: PriceTier[], amount: number): number | null {
    const tier = tiers.find((entry) => Math.abs(entry.amount - amount) < 1e-6);
    return tier ? tier.price : null;
}

/**
 * Форматирует число как рубли: `1 234,56 ₽`. Пусто/NaN → `—`.
 */
export function formatRubPrice(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${value.toLocaleString('ru-RU')} ₽`;
}
