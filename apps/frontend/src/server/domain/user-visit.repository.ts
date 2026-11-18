import { dbClient, Prisma } from '@zakupki/database';
import type { VisitDevice, VisitPlatform } from '@zakupki/types';

type Range = { from: Date; to: Date };

/** Посещения и активность клиентов (админы в статистику не попадают). */
export class UserVisitRepository {
    async touch(userId: number, day: Date, platform: VisitPlatform, device: VisitDevice) {
        await dbClient.$executeRaw`
            INSERT INTO "UserVisit" ("userId", "day", "platform", "device")
            VALUES (${userId}, ${day}, ${platform}::"VisitPlatform", ${device}::"VisitDevice")
            ON CONFLICT ("userId", "day", "platform", "device")
            DO UPDATE SET "hits" = "UserVisit"."hits" + 1, "lastAt" = now()`;
    }

    /** Строки визитов клиентов за период: кто, в какой день, откуда и с чего. */
    async findVisits({ from, to }: Range) {
        return dbClient.$queryRaw<
            { userId: number; day: Date; platform: VisitPlatform; device: VisitDevice }[]
        >(Prisma.sql`
            SELECT v."userId", v."day", v."platform", v."device"
            FROM "UserVisit" v
            JOIN "User" u ON u.id = v."userId" AND u.role = 'CLIENT'
            WHERE v."day" >= ${from} AND v."day" < ${to}`);
    }

    async firstVisitDay(): Promise<Date | null> {
        const [row] = await dbClient.$queryRaw<{ day: Date | null }[]>`SELECT min("day") AS day FROM "UserVisit"`;
        return row?.day ?? null;
    }

    /** Все клиенты: дата регистрации и через что входили. */
    async findClients() {
        return dbClient.$queryRaw<{ id: number; createdAt: Date; tg: boolean; vk: boolean }[]>`
            SELECT u.id, u."createdAt",
                   EXISTS (SELECT 1 FROM "TelegramCredential" t WHERE t."userId" = u.id) AS tg,
                   EXISTS (SELECT 1 FROM "VkCredential" k WHERE k."userId" = u.id) AS vk
            FROM "User" u
            WHERE u.role = 'CLIENT'`;
    }

    /** Дни, когда клиент что-то заказывал, за период (по Москве). */
    async findOrderDays({ from, to }: Range) {
        return dbClient.$queryRaw<{ userId: number; at: Date }[]>`
            SELECT DISTINCT ol."userId", date_trunc('day', ol."createdAt" + interval '3 hours') - interval '3 hours' AS at
            FROM "OrderLine" ol
            JOIN "PurchaseItem" pi ON pi.id = ol."purchaseItemId"
            JOIN "Purchase" p ON p.id = pi."purchaseId" AND p."deletedAt" IS NULL
            JOIN "User" u ON u.id = ol."userId" AND u.role = 'CLIENT'
            WHERE ol.status = 'ACTIVE' AND ol."createdAt" >= ${from} AND ol."createdAt" < ${to}`;
    }

    /** В скольких закупках участвовал каждый клиент и когда заказывал последний раз. */
    async findPurchaseCounts() {
        return dbClient.$queryRaw<{ userId: number; purchases: number; lastAt: Date }[]>`
            SELECT ol."userId", COUNT(DISTINCT pi."purchaseId")::int AS purchases, max(ol."createdAt") AS "lastAt"
            FROM "OrderLine" ol
            JOIN "PurchaseItem" pi ON pi.id = ol."purchaseItemId"
            JOIN "Purchase" p ON p.id = pi."purchaseId" AND p."deletedAt" IS NULL
            JOIN "User" u ON u.id = ol."userId" AND u.role = 'CLIENT'
            WHERE ol.status = 'ACTIVE'
            GROUP BY ol."userId"`;
    }
}
