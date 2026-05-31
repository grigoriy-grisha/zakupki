export function isPositive(v: number | null | undefined): v is number {
    return typeof v === 'number' && isFinite(v) && v > 0;
}

export function formatNumber(v: number | null | undefined): string {
    if (v == null || !isFinite(Number(v))) return '';
    const n = Number(v);
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(2).replace(/\.?0+$/, '');
}
