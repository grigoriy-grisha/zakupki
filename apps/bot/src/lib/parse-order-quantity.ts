export type ParsedOrderQuantity = { kind: 'add'; amount: number } | { kind: 'subtract'; amount: number };

/**
 * Parses quantity from a reply: "10", "+10", "10 гр" — добавить к заказу;
 * "-15", "-15 гр" — убрать из текущего заказа.
 */
export function parseOrderQuantity(text: string): ParsedOrderQuantity | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^([+-]?\d+(?:[.,]\d+)?)/);
    if (!match) return null;

    const raw = Number.parseFloat(match[1]!.replace(',', '.'));
    if (!Number.isFinite(raw) || raw === 0) return null;

    if (raw < 0) {
        return { kind: 'subtract', amount: Math.abs(raw) };
    }

    return { kind: 'add', amount: raw };
}
