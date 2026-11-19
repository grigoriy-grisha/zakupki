/**
 * Рубли: целые — без копеек («283 ₽»), дробные — всегда с двумя знаками («24,60 ₽», а не «24,6 ₽»).
 * Сумму сначала округляем до копеек, чтобы хвосты сложения float («1 020,1499…») не попадали на экран.
 */
export function formatRub(v: number): string {
    const rounded = Math.round((Number(v) || 0) * 100) / 100;
    const fractional = Math.abs(rounded % 1) > 0.0001;
    return `${rounded.toLocaleString('ru-RU', {
        minimumFractionDigits: fractional ? 2 : 0,
        maximumFractionDigits: 2,
    })} ₽`;
}

/** Цена за единицу или часть расшифровки — тот же формат, что и у сумм. */
export function formatPriceRub(v: number): string {
    return formatRub(v);
}

export function formatPaidPercent(paid: number, total: number): string | undefined {
    if (total <= 0) return undefined;
    const percent = (paid / total) * 100;
    if (percent > 0 && percent < 1) return '<1%';
    return `${Math.round(percent)}%`;
}
