import type { PrismaClient } from '@zakupki/database';

import { PurchaseRepository } from '../domain/purchase.repository';
import { PurchaseService } from '../services/purchase.service';
import { TelegramPublishService } from '../services/telegram-publish.service';

export function createPurchaseServices(db: PrismaClient) {
    return {
        purchase: new PurchaseService(new PurchaseRepository(db)),
        telegramPublish: new TelegramPublishService(),
    };
}
