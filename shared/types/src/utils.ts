/** Returns the number if finite and positive, otherwise null. */
export function positiveOrNull(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Checks if a number is finite and positive. */
export function isPositive(n: number): boolean {
    return Number.isFinite(n) && n > 0;
}

/**
 * Formats a quantity: integers without decimals, fractions with up to 3 decimal
 * places. Falls back to '—' for non-finite values (null/undefined/NaN) so the
 * UI never crashes when rendering a legacy payload with a missing field.
 */
export function formatQtyLabel(quantity: number | null | undefined): string {
    if (quantity == null || !Number.isFinite(quantity)) return '—';
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
}
