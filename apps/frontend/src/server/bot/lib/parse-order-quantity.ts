export type ParsedOrderQuantity =
    | { kind: 'add'; amount: number; unit: 'remainder' }
    | { kind: 'add'; amount: number; unit: 'packs' }
    | { kind: 'subtract'; amount: number; unit: 'remainder' }
    | { kind: 'subtract'; amount: number; unit: 'packs' };

/**
 * Парсит количество из ответа в Telegram.
 *  — «10», «+10», «10 гр» → добавить к remainder (россыпь).
 *  — «+2п», «+2 пачки», «+2п.» → добавить к packs (только на REORDER, не на PAYMENT).
 *  — «-15», «-15 гр» → убрать из remainder.
 *  — «-1п» → убрать одну пачку.
 *
 * Суффикс «п» / «пачки» / «пачку» (с опциональным окончанием) переключает режим packs.
 * По умолчанию — remainder.
 */
export function parseOrderQuantity(text: string): ParsedOrderQuantity | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const packSuffix = /^\s*(\+|-)?\s*(\d+(?:[.,]\d+)?)\s*(?:п|пачк\w*|п\.)\s*$/i;
    const packMatch = trimmed.match(packSuffix);
    if (packMatch) {
        const sign = packMatch[1] ?? '+';
        const raw = Number.parseFloat(packMatch[2]!.replace(',', '.'));
        if (!Number.isFinite(raw) || raw === 0) return null;
        return sign === '-'
            ? { kind: 'subtract', amount: raw, unit: 'packs' }
            : { kind: 'add', amount: raw, unit: 'packs' };
    }

    const match = trimmed.match(/^([+-]?\d+(?:[.,]\d+)?)/);
    if (!match) return null;

    const raw = Number.parseFloat(match[1]!.replace(',', '.'));
    if (!Number.isFinite(raw) || raw === 0) return null;

    if (raw < 0) {
        return { kind: 'subtract', amount: Math.abs(raw), unit: 'remainder' };
    }
    return { kind: 'add', amount: raw, unit: 'remainder' };
}
