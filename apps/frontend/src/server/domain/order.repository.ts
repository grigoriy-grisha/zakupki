import { dbClient } from '@zakupki/database';
import { type HandoffStatus, NotFoundError } from '@zakupki/types';

import { productInclude } from './product-include';
import { USER_CREDENTIALS_INCLUDE } from './user.types';

/** Полная форма строки заказа для админских списков (участники/закупка). */
const ORDER_LINES_WITH_PARTICIPANT_INCLUDE = {
    user: { include: USER_CREDENTIALS_INCLUDE },
    purchaseItem: {
        include: {
            product: { include: productInclude },
            supplier: { select: { id: true, name: true } },
        },
    },
    purchaseOrder: {
        select: { id: true, comment: true, commentAuthor: true, commentAt: true, handoffStatus: true },
    },
};

export class OrderRepository {
    /**
     * Создать или обновить строку заказа.
     */
    async upsertOrderLine(
        purchaseItemId: number,
        userId: number,
        quantity: number,
        amountDue: number,
        packageCount?: number,
        createdOnStage: string = 'COLLECTION',
    ) {
        const purchaseItem = await dbClient.purchaseItem.findUnique({
            where: { id: purchaseItemId },
            select: { purchaseId: true },
        });
        if (!purchaseItem) throw new NotFoundError('Товар закупки', purchaseItemId);

        // Находим/создаём PurchaseOrder (userId, purchaseId) и забираем его id —
        // он обязателен для OrderLine (FK purchaseOrderId).
        const purchaseOrder = await dbClient.purchaseOrder.upsert({
            where: { userId_purchaseId: { userId, purchaseId: purchaseItem.purchaseId } },
            create: { userId, purchaseId: purchaseItem.purchaseId },
            update: {},
            select: { id: true },
        });

        // Повторный заказ того же товара оживляет «удалённую» строку — снимок больше не нужен.
        const data = {
            quantity,
            amountDue,
            status: 'ACTIVE' as const,
            removedQuantity: null,
            removedPackageCount: null,
            removedAt: null,
        };
        if (packageCount != null) {
            (data as any).packageCount = packageCount;
        }

        return dbClient.orderLine.upsert({
            where: {
                purchaseItemId_userId_createdOnStage: { purchaseItemId, userId, createdOnStage: createdOnStage as any },
            },
            create: {
                purchaseItemId,
                userId,
                purchaseOrderId: purchaseOrder.id,
                ...data,
                ...(packageCount != null ? { packageCount } : {}),
                createdOnStage: createdOnStage as any,
            },
            update: data,
        });
    }

    /**
     * Удалить строку заказа по id (hard delete).
     */
    async deleteOrderLineById(id: number) {
        return dbClient.orderLine.delete({ where: { id } });
    }

    /**
     * Админ удалил позицию: строка остаётся, но уходит в CANCELLED с нулями
     * (во всех суммах не участвует), а прежние количества сохраняются в снимке,
     * чтобы позицию можно было вернуть.
     */
    async softDeleteLines(ids: number[]): Promise<void> {
        if (ids.length === 0) return;
        const lines = await dbClient.orderLine.findMany({
            where: { id: { in: ids }, status: 'ACTIVE' },
            select: { id: true, quantity: true, packageCount: true, purchaseItemId: true, userId: true },
        });
        const now = new Date();
        // Старые снимки того же товара у того же участника сбрасываем — иначе
        // «Вернуть» сложило бы прежнее удаление с новым.
        const pairs = [...new Map(lines.map((l) => [`${l.userId}:${l.purchaseItemId}`, l])).values()];
        const clearStale = pairs.map((l) =>
            dbClient.orderLine.updateMany({
                where: {
                    userId: l.userId,
                    purchaseItemId: l.purchaseItemId,
                    status: 'CANCELLED',
                    removedAt: { not: null },
                },
                data: { removedAt: null, removedQuantity: null, removedPackageCount: null },
            }),
        );
        await dbClient.$transaction([
            ...clearStale,
            ...lines.map((line) =>
                dbClient.orderLine.update({
                    where: { id: line.id },
                    data: {
                        status: 'CANCELLED',
                        removedQuantity: line.quantity,
                        removedPackageCount: line.packageCount,
                        removedAt: now,
                        quantity: 0,
                        packageCount: 0,
                        amountDue: 0,
                    },
                }),
            ),
        ]);
    }

