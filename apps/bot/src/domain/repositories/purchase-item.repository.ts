import type { PrismaClient } from '@zakupki/database';

export class PurchaseItemRepository {
    private db: PrismaClient;

    constructor(db: PrismaClient) {
        this.db = db;
    }

    findById(id: number) {
        return this.db.purchaseItem.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        unit: true,
                        photos: {
                            orderBy: { sortOrder: 'asc' },
                            take: 1,
                            select: { data: true, mimeType: true },
                        },
                    },
                },
                purchase: { select: { tag: true } },
            },
        });
    }

    updateTelegramMessage(id: number, messageId: string, channelId: string) {
        return this.db.purchaseItem.update({
            where: { id },
            data: {
                tgMessageId: messageId,
                tgChannelId: channelId,
            },
        });
    }
}
