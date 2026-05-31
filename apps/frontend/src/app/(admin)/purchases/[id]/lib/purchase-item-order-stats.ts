export type PurchaseItemOrderStatsSource = {
    orderLines: { quantity: unknown }[];
    availableQty?: unknown;
    product: {
        supplierPackageAmount?: unknown;
        supplierPackageUnit?: string | null;
        availableAmount?: unknown;
        availableUnit?: string | null;
    };
};

export function gramsInPack(product: {
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
}): number | null {
    if (product.supplierPackageAmount == null) return null;
    if (product.supplierPackageUnit !== 'гр') return null;
    const grams = Number(product.supplierPackageAmount);
    return Number.isFinite(grams) && grams > 0 ? grams : null;
}

export function getPurchaseItemOrderStats(item: PurchaseItemOrderStatsSource) {
    const totalGrams = item.orderLines.reduce((sum, line) => {
        const qty = Number(line.quantity);
        return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    const packGrams = gramsInPack(item.product);
    const packsToOrder =
        packGrams != null && totalGrams > 0 ? Math.ceil(totalGrams / packGrams) : packGrams != null ? 0 : null;
    const orderedPacks =
        packGrams != null && totalGrams > 0
            ? Math.round((totalGrams / packGrams) * 1000) / 1000
            : packGrams != null
              ? 0
              : null;

    let freeRemainder: number | null = null;
    if (item.availableQty != null && item.availableQty !== undefined) {
        freeRemainder = Number(item.availableQty);
    } else if (item.product.availableAmount != null && item.product.availableUnit === 'гр') {
        freeRemainder = Number(item.product.availableAmount);
    }

    return {
        totalGrams,
        packGrams,
        packsToOrder,
        orderedPacks,
        freeRemainder,
    };
}

export function formatOrderStatValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    return value % 1 === 0 ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}
