/**
 * Сумма платежа: amount + сумма всех дочерних платежей (например, промокод).
 * Единая реализация для админки и магазина — раньше было две копий
 * (admin purchases/lib/utils.ts и shop payment-proof.ts), расходившихся в том,
 * суммировать всех children или только children[0]. Семантически верно — сумма всех.
 */
export function paymentTotal(p: { amount: unknown; children?: { amount: unknown }[] }): number {
    const children = p.children ?? [];
    const childAmount = children.reduce((s: number, c: { amount: unknown }) => s + Number(c.amount), 0);
    return Number(p.amount) + childAmount;
}
