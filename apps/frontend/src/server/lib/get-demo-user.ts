import type { PrismaClient } from '@zakupki/database';

/**
 * Resolve the demo user (telegramId '0'). Used as placeholder until
 * Telegram WebApp initData validation is implemented.
 */
export async function getDemoUser(db: PrismaClient) {
    return db.user.upsert({
        where: { telegramId: '0' },
        update: {},
        create: { telegramId: '0', firstName: 'Demo', username: 'demo' },
    });
}
