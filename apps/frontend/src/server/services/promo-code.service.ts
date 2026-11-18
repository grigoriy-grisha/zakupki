import { computePromoDiscount, NotFoundError, type PromoCodeType, ValidationError } from '@zakupki/types';

import type { PaymentRepository } from '../domain/payment.repository';
import type { PromoCodeRepository } from '../domain/promo-code.repository';

export type ResolvedPromo = { promoCodeId: number; discountAmount: number };

export class PromoCodeService {
    constructor(
        private repo: PromoCodeRepository,
        private paymentRepo: PaymentRepository,
    ) {}

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
        this.assertUsable(promo, purchaseId, orderAmount);

        const discount = computePromoDiscount(promo.type as PromoCodeType, Number(promo.value), orderAmount);
        return {
            id: promo.id,
            code: promo.code,
            label: promo.label,
            type: promo.type,
            value: Number(promo.value),
            minAmount: promo.minAmount != null ? Number(promo.minAmount) : null,
            discount,
            finalAmount: orderAmount - discount,
        };
    }

    /**
     * Промокод, закреплённый за заказом прошлой оплатой. Для фиксированной скидки `value` —
     * остаток скидки (сколько ещё не использовано), чтобы клиент видел ту же сумму, что спишет банк.
     */
    async findPinned(userId: number, purchaseId: number) {
        const promo = await this.paymentRepo.findPinnedPromo(userId, purchaseId);
        if (!promo || promo.type !== 'FIXED') return promo;
        const used = await this.paymentRepo.getPromoDiscountUsed(userId, purchaseId, promo.id);
        const budgetLeft = Math.max(0, Math.round((Number(promo.value) - used) * 100) / 100);
        if (budgetLeft <= 0) return null;
        return { ...promo, value: budgetLeft };
    }

    async resolveForSubmit(params: {
        userId: number;
        purchaseId: number;
        code?: string;
        amount: number;
        due: number;
    }): Promise<ResolvedPromo | null> {
        const pinned = await this.paymentRepo.findPinnedPromo(params.userId, params.purchaseId);
        let promo;
        if (params.code) {
            promo = await this.repo.findByCode(params.code.toUpperCase().trim());
            if (!promo) throw new NotFoundError('Промокод');
        } else {
            promo = pinned;
            if (!promo) return null;
        }

        // Промокод уже закреплён за этим заказом прошлой оплатой — доплаты идут с ним же,
        // даже если код с тех пор выключили, он истёк или закончились активации.
        const alreadyPinned = pinned != null && pinned.id === promo.id;
        try {
            this.assertUsable(promo, params.purchaseId, params.due, { alreadyPinned });
        } catch (err) {
            if (params.code) throw err;
            return null;
        }

        let discount = computePromoDiscount(promo.type as PromoCodeType, Number(promo.value), params.amount);
        if (promo.type === 'FIXED') {
            const used = await this.paymentRepo.getPromoDiscountUsed(params.userId, params.purchaseId, promo.id);
            const budgetLeft = Math.max(0, Number(promo.value) - used);
            discount = Math.min(discount, budgetLeft, Math.round((params.amount - 1) * 100) / 100);
        }
        if (discount <= 0) return null;

        return { promoCodeId: promo.id, discountAmount: discount };
    }

    private assertUsable(
        promo: {
            isActive: boolean;
            expiresAt: Date | null;
            maxUses: number | null;
            usedCount: number;
            purchaseId: number | null;
            minAmount: unknown;
        },
        purchaseId: number,
        orderAmount: number,
        opts: { alreadyPinned?: boolean } = {},
    ) {
        if (!opts.alreadyPinned) {
            if (!promo.isActive) throw new ValidationError('Промокод неактивен');
            if (promo.expiresAt && promo.expiresAt < new Date()) {
                throw new ValidationError('Срок действия промокода истёк');
            }
            if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
                throw new ValidationError('Промокод исчерпан');
            }
        }
        if (promo.purchaseId && promo.purchaseId !== purchaseId)
            throw new ValidationError('Промокод не подходит для этой закупки');
        if (promo.minAmount && orderAmount < Number(promo.minAmount)) {
            throw new ValidationError(`Минимальная сумма заказа: ${Number(promo.minAmount).toLocaleString('ru-RU')} ₽`);
        }
    }
}
