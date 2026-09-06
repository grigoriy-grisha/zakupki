/** Максимальный размер пачки для весовых товаров (граммы), если фасовка не задана. */
const WEIGHT_PACK_MAX = 50;

export function resolveWeightCutStep(packSize: number | null | undefined): number {
    return packSize != null && Number.isFinite(packSize) && packSize > 0 ? packSize : WEIGHT_PACK_MAX;
}

export interface PackRow {
    /** Размер пачки в единицах товара (г или шт). */
    size: number;
    /** Сколько таких пачек нужно собрать (агрегировано по всем участникам). */
    needed: number;
}

export interface ComputePacksArgs {
    /** true — режем по фасовке поставщика; false — одна пачка = весь заказ пользователя. */
    isWeight: boolean;
    /** Фасовка поставщика (packAmount); null — режем по 50. */
    packSize?: number | null;
    /** Строки заказа по этому purchaseItem. quantity > 0, иначе игнорируем. */
    orders: ReadonlyArray<{ userId: number; quantity: number }>;
}

/**
 * Раскладывает заказы по пачкам.
 * - WEIGHT (gram): жадно по фасовке поставщика, остаток — отдельная пачка
 *   (100, 100, 40, 10). Дробные граммы не округляются.
 * - PIECE (штука/туба): одна пачка = весь заказ пользователя, без дробления.
 * Возвращает агрегированный список с сортировкой size desc, needed desc.
 */
export function computePacks(args: ComputePacksArgs): PackRow[] {
    const { isWeight, orders } = args;
    const step = resolveWeightCutStep(args.packSize);
    const sizes: number[] = [];

    for (const o of orders) {
        const raw = Number(o.quantity);
        if (!Number.isFinite(raw)) continue;
        const q = Math.max(0, raw);
        if (q <= 0) continue;

        if (isWeight) {
            let rest = q;
            while (rest > step + 1e-9) {
                sizes.push(step);
                rest = Math.round((rest - step) * 1000) / 1000;
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
