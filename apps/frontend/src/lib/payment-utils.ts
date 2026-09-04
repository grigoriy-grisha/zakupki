export const PAYMENT_DETAILS = {
    method: 'СБП (Система быстрых платежей)',
    phone: '+79836236373',
    recipient: 'Щеглова Ксения Вячеславовна',
    banks: 'СБЕР, Т-банк',
} as const;

export function paymentTotal(p: { amount: unknown; children?: { amount: unknown }[] }): number {
    const children = p.children ?? [];
    const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
    return Number(p.amount) + childAmount;
}
