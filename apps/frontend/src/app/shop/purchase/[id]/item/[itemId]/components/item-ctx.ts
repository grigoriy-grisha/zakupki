import type { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';

export type ItemOrderControls = ReturnType<typeof useItemOrderControls>;

export function formatQty(amount: number): string {
    return amount % 1 === 0 ? String(amount) : amount.toFixed(3).replace(/\.?0+$/, '');
}
