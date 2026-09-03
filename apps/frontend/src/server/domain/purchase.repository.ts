import type { Prisma} from '@zakupki/database';
import { dbClient, type PurchaseFulfillmentStatus,type PurchaseStatus } from '@zakupki/database';
import { getUnitShortName } from '@zakupki/types';

import { productInclude } from './product-include';

export class PurchaseRepository {
    constructor() {}

    private static itemsWhere(includeHidden: boolean) {
        return includeHidden ? undefined : { hidden: false };
    }

    private static visibilityWhere(includeHidden: boolean) {
        return includeHidden ? {} : { deletedAt: null };
    }

    async list(status?: string, includeHidden = false) {
        return dbClient.purchase.findMany({
            where: {
                ...(status ? { status: status as PurchaseStatus } : {}),
                ...PurchaseRepository.visibilityWhere(includeHidden),
            },
            include: {
                items: {
                    where: PurchaseRepository.itemsWhere(includeHidden),
                    orderBy: { id: 'asc' },
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

    async listByStatuses(statuses: string[], includeHidden = false) {
        return dbClient.purchase.findMany({
            where: {
                status: { in: statuses as PurchaseStatus[] },
                ...PurchaseRepository.visibilityWhere(includeHidden),
            },
            include: {
                items: {
                    where: PurchaseRepository.itemsWhere(includeHidden),
                    orderBy: { id: 'asc' },
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

    async listByStatusesForUser(userId: number, statuses: string[], includeHidden = false) {
        return dbClient.purchase.findMany({
            where: {
                status: { in: statuses as PurchaseStatus[] },
                items: { some: { orderLines: { some: { userId } } } },
                ...PurchaseRepository.visibilityWhere(includeHidden),
            },
            include: {
                items: {
                    where: PurchaseRepository.itemsWhere(includeHidden),
                    orderBy: { id: 'asc' },
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

    async getById(id: number, includeHidden = false) {
        return dbClient.purchase.findFirst({
            where: { id, ...PurchaseRepository.visibilityWhere(includeHidden) },
            include: {
                items: {
                    where: PurchaseRepository.itemsWhere(includeHidden),
                    orderBy: { id: 'asc' },
                    include: {
                        product: { include: productInclude },
                        supplier: { select: { id: true, name: true } },
                        currency: { select: { id: true, name: true, code: true, symbol: true } },
                        orderLines: { include: { user: true }, omit: { tgChatMessageId: true } },
                    },
                },
                currencyRates: { include: { currency: { select: { id: true, name: true, symbol: true } } } },
                payments: { include: { user: true } },
            },
        });
    }

    findByTag(tag: string) {
        return dbClient.purchase.findUnique({ where: { tag }, select: { id: true, tag: true } });
    }

    softDelete(id: number) {
        return dbClient.purchase.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async findTagById(id: number): Promise<string | null> {
        const purchase = await dbClient.purchase.findUnique({ where: { id }, select: { tag: true } });
        return purchase?.tag ?? null;
    }

    async findItemLabel(id: number): Promise<{
        purchaseId: number;
        purchaseTag: string;
        productLabel: string;
        unitShort: string;
    } | null> {
        const row = await dbClient.purchaseItem.findUnique({
            where: { id },
            select: {
                product: { select: { name: true, unitCode: true } },
                purchase: { select: { id: true, tag: true } },
            },
        });
        if (!row) return null;
        return {
            purchaseId: row.purchase.id,
            purchaseTag: row.purchase.tag,
            productLabel: row.product.name,
            unitShort: getUnitShortName(row.product.unitCode),
        };
    }

    async findPurchaseIdByItem(purchaseItemId: number): Promise<number | null> {
        const row = await dbClient.purchaseItem.findUnique({
            where: { id: purchaseItemId },
            select: { purchaseId: true },
        });
        return row?.purchaseId ?? null;
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

    async findExistingPurchaseItems(purchaseId: number, pairs: { productId: number; supplierId: number | null }[]) {
        if (pairs.length === 0) return [];
        const OR = pairs.map((p) => ({ productId: p.productId, supplierId: p.supplierId }));
        return dbClient.purchaseItem.findMany({
            where: { purchaseId, OR },
            select: { productId: true, supplierId: true },
        });
    }

    async addItem(
        purchaseId: number,
        config: {
            productId: number;
            supplierId?: number | null;
            description?: string | null;
            minPackageAmount?: number | null;
            minPackageUnit?: string | null;
            supplementStep?: number | null;
            packAmount?: number | null;
            packUnit?: string | null;
            currencyId?: number | null;
            pricePerPackCurrency?: number | null;
            orgFeePercentOverride?: number | null;
        },
    ) {
        return dbClient.purchaseItem.create({
            data: {
                purchaseId,
                productId: config.productId,
                supplierId: config.supplierId ?? null,
                description: config.description ?? null,
                minPackageAmount: config.minPackageAmount ?? null,
                minPackageUnit: config.minPackageUnit ?? null,
                supplementStep: config.supplementStep ?? null,
                packAmount: config.packAmount ?? null,
                packUnit: config.packUnit ?? null,
                currencyId: config.currencyId ?? null,
                pricePerPackCurrency: config.pricePerPackCurrency ?? null,
                orgFeePercentOverride: config.orgFeePercentOverride ?? null,
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

    async setCurrencyRates(
        purchaseId: number,
        rates: { currencyId: number; rateToRub: number }[],
        deliveryPercent?: number,
    ) {
        return dbClient.$transaction(async (tx) => {
            if (deliveryPercent != null) {
                await tx.purchase.update({ where: { id: purchaseId }, data: { deliveryPercent } });
            }
            await tx.purchaseCurrencyRate.deleteMany({ where: { purchaseId } });
            if (rates.length === 0) return [];
            return tx.purchaseCurrencyRate.createMany({
                data: rates.map((r) => ({ purchaseId, currencyId: r.currencyId, rateToRub: r.rateToRub })),
            });
        });
    }

    async getCurrencyRates(purchaseId: number) {
        return dbClient.purchaseCurrencyRate.findMany({
            where: { purchaseId },
            include: { currency: { select: { id: true, name: true, code: true, symbol: true } } },
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
                purchaseId: true,
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
                        basePackageCount: true,
                        packageCount: true,
                        status: true,
                        createdOnStage: true,
                    },
                },
                purchase: { include: { currencyRates: true } },
            },
        });
    }

    async findItemForDescription(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            include: {
                product: { include: productInclude },
                supplier: { select: { id: true, name: true } },
                currency: { select: { id: true, name: true, code: true, symbol: true } },
                purchase: {
                    select: {
                        id: true,
                        tag: true,
                        deliveryPercent: true,
                        currencyRates: { include: { currency: true } },
                    },
                },
            },
        });
    }

    async updatePurchaseItem(
        purchaseItemId: number,
        data: Prisma.PurchaseItemUncheckedUpdateInput,
    ) {
        return dbClient.purchaseItem.update({
            where: { id: purchaseItemId },
            data,
        });
    }

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
