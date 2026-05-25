import type { PromoStatus, PromoWithDates } from '../../../lib/types';

export function getPromoStatus(promo: PromoWithDates): PromoStatus {
    const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
    const isExhausted = promo.maxUses !== null && promo.usedCount >= promo.maxUses;

    if (!promo.isActive) return { label: 'Неактивен', className: 'bg-error-50 text-error' };
    if (isExpired) return { label: 'Истёк', className: 'bg-error-50 text-error' };
    if (isExhausted) return { label: 'Исчерпан', className: 'bg-warning-50 text-warning' };
    return { label: 'Активен', className: 'bg-success-50 text-success' };
}
