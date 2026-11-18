import type { PaymentMethod, PaymentStatus, Prisma } from '@zakupki/database';
import { dbClient } from '@zakupki/database';
import { NotFoundError, ValidationError } from '@zakupki/types';

export class PaymentRepository {
    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return dbClient.payment.create({
            data: {
                userId: data.userId,
                purchaseId: data.purchaseId,
                amount: data.amount,
                adminNote: data.note,
                status: 'CONFIRMED',
            },
        });
    }

    async submitPayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofObjectKey?: string;
        promoCodeId?: number;
        discountAmount?: number;
        /** Для онлайн-оплаты: AWAITING + данные провайдера. По умолчанию — ручной перевод (PENDING). */
        online?: {
            method: Exclude<PaymentMethod, 'MANUAL'>;
            feeAmount: number;
            providerOrderId: string;
            expiresAt: Date;
        };
    }) {
        return dbClient.$transaction(async (tx) => {
            let promoCountedAlready = false;
            if (data.promoCodeId && data.discountAmount) {
                const promoCheck = await tx.$queryRaw<Array<{ id: number; maxUses: number | null; usedCount: number }>>`
                    SELECT id, "maxUses", "usedCount"
                    FROM "PromoCode"
                    WHERE id = ${data.promoCodeId}
                    FOR UPDATE
                `;

                const promo = promoCheck[0];
                if (!promo) {
                    throw new NotFoundError('Промокод', data.promoCodeId);
                }
                // Активация считается одна на заказ: доплата с уже закреплённым кодом лимит не тратит.
                promoCountedAlready = await this.isPromoCounted(tx, data.userId, data.purchaseId, data.promoCodeId);
                if (!promoCountedAlready && promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
                    throw new ValidationError('Промокод исчерпан');
                }
            }

            const parent = await tx.payment.create({
                data: {
                    userId: data.userId,
                    purchaseId: data.purchaseId,
                    amount: data.amount,
                    userComment: data.userComment,
                    proofObjectKey: data.proofObjectKey,
                    ...(data.online
                        ? {
                              status: 'AWAITING' as const,
                              method: data.online.method,
                              feeAmount: data.online.feeAmount,
                              providerOrderId: data.online.providerOrderId,
                              expiresAt: data.online.expiresAt,
                          }
                        : {}),
                },
            });

            if (data.promoCodeId && data.discountAmount) {
                await tx.payment.create({
                    data: {
                        userId: data.userId,
                        purchaseId: data.purchaseId,
                        amount: data.discountAmount,
                        parentId: parent.id,
                        promoCodeId: data.promoCodeId,
                        ...(data.online ? { status: 'AWAITING' as const, method: data.online.method } : {}),
                    },
                });
                if (!promoCountedAlready) {
                    await tx.promoCode.update({
                        where: { id: data.promoCodeId },
                        data: { usedCount: { increment: 1 } },
                    });
                }
            }

            return tx.payment.findUnique({
                where: { id: parent.id },
                include: { children: { include: { promoCode: true } } },
            });
        });
    }

    /** Есть ли у клиента по закупке живая оплата с этим промокодом (активация уже посчитана). */
    private async isPromoCounted(
        tx: Prisma.TransactionClient,
        userId: number,
        purchaseId: number,
        promoCodeId: number,
        /** Не учитывать скидку этой оплаты (её дочерние строки). */
        excludeParentId?: number,
    ): Promise<boolean> {
        const found = await tx.payment.findFirst({
            where: {
                userId,
                purchaseId,
                promoCodeId,
                status: { not: 'REJECTED' },
                amount: { gt: 0 },
                ...(excludeParentId != null
                    ? { OR: [{ parentId: null }, { parentId: { not: excludeParentId } }] }
                    : {}),
            },
            select: { id: true },
        });
        return found != null;
    }

    async getByPurchase(purchaseId: number) {
        return dbClient.payment.findMany({
            where: { purchaseId, parentId: null },
            include: {
                user: true,
                children: { include: { promoCode: true } },
                refunds: { select: { amount: true, status: true } },
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async getByUser(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: { purchase: true, children: { include: { promoCode: true } } },
            orderBy: { submittedAt: 'desc' },
        });
    }

    findAllByUserId(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null },
            include: {
                purchase: { select: { id: true, tag: true } },
                children: true,
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async getById(id: number) {
        return dbClient.payment.findUnique({ where: { id }, include: { children: true } });
    }

    async findPinnedPromo(userId: number, purchaseId: number) {
        const payment = await dbClient.payment.findFirst({
            where: {
                userId,
                purchaseId,
                parentId: null,
                status: { not: 'REJECTED' },
                children: { some: { promoCodeId: { not: null } } },
            },
            include: { children: { include: { promoCode: true } } },
            orderBy: { submittedAt: 'desc' },
        });
        return payment?.children.find((c) => c.promoCodeId != null)?.promoCode ?? null;
    }

    async getPromoDiscountUsed(userId: number, purchaseId: number, promoCodeId: number) {
        const agg = await dbClient.payment.aggregate({
            where: {
                userId,
                purchaseId,
                promoCodeId,
                status: { not: 'REJECTED' },
            },
            _sum: { amount: true },
        });
        return Number(agg._sum.amount ?? 0);
    }

    async findWithPurchase(id: number) {
        return dbClient.payment.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                purchaseId: true,
                amount: true,
                status: true,
                method: true,
                purchase: { select: { tag: true } },
            },
        });
    }

    async updateStatus(id: number, status: 'CONFIRMED' | 'REJECTED', adminNote?: string) {
        const result = await this.transition(id, status, { adminNote });
        if (!result) throw new NotFoundError('Платёж', id);
        return result;
    }

    /**
     * Атомарный переход статуса (родитель + дочерние платежи по промокоду).
     * `expected` — переход выполнится, только если текущий статус совпадает (идемпотентность вебхуков);
     * иначе вернёт null.
     */
    async transition(
        id: number,
        status: 'CONFIRMED' | 'REJECTED',
        data: { adminNote?: string; providerStatus?: string; paidAt?: Date },
        expected?: PaymentStatus[],
    ) {
        return dbClient.$transaction(async (tx) => {
            const existing = await tx.payment.findUnique({
                where: { id },
                include: { children: { select: { promoCodeId: true } } },
            });
            if (!existing) return null;
            // Захват по статусу: из двух одновременных переходов в один статус пройдёт только первый,
            // поэтому счётчик промокода не поменяется дважды.
            const claimed = await tx.payment.updateMany({
                where: { id, status: expected ? { in: expected } : { not: status } },
                data: { status, ...data },
            });
            if (claimed.count === 0) return null;
            const updated = await tx.payment.findUniqueOrThrow({ where: { id } });
            await tx.payment.updateMany({
                where: { parentId: id },
                data: { status },
            });

            const promoIds = [
                ...new Set(existing.children.map((c) => c.promoCodeId).filter((x): x is number => x != null)),
            ];
            const wasRejected = existing.status === 'REJECTED';
            for (const promoCodeId of promoIds) {
                const usedElsewhere = await this.isPromoCounted(
                    tx,
                    existing.userId,
                    existing.purchaseId,
                    promoCodeId,
                    id,
                );
                if (usedElsewhere) continue;
                if (status === 'REJECTED' && !wasRejected) {
                    await tx.promoCode.updateMany({
                        where: { id: promoCodeId, usedCount: { gt: 0 } },
                        data: { usedCount: { decrement: 1 } },
                    });
                } else if (status === 'CONFIRMED' && wasRejected) {
                    // Клиент оплатил уже закрытую у нас ссылку — активация промокода снова занята.
                    await tx.promoCode.update({
                        where: { id: promoCodeId },
                        data: { usedCount: { increment: 1 } },
                    });
                }
            }
            return updated;
        });
    }

    findByProviderOrderId(providerOrderId: string) {
        return dbClient.payment.findUnique({
            where: { providerOrderId },
            include: { purchase: { select: { tag: true } } },
        });
    }

    findAwaiting(userId: number, purchaseId: number) {
        return dbClient.payment.findMany({
            where: { userId, purchaseId, parentId: null, status: 'AWAITING' },
            orderBy: { submittedAt: 'asc' },
        });
    }

    /** Все незавершённые онлайн-платежи пользователя (по всем закупкам). */
    findAwaitingByUser(userId: number) {
        return dbClient.payment.findMany({
            where: { userId, parentId: null, status: 'AWAITING' },
            orderBy: { submittedAt: 'asc' },
        });
    }

    /** Онлайн-платежи, срок оплаты которых истёк до `before`. */
    findStaleAwaiting(before: Date, limit = 50) {
        return dbClient.payment.findMany({
            where: { parentId: null, status: 'AWAITING', expiresAt: { lt: before } },
            orderBy: { expiresAt: 'asc' },
            take: limit,
        });
    }

    /** Сколько уже возвращено по платежу (положительное число). */
    async getRefundedTotal(paymentId: number): Promise<number> {
        const agg = await dbClient.payment.aggregate({
            where: { refundOfId: paymentId, status: 'CONFIRMED' },
            _sum: { amount: true },
        });
        return -Number(agg._sum.amount ?? 0);
    }

    /**
     * Записывает сделанный возврат: строка с отрицательной суммой, сразу учтённая в оплатах.
     * Если оплата была со скидкой по промокоду, вместе с деньгами «отменяется» и соответствующая
     * доля скидки (отрицательная дочерняя строка), иначе долг уменьшился бы на скидку, которой
     * уже нет. При полном возврате отменяется вся оставшаяся скидка.
     */
    createRefund(data: {
        original: {
            id: number;
            userId: number;
            purchaseId: number;
            amount: unknown;
            method: PaymentMethod;
            providerPaymentId: string | null;
        };
        amount: number;
        adminNote: string;
        providerStatus?: string;
    }) {
        return dbClient.$transaction(async (tx) => {
            const refund = await tx.payment.create({
                data: {
                    userId: data.original.userId,
                    purchaseId: data.original.purchaseId,
                    amount: -data.amount,
                    status: 'CONFIRMED',
                    method: data.original.method,
                    refundOfId: data.original.id,
                    providerPaymentId: data.original.providerPaymentId,
                    providerStatus: data.providerStatus,
                    adminNote: data.adminNote,
                    paidAt: new Date(),
                },
            });

            const discountChild = await tx.payment.findFirst({
                where: { parentId: data.original.id, promoCodeId: { not: null }, status: 'CONFIRMED' },
                select: { amount: true, promoCodeId: true },
            });
            const discount = Number(discountChild?.amount ?? 0);
            const paidNet = Number(data.original.amount);
            if (discountChild && discount > 0 && paidNet > 0) {
                const previous = await tx.payment.findMany({
                    where: { refundOfId: data.original.id, status: 'CONFIRMED', id: { not: refund.id } },
                    select: { amount: true, children: { select: { amount: true, promoCodeId: true } } },
                });
                const refundedBefore = -previous.reduce((sum, r) => sum + Number(r.amount), 0);
                const discountReversed = -previous.reduce(
                    (sum, r) =>
                        sum + r.children.filter((c) => c.promoCodeId != null).reduce((a, c) => a + Number(c.amount), 0),
                    0,
                );
                const discountLeft = Math.round((discount - discountReversed) * 100) / 100;
                const isFull = Math.round((refundedBefore + data.amount) * 100) >= Math.round(paidNet * 100);
                const share = isFull
                    ? discountLeft
                    : Math.min(discountLeft, Math.round(((discount * data.amount) / paidNet) * 100) / 100);
                if (share > 0) {
                    await tx.payment.create({
                        data: {
                            userId: data.original.userId,
                            purchaseId: data.original.purchaseId,
                            amount: -share,
                            status: 'CONFIRMED',
                            method: data.original.method,
                            parentId: refund.id,
                            promoCodeId: discountChild.promoCodeId,
                            paidAt: new Date(),
                        },
                    });
                }
            }

            if (data.providerStatus) {
                await tx.payment.update({
                    where: { id: data.original.id },
                    data: { providerStatus: data.providerStatus },
                });
            }
            return refund;
        });
    }

    setProviderData(
        id: number,
        data: { providerPaymentId?: string; paymentUrl?: string; providerStatus?: string; adminNote?: string },
    ) {
        return dbClient.payment.update({ where: { id }, data });
    }
}
