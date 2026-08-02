import type { PriceTier } from './types';
import { isPositive } from '../utils';

/**
 * Парсит ценовые ступени из сырых данных
 */
export function parsePriceTiers(raw: unknown): PriceTier[] {
    if (!Array.isArray(raw)) return [];

    const tiers: PriceTier[] = [];
    for (const tier of raw) {
        if (tier == null || typeof tier !== 'object') continue;
        const record = tier as Record<string, unknown>;
        const amount = Number(record.amount);
        const price = Number(record.price);
        if (!isPositive(amount) || !isPositive(price)) continue;
        tiers.push({
            amount,
            price,
            unit: typeof record.unit === 'string' ? record.unit : undefined,
        });
    }
    return tiers;
}
