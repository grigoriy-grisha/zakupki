import { dbClient } from '@zakupki/database';
import { APP_SETTING_KEYS, DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT } from '@zakupki/types';

export class AppSettingRepository {
    private tableReady: Promise<void> | null = null;

    private ensureTable() {
        if (!this.tableReady) {
            this.tableReady = this.bootstrapTable().catch((error) => {
                this.tableReady = null;
                throw error;
            });
        }
        return this.tableReady;
    }

    private async bootstrapTable() {
        await dbClient.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "AppSetting" (
                "key" TEXT NOT NULL,
                "value" TEXT NOT NULL,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
            );
        `);
        await dbClient.$executeRawUnsafe(
            `INSERT INTO "AppSetting" ("key", "value", "updatedAt")
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT ("key") DO NOTHING`,
            APP_SETTING_KEYS.BEAD_PACK_PRICE_DISCOUNT_PERCENT,
            String(DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT),
        );
    }

    async get(key: string): Promise<{ value: string } | null> {
        await this.ensureTable();
        const rows = await dbClient.$queryRawUnsafe<{ value: string }[]>(
            `SELECT "value" FROM "AppSetting" WHERE "key" = $1 LIMIT 1`,
            key,
        );
        return rows[0] ?? null;
    }

    async set(key: string, value: string) {
        await this.ensureTable();
        await dbClient.$executeRawUnsafe(
            `INSERT INTO "AppSetting" ("key", "value", "updatedAt")
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
            key,
            value,
        );
    }
}
