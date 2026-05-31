import { dbClient } from '@zakupki/database';

const db = dbClient;

export class PurchaseItemRepository {
    findById(id: number) {
        return db.purchaseItem.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        unit: true,
                        photos: {
                            orderBy: { sortOrder: 'asc' },
                            take: 1,
                            select: { objectKey: true, mimeType: true },
                        },
                    },
                },
                purchase: { select: { tag: true, status: true } },
            },
        });
    }

    updateTelegramMessage(id: number, messageId: string, channelId: string) {
        return db.purchaseItem.update({
            where: { id },
            data: {
                tgMessageId: messageId,
                tgChannelId: channelId,
            },
        });
    }

    findByTelegramPost(channelId: string, messageId: string) {
        const channelIds = [...new Set([channelId, ...this.channelIdVariants(channelId)])];

        return db.purchaseItem.findFirst({
            where: {
                tgMessageId: messageId,
                tgChannelId: { in: channelIds },
                isActive: true,
            },
            include: {
                product: { include: { unit: true } },
                purchase: { select: { id: true, tag: true, status: true } },
            },
        });
    }

    private channelIdVariants(channelId: string) {
        const normalized = channelId.trim();
        const variants = new Set<string>([normalized]);
        if (normalized.startsWith('-100')) {
            variants.add(normalized.slice(4));
            variants.add(normalized.slice(1));
        } else if (normalized.startsWith('-')) {
            variants.add(normalized.slice(1));
            variants.add(`-100${normalized.slice(1)}`);
        } else if (/^\d+$/.test(normalized)) {
            variants.add(`-${normalized}`);
            variants.add(`-100${normalized}`);
        }
        return [...variants];
    }

    findByTgMessageId(messageId: string) {
        return db.purchaseItem.findFirst({
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
