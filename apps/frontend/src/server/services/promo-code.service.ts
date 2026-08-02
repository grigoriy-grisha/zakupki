import { NotFoundError, ValidationError } from '@zakupki/types';

import { PromoCodeRepository } from '../domain/promo-code.repository';

export class PromoCodeService {
    constructor(private repo: PromoCodeRepository) {}

    async create(data: {
        code: string;
        label?: string;
        type: 'PERCENT' | 'FIXED';
        value: number;
        purchaseId?: number;
        maxUses?: number;
        minAmount?: number;
        expiresAt?: Date;
    }) {
        return this.repo.create(data);
    }

    async update(id: number, data: { isActive?: boolean; maxUses?: number; expiresAt?: Date; label?: string }) {
        return this.repo.update(id, data);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }

    async list() {
        return this.repo.list();
    }

    async validate(code: string, purchaseId: number, orderAmount: number) {
        const promo = await this.repo.findByCode(code);
        if (!promo) throw new NotFoundError('Промокод');
        if (!promo.isActive) throw new ValidationError('Промокод неактивен');
        if (promo.expiresAt && promo.expiresAt < new Date()) throw new ValidationError('Срок действия промокода истёк');
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) throw new ValidationError('Промокод исчерпан');
        if (promo.purchaseId && promo.purchaseId !== purchaseId)
            throw new ValidationError('Промокод не подходит для этой закупки');
        if (promo.minAmount && orderAmount < Number(promo.minAmount)) {
            throw new ValidationError(`Минимальная сумма заказа: ${Number(promo.minAmount).toLocaleString('ru-RU')} ₽`);
        }

        const discount = this.calculateDiscount(Number(promo.value), promo.type, orderAmount);
        return {
            id: promo.id,
            code: promo.code,
            label: promo.label,
            type: promo.type,
            value: Number(promo.value),
            discount,
            finalAmount: orderAmount - discount,
        };
    }

    calculateDiscount(value: number, type: string, amount: number): number {
        let discount: number;
        if (type === 'PERCENT') {
            discount = Math.round(((amount * value) / 100) * 100) / 100;
        } else {
            discount = value;
        }
        // Leave at least 1 ruble
        return Math.min(discount, amount - 1);
    }
}
