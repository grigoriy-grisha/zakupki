export type PriceTier = {
    amount: number;
    unit?: string;
    price: number;
};

function isPositive(n: number): boolean {
    return Number.isFinite(n) && n > 0;
}

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

/**
 * Сумма заказа по количеству и ценовым ступеням.
 * Ступени — фасовки: 10 гр → 340 ₽. Сначала крупные фасовки, остаток — по цене мелкой.
 */
export function calculateOrderAmount(
    quantity: number,
    options: {
        priceTiers?: unknown;
        pricePerUnit: number;
        priceOverride?: number | null;
    },
): number {
    if (!isPositive(quantity)) return 0;

    if (options.priceOverride != null && isPositive(Number(options.priceOverride))) {
        return roundMoney(quantity * Number(options.priceOverride));
    }

    const tiers = parsePriceTiers(options.priceTiers).sort((a, b) => b.amount - a.amount);

    if (tiers.length === 0) {
        return roundMoney(quantity * options.pricePerUnit);
    }

    const exact = tiers.find((tier) => Math.abs(tier.amount - quantity) < 1e-6);
    if (exact) return roundMoney(exact.price);

    let remaining = quantity;
    let total = 0;

    for (const tier of tiers) {
        const packages = Math.floor((remaining + 1e-9) / tier.amount);
        if (packages <= 0) continue;
        total += packages * tier.price;
        remaining -= packages * tier.amount;
    }

    if (remaining > 1e-6) {
        const smallest = tiers[tiers.length - 1]!;
        total += remaining * (smallest.price / smallest.amount);
    }

    return roundMoney(total);
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}
