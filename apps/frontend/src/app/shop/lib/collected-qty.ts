type OrderLineLike = {
    quantity?: string | number | null;
    packageCount?: string | number | null;
    status?: string | null;
};

export type CollectedQtyItem = {
    packAmount?: string | number | null;
    orderLines?: OrderLineLike[] | null;
};

export function formatQty(amount: number): string {
    return amount % 1 === 0 ? String(amount) : amount.toFixed(3).replace(/\.?0+$/, '');
}

function toNum(value: string | number | null | undefined): number | null {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function getCollectedQty(item: CollectedQtyItem): number {
    const packSize = toNum(item.packAmount) ?? 0;
    return (item.orderLines ?? [])
        .filter((line) => line.status !== 'CANCELLED')
        .reduce((sum, line) => sum + (toNum(line.quantity) ?? 0) + (toNum(line.packageCount) ?? 0) * packSize, 0);
}

export function getCollectedLabel(item: CollectedQtyItem, unitShort: string): string | null {
    const collected = getCollectedQty(item);
    if (collected <= 0) return null;
    return `Собрано ${formatQty(collected)}${unitShort ? ` ${unitShort}` : ''}`;
}
