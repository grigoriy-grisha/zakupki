/**
 * Парсит пользовательский ввод суммы в рублях.
 *
 * Поддерживает:
 *  - `"1500"` → 1500
 *  - `"1 500"` (с пробелами) → 1500
 *  - `"1500.50"` → 1500.5
 *  - `"1500,50"` (запятая) → 1500.5
 *
 * Не поддерживает (по дизайну):
 *  - `"1.500.000"` — даёт NaN
 *  - `"abc"` — даёт NaN
 *
 * Возвращает null если результат не finite или отрицательный.
 */
export function parseCurrencyAmount(text: string): number | null {
    const normalized = text.replace(/\s/g, '').replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
}
