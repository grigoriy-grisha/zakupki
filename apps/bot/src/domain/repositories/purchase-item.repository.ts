import { dbClient } from '@zakupki/database';

export class PurchaseItemRepository {
    findById(id: number) {
        return dbClient.purchaseItem.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        unit: true,
                        photos: {
                            orderBy: { sortOrder: 'asc' },
                            take: 1,
                            select: { id: true, objectKey: true, mimeType: true },
                        },
                    },
                },
                purchase: { select: { tag: true, status: true } },
            },
        });
    }

    updateTelegramMessage(id: number, messageId: string, channelId: string) {
        return dbClient.purchaseItem.update({
            where: { id },
            data: {
                tgMessageId: messageId,
                tgChannelId: channelId,
            },
        });
    }

    findByTelegramPost(channelId: string, messageId: string) {
        return dbClient.purchaseItem.findFirst({
            where: {
                tgMessageId: messageId,
                tgChannelId: channelId,
                isActive: true,
            },
            include: {
                product: { include: { unit: true } },
                purchase: { select: { id: true, tag: true, status: true } },
            },
        });
    }

    findByTgMessageId(messageId: string) {
        return dbClient.purchaseItem.findFirst({
            where: {
                tgMessageId: messageId,
                isActive: true,
            },
            include: {
                product: { include: { unit: true } },
                purchase: { select: { id: true, tag: true, status: true } },
            },
        });
    }
}
