export type PurchaseItemOrderStatsSource = {
    orderLines: { quantity: unknown }[];
    product: {
        supplierPackageAmount?: unknown;
        supplierPackageUnit?: string | null;
    };
};

export type PackOrderUnit = 'гр' | 'шт';

function normalizePackUnit(unit: string | null | undefined): PackOrderUnit | null {
    if (!unit) return null;
    const normalized = unit.trim().toLowerCase().replace(/\./g, '');
    if (normalized === 'гр' || normalized === 'г') return 'гр';
    if (normalized === 'шт') return 'шт';
    return null;
}

export function unitsInPack(product: {
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
}): { size: number; unit: PackOrderUnit } | null {
    if (product.supplierPackageAmount == null) return null;
    const unit = normalizePackUnit(product.supplierPackageUnit);
    if (!unit) return null;
    const size = Number(product.supplierPackageAmount);
    return Number.isFinite(size) && size > 0 ? { size, unit } : null;
}

export function getPurchaseItemOrderStats(item: PurchaseItemOrderStatsSource) {
    const totalQuantity = item.orderLines.reduce((sum, line) => {
        const qty = Number(line.quantity);
        return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    const pack = unitsInPack(item.product);

    let packsToOrder: number | null = null;
    let orderedPacks: number | null = null;
    let orderedQuantity: number | null = null;
    let freeRemainder: number | null = null;

    if (pack != null) {
        packsToOrder = totalQuantity > 0 ? Math.ceil(totalQuantity / pack.size) : 0;
        orderedPacks = packsToOrder;
        orderedQuantity = packsToOrder * pack.size;
        freeRemainder = orderedQuantity - totalQuantity;
    }

    return {
        totalQuantity,
        packSize: pack?.size ?? null,
        packUnit: pack?.unit ?? null,
        packsToOrder,
        orderedPacks,
        orderedQuantity,
        freeRemainder,
    };
}

export function formatOrderStatValue(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    return value % 1 === 0 ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}
