/**
 * Дефолт единицы для поля формы позиции закупки.
 *
 * Логика: из сохранённого значения, иначе из единицы учёта товара
 * (product.unitCode → shortName: «гр»/«шт»/«туба»), иначе null.
 *
 * Раньше тот же fallback дублировался 6 раз в purchase-product-edit-form.tsx
 * (3 useState + 3 reset-effect) — вынесен сюда как единая точка.
 */
export function defaultUnitField(
    saved: string | null | undefined,
    productUnitShortName: string | null | undefined,
): string | null {
    return saved ?? productUnitShortName ?? null;
}