    /** Пары «участник:товар», у которых есть ACTIVE-строки в закупке. */
    async findActiveUserItemKeys(purchaseId: number): Promise<Set<string>> {
        const rows = await dbClient.orderLine.findMany({
            where: { purchaseItem: { purchaseId }, status: 'ACTIVE' },
            select: { userId: true, purchaseItemId: true },
            distinct: ['userId', 'purchaseItemId'],
        });
        return new Set(rows.map((r) => `${r.userId}:${r.purchaseItemId}`));
    }

    /** ACTIVE-строки участника на товар — id для мягкого удаления. */
    async findActiveLineIdsByUserAndItem(purchaseItemId: number, userId: number): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            where: { purchaseItemId, userId, status: 'ACTIVE' },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    }

    /** Удалённые админом строки участника на товар (со снимком количеств). */
    findRemovedLinesByUserAndItem(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItemId, userId, status: 'CANCELLED', removedAt: { not: null } },
            select: { id: true, createdOnStage: true, removedQuantity: true, removedPackageCount: true },
        });
    }

    /** Вернуть удалённые строки с пересчитанными суммами — одной транзакцией. */
    async restoreLines(rows: { id: number; quantity: number; packageCount: number; amountDue: number }[]) {
        await dbClient.$transaction(
            rows.map((row) =>
                dbClient.orderLine.update({
                    where: { id: row.id, status: 'CANCELLED' },
                    data: {
                        status: 'ACTIVE',
                        quantity: row.quantity,
                        packageCount: row.packageCount,
                        amountDue: row.amountDue,
                        removedQuantity: null,
                        removedPackageCount: null,
                        removedAt: null,
                    },
                }),
            ),
        );
    }

    /** Все удалённые админом позиции в закупке — для блока «Удалённые» у участника. */
    findRemovedByPurchase(purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItem: { purchaseId }, status: 'CANCELLED', removedAt: { not: null } },
            include: {
                purchaseItem: ORDER_LINES_WITH_PARTICIPANT_INCLUDE.purchaseItem,
            },
            omit: { tgChatMessageId: true },
            orderBy: { removedAt: 'desc' },
        });
    }

    /**
     * Удалить все строки пользователя для purchaseItem (hard delete — COLLECTION).
     */
    async deleteAllLinesForUserItem(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.deleteMany({
            where: { purchaseItemId, userId },
        });
    }

    /**
     * Отменить заказ (soft delete).
     */
    async cancelOrder(id: number) {
        return dbClient.orderLine.update({
            where: { id },
            data: { status: 'CANCELLED', quantity: 0, amountDue: 0 },
        });
    }

    /**
     * Hard delete для админа.
     */
    /** У участника есть оплата по закупке (подтверждённая или на проверке) — позиции нельзя стирать бесследно. */
    async hasPaymentsInPurchase(userId: number, purchaseId: number): Promise<boolean> {
        const count = await dbClient.payment.count({
            where: {
                userId,
                purchaseId,
                parentId: null,
                refundOfId: null,
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        });
        return count > 0;
    }

    async findActiveLineIdsByUserAndPurchase(userId: number, purchaseId: number): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            where: { userId, status: 'ACTIVE', purchaseItem: { purchaseId } },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    }

    countActiveLinesByUserAndItem(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.count({ where: { purchaseItemId, userId, status: 'ACTIVE' } });
    }

    // ── Queries ──────────────────────────────────────────────────────

    findById(id: number) {
        return dbClient.orderLine.findUnique({
            where: { id },
            include: { purchaseItem: { include: { purchase: { select: { status: true, fulfillmentStatus: true } } } } },
        });
    }

    /**
     * Найти COLLECTION-строку (базовый заказ) пользователя.
     */
    findBaseLine(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findUnique({
            where: {
                purchaseItemId_userId_createdOnStage: { purchaseItemId, userId, createdOnStage: 'COLLECTION' as any },
            },
        });
    }

    /**
     * Найти все ACTIVE строки пользователя для purchaseItem (базовые + supplement).
     */
    findAllActiveLinesForUserItem(purchaseItemId: number, userId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItemId, userId, status: 'ACTIVE' },
        });
    }

    findActiveOrdersByUserId(userId: number) {
        return dbClient.orderLine.findMany({
            where: {
                userId,
                status: 'ACTIVE',
                purchaseItem: {
                    purchase: { status: { in: ['ACTIVE'] } },
                },
            },
            include: {
                purchaseItem: {
                    include: {
                        product: true,
                        purchase: {
                            select: { id: true, tag: true, status: true, fulfillmentStatus: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findAllByUserId(userId: number) {
        return dbClient.orderLine.findMany({
            where: { userId },
            include: {
                purchaseItem: {
                    include: {
                        purchase: {
                            select: {
                                id: true,
                                tag: true,
                                status: true,
                                fulfillmentStatus: true,
                                deliveryPercent: true,
                                currencyRates: { select: { currencyId: true, rateToRub: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    /** Строки заказа клиента по одной закупке с товаром — для расшифровки платежа в чеке. */
    async findReceiptLines(userId: number, purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: { userId, purchaseItem: { purchaseId } },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: productInclude },
                        purchase: {
                            select: {
                                id: true,
                                tag: true,
                                deliveryPercent: true,
                                currencyRates: { select: { currencyId: true, rateToRub: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { id: 'asc' },
        });
    }

    async getByUser(userId: number) {
        return dbClient.orderLine.findMany({
            // Заказы удалённых закупок клиенту не показываем: оплатить их уже нельзя.
            where: { userId, status: 'ACTIVE', purchaseItem: { purchase: { deletedAt: null } } },
            include: {
                purchaseItem: {
                    include: {
                        product: { include: productInclude },
                        purchase: {
                            select: {
                                id: true,
                                tag: true,
                                status: true,
                                fulfillmentStatus: true,
                                deliveryPercent: true,
                                currencyRates: { select: { currencyId: true, rateToRub: true } },
                            },
                        },
                    },
                },
                purchaseOrder: {
                    select: { handoffStatus: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getByPurchase(purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItem: { purchaseId }, status: 'ACTIVE' },
            // Stable order keyed on values that DON'T change when an admin edits
            // a line. The previous `id: 'asc'` made items jump around: adminSetQuantity
            // collapses all of a user's lines on an item into a fresh COLLECTION row
            // (new id = max), which silently re-sorted that item to the end of the
            // participant's card on every edit. Sorting by `purchaseItemId` (stable —
            // reflects the order items were added to the purchase) keeps each
            // participant's items in a fixed position regardless of line recreation.
            // Tiebreak with id only to keep multi-line items (COLLECTION + supplement)
            // deterministic between otherwise identical rows.
            orderBy: [{ userId: 'asc' }, { purchaseItemId: 'asc' }, { id: 'asc' }],
            include: ORDER_LINES_WITH_PARTICIPANT_INCLUDE,
        });
    }

    /** Строки одного участника в закупке — лёгкий слайс той же формы, что getByPurchase. */
    async getByPurchaseAndUser(purchaseId: number, userId: number) {
        return dbClient.orderLine.findMany({
            where: { purchaseItem: { purchaseId }, userId, status: 'ACTIVE' },
            orderBy: [{ purchaseItemId: 'asc' }, { id: 'asc' }],
            include: ORDER_LINES_WITH_PARTICIPANT_INCLUDE,
        });
    }

    async findByUserAndPurchase(userId: number, purchaseId: number) {
        return dbClient.orderLine.findMany({
            where: {
                userId,
                status: 'ACTIVE',
                purchaseItem: { purchaseId },
            },
            include: {
                purchaseItem: {
                    include: {
                        product: true,
                        purchase: {
                            select: {
                                id: true,
                                tag: true,
                                status: true,
                                fulfillmentStatus: true,
                                deliveryPercent: true,
                                currencyRates: { select: { currencyId: true, rateToRub: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Удалить все заказы пользователя в закупке.
     */
    async deleteAllByUserAndPurchase(userId: number, purchaseId: number) {
        return dbClient.orderLine.deleteMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
            },
        });
    }

    /**
     * Вернуть список PurchaseItem.id, на которые у пользователя есть ACTIVE-строки
     * в данной закупке. Используется OrderService, чтобы эмитить обновление поста
     * после `deleteAllByUserAndPurchase`.
     */
    async findPurchaseItemIdsByUserAndPurchase(userId: number, purchaseId: number): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            where: {
                userId,
                purchaseItem: { purchaseId },
            },
            select: { purchaseItemId: true },
            distinct: ['purchaseItemId'],
        });
        return rows.map((r) => r.purchaseItemId);
    }

    /**
     * id закупок, где есть хотя бы одна ACTIVE строка заказа (для пересчёта сумм).
     * Завершённые и удалённые не берём: там всё оплачено и закрыто, пересчёт дал бы ложные долги.
     */
    async findPurchaseIdsWithActiveLines(): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            where: {
                status: 'ACTIVE',
                purchaseItem: { purchase: { status: { not: 'DONE' }, deletedAt: null } },
            },
            select: { purchaseItem: { select: { purchaseId: true } } },
        });
        return [...new Set(rows.map((r) => r.purchaseItem.purchaseId))];
    }

    /** All distinct user ids who have at least one order line in a purchase. */
    async findParticipantUserIds(purchaseId: number): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            // Позиции, удалённые админом, не делают человека участником (до мягкого удаления их просто не было).
            where: { purchaseItem: { purchaseId }, removedAt: null },
            select: { userId: true },
            distinct: ['userId'],
        });
        return rows.map((r) => r.userId);
    }

    /** Distinct owners of ACTIVE lines on a purchase item. */
    async findActiveLineUserIds(purchaseItemId: number): Promise<number[]> {
        const rows = await dbClient.orderLine.findMany({
            where: { purchaseItemId, status: 'ACTIVE' },
            select: { userId: true },
            distinct: ['userId'],
        });
        return rows.map((r) => r.userId);
    }

    /**
     * Create-or-get the per-(user, purchase) PurchaseOrder header. Idempotent —
     * used by addParticipant to register a "bare" participant (no order lines yet).
     * Mirrors the upsert inside upsertOrderLine.
     */
    async ensurePurchaseOrder(userId: number, purchaseId: number): Promise<{ id: number; createdAt: Date }> {
        return dbClient.purchaseOrder.upsert({
            where: { userId_purchaseId: { userId, purchaseId } },
            create: { userId, purchaseId },
            update: {},
            select: { id: true, createdAt: true },
        });
    }

    /**
     * Delete the per-(user, purchase) PurchaseOrder header. Used when removing a
     * participant entirely — a bare participant (PurchaseOrder with no lines)
     * would otherwise survive removeAllByUserAndPurchase and linger in the list.
     */
    async deletePurchaseOrder(userId: number, purchaseId: number): Promise<void> {
        await dbClient.purchaseOrder.deleteMany({
            where: { userId, purchaseId },
        });
    }

    /**
     * All PurchaseOrder headers for a purchase — the source of truth for
     * "who is a participant".
     * Carries user info for display + comment fields for the comment strip.
     */
    async findPurchaseOrdersByPurchase(purchaseId: number) {
        return dbClient.purchaseOrder.findMany({
            where: {
                purchaseId,
            },
            select: {
                id: true,
                userId: true,
                comment: true,
                commentAuthor: true,
                commentAt: true,
                handoffStatus: true,
                handoffAt: true,
                user: { include: USER_CREDENTIALS_INCLUDE },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findPurchaseOrderWithPurchase(id: number) {
        return dbClient.purchaseOrder.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                purchaseId: true,
                handoffStatus: true,
                purchase: { select: { tag: true } },
            },
        });
    }

    async setHandoffStatus(id: number, status: HandoffStatus | null, actorId: number) {
        const data =
            status == null
                ? { handoffStatus: null, handoffAt: null, handoffBy: null }
                : { handoffStatus: status, handoffAt: new Date(), handoffBy: actorId };
        return dbClient.purchaseOrder.update({ where: { id }, data });
    }

    async countParticipantsWithoutHandoff(purchaseId: number): Promise<number> {
        return dbClient.purchaseOrder.count({
            where: { purchaseId, handoffStatus: null },
        });
    }

    /**
     * Заморозить baseQuantity и basePackageCount для COLLECTION-строк закупки
     * (при переходе COLLECTION → REORDER).
     */
    async freezeBaseQuantities(purchaseId: number) {
        const lines = await dbClient.orderLine.findMany({
            where: {
                status: 'ACTIVE',
                baseQuantity: null,
                createdOnStage: 'COLLECTION',
                purchaseItem: { purchaseId },
            },
            select: { id: true, quantity: true, packageCount: true },
        });

        await dbClient.$transaction(
            lines.map((line) =>
                dbClient.orderLine.update({
                    where: { id: line.id },
                    data: {
                        baseQuantity: line.quantity,
                        basePackageCount: line.packageCount,
                    },
                }),
            ),
        );
    }

    /**
     * Разморозить baseQuantity и basePackageCount при откате REORDER → COLLECTION.
     */
    async unfreezeBaseQuantities(purchaseId: number) {
        await dbClient.orderLine.updateMany({
            where: {
                status: 'ACTIVE',
                purchaseItem: { purchaseId },
            },
            data: {
                baseQuantity: null,
                basePackageCount: null,
            },
        });
    }

    async updateAmountDueBulk(entries: { id: number; amountDue: number }[]) {
        await dbClient.$transaction(async (tx) => {
            for (const entry of entries) {
                await tx.orderLine.update({
                    where: { id: entry.id },
                    data: { amountDue: entry.amountDue },
                });
            }
        });
    }
}
