export function formatRub(v: number): string {
    return `${v.toLocaleString('ru-RU')} ₽`;
}

export function formatPriceRub(v: number): string {
    return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

export function formatPaidPercent(paid: number, total: number): string | undefined {
    if (total <= 0) return undefined;
    const percent = (paid / total) * 100;
    if (percent > 0 && percent < 1) return '<1%';
    return `${Math.round(percent)}%`;
}
