/** Максимальный размер пачки для весовых товаров (граммы). */
const WEIGHT_PACK_MAX = 50;

export interface PackRow {
    /** Размер пачки в единицах товара (г или шт). */
    size: number;
    /** Сколько таких пачек нужно собрать (агрегировано по всем участникам). */
    needed: number;
}

export interface ComputePacksArgs {
    /** true — режем по 50 г (жадно); false — одна пачка = весь заказ пользователя. */
    isWeight: boolean;
    /** Строки заказа по этому purchaseItem. quantity > 0, иначе игнорируем. */
    orders: ReadonlyArray<{ userId: number; quantity: number }>;
}

/**
 * Раскладывает заказы по пачкам.
 * - WEIGHT (gram): жадно по 50 г, остаток — отдельная пачка (50, 50, 40, 10).
 * - PIECE (штука/туба): одна пачка = весь заказ пользователя, без дробления.
 * Возвращает агрегированный список с сортировкой size desc, needed desc.
 */
export function computePacks(args: ComputePacksArgs): PackRow[] {
    const { isWeight, orders } = args;
    const sizes: number[] = [];

    for (const o of orders) {
        const raw = Number(o.quantity);
        if (!Number.isFinite(raw)) continue;
        const q = Math.max(0, Math.round(raw));
        if (q <= 0) continue;

        if (isWeight) {
            let rest = q;
            while (rest > WEIGHT_PACK_MAX) {
                sizes.push(WEIGHT_PACK_MAX);
                rest -= WEIGHT_PACK_MAX;
            }
            sizes.push(rest);
        } else {
            sizes.push(q);
        }
    }

    const counter = new Map<number, number>();
    for (const s of sizes) {
        counter.set(s, (counter.get(s) ?? 0) + 1);
    }

    return Array.from(counter.entries())
        .sort((a, b) => b[0] - a[0] || b[1] - a[1])
        .map(([size, needed]) => ({ size, needed }));
}
