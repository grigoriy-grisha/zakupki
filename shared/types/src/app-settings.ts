export const APP_SETTING_KEYS = {
    BEAD_PACK_PRICE_DISCOUNT_PERCENT: 'bead_pack_price_discount_percent',
} as const;

export const DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT = 3;

export function computeDiscountedPackPrice(packPrice: number, discountPercent: number): number {
    const discounted = packPrice * (1 - discountPercent / 100);
    return Math.round(discounted * 100) / 100;
}
