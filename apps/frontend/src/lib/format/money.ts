export function formatRub(v: number): string {
    return `${v.toLocaleString('ru-RU')} ₽`;
}

export function formatPriceRub(v: number): string {
    return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}
