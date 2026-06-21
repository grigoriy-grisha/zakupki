import { dbClient } from '@zakupki/database';
import { isPurchasePaymentOpen, PROOF_MIME_TYPES, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { storage } from '@/lib/server/storage';

import { OrderService } from './order.service';
import { PaymentRepository } from '../domain/payment.repository';

export type PurchasePaymentInfo = {
    due: number;
    paid: number;
    hasPending: boolean;
    remaining: number;
    tag: string;
};

export type PayablePurchase = {
    purchaseId: number;
    tag: string;
    remaining: number;
    fulfillmentStatus: PurchaseFulfillmentStatus;
};

const PAYMENT_STATUS: Record<string, { emoji: string; label: string }> = {
    PENDING: { emoji: '⏳', label: 'Ожидает проверки' },
    CONFIRMED: { emoji: '✅', label: 'Подтверждено' },
    REJECTED: { emoji: '❌', label: 'Отклонено' },
};

/**
 * Bot-специфичная оплата: списки оплат/закупок для отображения в Telegram и
 * отправка чека через бот. Public-API оплаты (админ/web) живёт в `PaymentService`.
 *
 * Читает заказы пользователя через `OrderService` (не создавая свой репозиторий),
 * хранилище чеков — через единый `storage` приложения.
 */
export class BotPaymentService {
    constructor(
        private repo: PaymentRepository,
        private orderService: OrderService,
    ) {}

    async getUserPayments(userId: number) {
        const payments = await this.repo.getByUser(userId);

        const lines = payments.map((p) => {
            const total = Number(p.amount) + this.sumChildAmount(p.children);
            const { emoji = '❓', label = p.status } = PAYMENT_STATUS[p.status] ?? {};
            return (
                `${emoji} ${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
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
        });
    }

    private async buildPaymentMap(userId: number): Promise<Map<number, PurchasePaymentInfo>> {
        const [orders, payments] = await Promise.all([
            this.orderService.findAllActiveByUser(userId),
            this.repo.findAllByUserId(userId),
        ]);

        const map = new Map<number, PurchasePaymentInfo>();

        for (const order of orders) {
            const purchaseId = order.purchaseItem?.purchaseId;
            const tag = order.purchaseItem?.purchase?.tag ?? '—';
            if (!purchaseId) continue;

            const existing = map.get(purchaseId) ?? { due: 0, paid: 0, hasPending: false, remaining: 0, tag };
            existing.due += Number(order.amountDue);
            if (tag !== '—') existing.tag = tag;
            map.set(purchaseId, existing);
        }

        for (const payment of payments) {
            const purchaseId = payment.purchaseId;
            const tag = payment.purchase?.tag ?? '—';
            const total = Number(payment.amount) + this.sumChildAmount(payment.children);

            const existing = map.get(purchaseId) ?? { due: 0, paid: 0, hasPending: false, remaining: 0, tag };
            if (payment.status === 'CONFIRMED') {
                existing.paid += total;
            }
            if (payment.status === 'PENDING') {
                existing.hasPending = true;
            }
            if (tag !== '—') existing.tag = tag;
            map.set(purchaseId, existing);
        }

        map.forEach((val) => {
            val.remaining = Math.max(0, val.due - val.paid);
        });

        return map;
    }

    private sumChildAmount(children: { amount: unknown }[] | undefined | null): number {
        return (children ?? []).reduce((s, c) => s + Number(c.amount), 0);
    }
}
