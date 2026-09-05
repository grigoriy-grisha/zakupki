import { dbClient } from '@zakupki/database';
import {
    computeOrderLinePriceBreakdown,
    isPurchasePaymentOpen,
    PROOF_MIME_TYPES,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';

import { storage } from '@/lib/server/storage';

import type { PaymentRepository } from '../domain/payment.repository';
import type { OrderService } from './order.service';
import type { PromoCodeService } from './promo-code.service';

export type PurchasePaymentBreakdown = {
    base: number;
    org: number;
    delivery: number;
};

export type PurchasePaymentInfo = {
    due: number;
    paid: number;
    hasPending: boolean;
    remaining: number;
    tag: string;
    breakdown: PurchasePaymentBreakdown | null;
};

export type PayablePurchase = {
    purchaseId: number;
    tag: string;
    remaining: number;
    fulfillmentStatus: PurchaseFulfillmentStatus;
};

const PAYMENT_STATUS: Record<string, { label: string }> = {
    PENDING: { label: 'Ожидает проверки' },
    CONFIRMED: { label: 'Подтверждено' },
    REJECTED: { label: 'Отклонено' },
};

export class BotPaymentService {
    constructor(
        private repo: PaymentRepository,
        private orderService: OrderService,
        private promoCodeService: PromoCodeService,
    ) {}

    async getUserPayments(userId: number) {
        const payments = await this.repo.getByUser(userId);

        const lines = payments.map((p) => {
            const total = Number(p.amount) + this.sumChildAmount(p.children);
            const { label = p.status } = PAYMENT_STATUS[p.status] ?? {};
            return (
                `${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
                `   ${label} · ${new Date(p.submittedAt).toLocaleDateString('ru-RU')}`
            );
        });

        return { payments, lines };
    }

    async getPayablePurchases(userId: number): Promise<PayablePurchase[]> {
        const map = await this.buildPaymentMap(userId);
        const result: PayablePurchase[] = [];

        const purchaseIds = [...map.keys()];
        const purchases =
            purchaseIds.length > 0
                ? await dbClient.purchase.findMany({
                      where: { id: { in: purchaseIds } },
                      select: { id: true, fulfillmentStatus: true },
                  })
                : [];
        const purchaseById = new Map(purchases.map((p) => [p.id, p]));

        map.forEach((info, purchaseId) => {
            const purchase = purchaseById.get(purchaseId);
            if (
                !purchase ||
                info.remaining <= 0 ||
                info.hasPending ||
                !isPurchasePaymentOpen(purchase.fulfillmentStatus)
            ) {
                return;
            }
            result.push({
                purchaseId,
                tag: info.tag,
                remaining: info.remaining,
                fulfillmentStatus: purchase.fulfillmentStatus as PurchaseFulfillmentStatus,
            });
        });

        return result.sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
    }

    async getPurchasePaymentInfo(userId: number, purchaseId: number): Promise<PurchasePaymentInfo | null> {
        const map = await this.buildPaymentMap(userId);
        return map.get(purchaseId) ?? null;
    }

    async submitPaymentWithProof(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofData: Buffer;
        proofMimeType: string;
        promoCodeId?: number;
        discountAmount?: number;
    }) {
        if (!PROOF_MIME_TYPES.has(data.proofMimeType)) {
            throw new Error('Допустимы только изображения и PDF');
        }

        const purchase = await dbClient.purchase.findUnique({
            where: { id: data.purchaseId },
            select: { fulfillmentStatus: true },
        });
        if (!isPurchasePaymentOpen(purchase?.fulfillmentStatus)) {
            throw new Error('Оплата ещё не открыта. Ждём начала оплаты.');
        }

        const info = await this.getPurchasePaymentInfo(data.userId, data.purchaseId);
        if (!info) {
            throw new Error('Закупка не найдена');
        }
        if (info.hasPending) {
            throw new Error('Уже есть оплата на проверке. Дождитесь подтверждения.');
        }
        if (info.remaining <= 0) {
            throw new Error('По этой закупке нечего оплачивать');
        }
        if (data.amount <= 0 || data.amount > info.remaining) {
            throw new Error(`Сумма должна быть от 1 до ${info.remaining.toLocaleString('ru-RU')} ₽`);
        }

        const proofObjectKey = await storage.uploadPaymentProof(
            data.userId,
            data.purchaseId,
            data.proofData,
            data.proofMimeType,
        );

        return this.repo.submitPayment({
            userId: data.userId,
            purchaseId: data.purchaseId,
            amount: data.amount,
            userComment: data.userComment,
            proofObjectKey,
            promoCodeId: data.promoCodeId,
            discountAmount: data.discountAmount,
        });
    }

    async validatePromoCode(
        code: string,
        purchaseId: number,
        orderAmount: number,
    ): Promise<{ id: number; code: string; label: string | null; discount: number; finalAmount: number }> {
        return this.promoCodeService.validate(code.toUpperCase().trim(), purchaseId, orderAmount);
    }

    private async buildPaymentMap(userId: number): Promise<Map<number, PurchasePaymentInfo>> {
        const [orders, payments] = await Promise.all([
            this.orderService.findAllByUserWithPriceInfo(userId),
            this.repo.findAllByUserId(userId),
        ]);

        const breakdownByPurchase = this.summarizeBreakdowns(orders);
        const map = new Map<number, PurchasePaymentInfo>();
        const getEntry = (purchaseId: number, tag: string): PurchasePaymentInfo =>
            map.get(purchaseId) ?? {
                due: 0,
                paid: 0,
                hasPending: false,
                remaining: 0,
                tag,
                breakdown: breakdownByPurchase.get(purchaseId) ?? null,
            };

        for (const order of orders) {
            const purchaseId = order.purchaseItem?.purchaseId;
            const tag = order.purchaseItem?.purchase?.tag ?? '—';
            if (!purchaseId) continue;

            const entry = getEntry(purchaseId, tag);
            entry.due += Number(order.amountDue);
            if (tag !== '—') entry.tag = tag;
            map.set(purchaseId, entry);
        }

        for (const payment of payments) {
            const tag = payment.purchase?.tag ?? '—';
            const entry = getEntry(payment.purchaseId, tag);
            if (payment.status === 'CONFIRMED') {
                entry.paid += Number(payment.amount) + this.sumChildAmount(payment.children);
            }
            if (payment.status === 'PENDING') {
                entry.hasPending = true;
            }
            if (tag !== '—') entry.tag = tag;
            map.set(payment.purchaseId, entry);
        }

        map.forEach((val) => {
            val.remaining = Math.max(0, val.due - val.paid);
        });

        return map;
    }

    private summarizeBreakdowns(
        orders: Awaited<ReturnType<OrderService['findAllByUserWithPriceInfo']>>,
    ): Map<number, PurchasePaymentBreakdown | null> {
        type BreakdownAcc = PurchasePaymentBreakdown & { complete: boolean };

        const acc = new Map<number, BreakdownAcc>();

        for (const order of orders) {
            const purchaseId = order.purchaseItem?.purchaseId;
            if (!purchaseId) continue;
            const line = order.priceInfo
                ? computeOrderLinePriceBreakdown({
                      amountDue: Number(order.amountDue),
                      quantity: Number(order.quantity),
                      packageCount: Number(order.packageCount ?? 0),
                      pricePerPackCurrency: order.priceInfo.pricePerPackCurrency,
                      rateToRub: order.priceInfo.rateToRub,
                      packSize: order.priceInfo.packSize,
                      packDiscountPercent: order.priceInfo.packDiscountPercent,
                      orgFeePercent: order.priceInfo.orgFeePercent,
                      deliveryPercent: order.priceInfo.deliveryPercent,
                  })
                : null;
            const prev = acc.get(purchaseId) ?? { base: 0, org: 0, delivery: 0, complete: true };
            acc.set(purchaseId, {
                base: prev.base + (line?.baseRub ?? 0),
                org: prev.org + (line?.orgFeeRub ?? 0),
                delivery: prev.delivery + (line?.deliveryRub ?? 0),
                complete: prev.complete && line != null,
            });
        }

        const result = new Map<number, PurchasePaymentBreakdown | null>();
        acc.forEach((value, key) => {
            result.set(
                key,
                value.complete
                    ? {
                          base: Math.round(value.base * 100) / 100,
                          org: Math.round(value.org * 100) / 100,
                          delivery: Math.round(value.delivery * 100) / 100,
                      }
                    : null,
            );
        });
        return result;
    }

    private sumChildAmount(children: { amount: unknown }[] | undefined | null): number {
        return (children ?? []).reduce((s, c) => s + Number(c.amount), 0);
    }
}
