import { Prisma, dbClient, type PurchaseStatus, type PurchaseFulfillmentStatus } from '@zakupki/database';

import { productInclude } from './product-include';

export class PurchaseRepository {
    constructor() {}

    async list(status?: string) {
        return dbClient.purchase.findMany({
            where: status ? { status: status as PurchaseStatus } : undefined,
            include: {
                items: {
                    include: {
                        product: { include: productInclude },
                        orderLines: {
                            select: { id: true, userId: true, quantity: true, amountDue: true, createdAt: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listByStatuses(statuses: string[]) {
        return dbClient.purchase.findMany({
            where: { status: { in: statuses as PurchaseStatus[] } },
            include: {
                items: {
                    include: {
                        product: { include: productInclude },
                        orderLines: {
                            select: { id: true, userId: true, quantity: true, amountDue: true, createdAt: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listByStatusesForUser(userId: number, statuses: string[]) {
        return dbClient.purchase.findMany({
            where: {
                status: { in: statuses as PurchaseStatus[] },
                items: { some: { orderLines: { some: { userId } } } },
            },
            include: {
                items: {
                    include: {
                        product: { include: productInclude },
                        orderLines: {
                            select: { id: true, userId: true, quantity: true, amountDue: true, createdAt: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return dbClient.purchase.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: { include: productInclude },
                        supplier: { select: { id: true, name: true } },
                        orderLines: { include: { user: true }, omit: { tgChatMessageId: true } },
                    },
                },
                payments: { include: { user: true } },
            },
        });
    }

    findByTag(tag: string) {
        return dbClient.purchase.findUnique({ where: { tag }, select: { id: true, tag: true } });
    }

    async create(data: { tag: string }) {
        return dbClient.purchase.create({ data });
    }

    async updateStatus(id: number, status: string) {
        return dbClient.purchase.update({ where: { id }, data: { status: status as PurchaseStatus } });
    }

    async updateFulfillmentStatus(id: number, fulfillmentStatus: string) {
        return dbClient.purchase.update({
            where: { id },
            data: { fulfillmentStatus: fulfillmentStatus as PurchaseFulfillmentStatus },
        });
    }

    async deleteDraft(id: number) {
        return dbClient.$transaction(async (tx) => {
            const purchase = await tx.purchase.findUnique({ where: { id }, select: { status: true } });
            if (!purchase) return null;

            const items = await tx.purchaseItem.findMany({
                where: { purchaseId: id },
                select: { id: true },
            });
            const itemIds = items.map((i) => i.id);
            if (itemIds.length > 0) {
                await tx.orderLine.deleteMany({ where: { purchaseItemId: { in: itemIds } } });
                await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
            }

            const payments = await tx.payment.findMany({
                where: { purchaseId: id },
                select: { id: true },
            });
            const paymentIds = payments.map((p) => p.id);
            if (paymentIds.length > 0) {
                await tx.payment.deleteMany({ where: { parentId: { in: paymentIds } } });
                await tx.payment.deleteMany({ where: { purchaseId: id } });
            }

            await tx.promoCode.updateMany({ where: { purchaseId: id }, data: { purchaseId: null } });
            await tx.purchaseOrder.deleteMany({ where: { purchaseId: id } });
            return tx.purchase.delete({ where: { id } });
        });
    }

    /**
     * Находит существующие позиции закупки по парам (productId, supplierId).
     * Используется для дедупликации при batch-добавлении. supplierId=null
     * матчится с позициями без поставщика.
     */
    async findExistingPurchaseItems(purchaseId: number, pairs: { productId: number; supplierId: number | null }[]) {
        if (pairs.length === 0) return [];
        const OR = pairs.map((p) => ({ productId: p.productId, supplierId: p.supplierId }));
        return dbClient.purchaseItem.findMany({
            where: { purchaseId, OR },
            select: { productId: true, supplierId: true },
        });
    }

    /**
     * Создаёт PurchaseItem. Вся per-purchase конкретика (supplierId, описание,
     * цены, фасовка) приходит в config — Product больше не источник.
     */
    async addItem(
        purchaseId: number,
        config: {
            productId: number;
            supplierId?: number | null;
            description?: string | null;
            pricePerUnit?: number | null;
            priceTiers?: unknown;
            minPackageAmount?: number | null;
            minPackageUnit?: string | null;
            supplierPackageAmount?: number | null;
            supplierPackageUnit?: string | null;
            supplierPackagePrice?: number | null;
            supplierPackageTiers?: unknown;
            supplementStep?: number | null;
        },
    ) {
        return dbClient.purchaseItem.create({
            data: {
                purchaseId,
                productId: config.productId,
                supplierId: config.supplierId ?? null,
                description: config.description ?? null,
                pricePerUnit: config.pricePerUnit ?? null,
                priceTiers: (config.priceTiers as never) ?? undefined,
                minPackageAmount: config.minPackageAmount ?? null,
                minPackageUnit: config.minPackageUnit ?? null,
                supplierPackageAmount: config.supplierPackageAmount ?? null,
                supplierPackageUnit: config.supplierPackageUnit ?? null,
                supplierPackagePrice: config.supplierPackagePrice ?? null,
                supplierPackageTiers: (config.supplierPackageTiers as never) ?? undefined,
                supplementStep: config.supplementStep ?? null,
            },
        });
    }

    async findItemWithPurchase(purchaseItemId: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id: purchaseItemId },
            select: {
                id: true,
                tgMessageId: true,
                tgChannelId: true,
                purchase: { select: { status: true, tag: true, fulfillmentStatus: true } },
            },
        });
    }

    async removeItem(id: number) {
        return dbClient.$transaction(async (tx) => {
            await tx.orderLine.deleteMany({ where: { purchaseItemId: id } });
            return tx.purchaseItem.delete({ where: { id } });
        });
    }

    async updateTgMessage(purchaseItemId: number, tgMessageId: string, tgChannelId: string) {
        return dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { tgMessageId, tgChannelId },
        });
    }

    async setAvailableQuantities(
        purchaseId: number,
        items: { purchaseItemId: number; targetRemainder: number | null; supplementStep?: number | null }[],
    ) {
        return dbClient.$transaction(async (tx) => {
            const results = [];
            for (const item of items) {
                const data: { targetRemainder: number | null; supplementStep?: number | null } = {
                    targetRemainder: item.targetRemainder,
                };
                if (item.supplementStep !== undefined) {
                    data.supplementStep = item.supplementStep;
                }
                const result = await tx.purchaseItem.update({
                    where: { id: item.purchaseItemId },
                    data,
                });
                results.push(result);
            }
            return results;
        });
    }

    async findUnpublishedItems(purchaseId: number) {
        return dbClient.purchaseItem.findMany({
            where: { purchaseId, tgMessageId: null },
            select: { id: true },
        });
    }

    findItemByTelegramPost(channelId: string, messageId: string) {
        return dbClient.purchaseItem.findFirst({
            where: {
                tgMessageId: messageId,
                tgChannelId: channelId,
                publicationState: 'PUBLISHED',
            },
            include: {
                product: true,
                orderLines: { select: { quantity: true } },
                purchase: { select: { id: true, tag: true, status: true, fulfillmentStatus: true } },
            },
        });
    }

    findItemByTgMessageId(messageId: string) {
        return dbClient.purchaseItem.findFirst({
            where: {
                tgMessageId: messageId,
                publicationState: 'PUBLISHED',
            },
            include: {
                product: true,
                orderLines: { select: { quantity: true } },
                purchase: { select: { id: true, tag: true, status: true, fulfillmentStatus: true } },
            },
        });
    }

    updateItemTelegramMessage(id: number, messageId: string, channelId: string) {
        return dbClient.purchaseItem.update({
            where: { id },
            data: { tgMessageId: messageId, tgChannelId: channelId },
        });
    }

    async setPublicationState(purchaseItemId: number, state: 'DRAFT' | 'PUBLISHED') {
        return dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data: { publicationState: state },
        });
    }

    async findItemById(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    async findItemWithProductAndTg(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            select: {
                productId: true,
                tgMessageId: true,
                tgChannelId: true,
                supplierLimit: true,
                supplierLimitUnit: true,
            },
        });
    }

    async findItemWithPrice(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            include: {
                product: true,
                orderLines: {
                    select: {
                        id: true,
                        purchaseItemId: true,
                        userId: true,
                        quantity: true,
                        amountDue: true,
                        baseQuantity: true,
                        packageCount: true,
                        status: true,
                        createdOnStage: true,
                    },
                },
                purchase: true,
            },
        });
    }

    /**
     * Универсальный апдейт PurchaseItem. Поддерживает partial update —
     * любая комбинация полей за один round-trip. Поля, перенесённые с Product
     * (описание, цены, фасовка), редактируются здесь, а не в Product.
     */
    async updatePurchaseItem(
        purchaseItemId: number,
        data: Prisma.PurchaseItemUncheckedUpdateInput,
    ) {
        return dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data,
        });
    }

    /**
     * Установить/очистить служебный комментарий админа к участнику закупки
     * (один на пару user+purchase). Пустая/whitespace-only строка → сброс
     * (comment=null, commentAt=null, commentAuthor=null). commentAt
     * ставится в now() только при записи, чтобы не зависеть от общего
     * PurchaseOrder.updatedAt (обновляется при любой правке).
     */
    async setOrderComment(id: number, comment: string, authorId: number) {
        const trimmed = comment.trim();
        if (trimmed === '') {
            return dbClient.purchaseOrder.update({
                where: { id },
                data: { comment: null, commentAt: null, commentAuthor: null },
            });
        }
        return dbClient.purchaseOrder.update({
            where: { id },
            data: { comment: trimmed, commentAuthor: authorId, commentAt: new Date() },
        });
    }
}
