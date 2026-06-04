import { dbClient } from './database';

const BEAD_PACK_PRICE_DISCOUNT_PERCENT_KEY = 'bead_pack_price_discount_percent';
const DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT = 3;

let cachedPercent: number | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

let tableReady: Promise<void> | null = null;

function ensureTable() {
    if (!tableReady) {
        tableReady = bootstrapTable().catch((error) => {
            tableReady = null;
            throw error;
        });
    }
    return tableReady;
}

async function bootstrapTable() {
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
        BEAD_PACK_PRICE_DISCOUNT_PERCENT_KEY,
        String(DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT),
    );
}

function parsePercent(value: string | undefined | null): number {
    if (value == null || value.trim() === '') return DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        return DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
    }
    return parsed;
}

export async function getBeadPackPriceDiscountPercent(): Promise<number> {
    if (cachedPercent != null && Date.now() < cacheExpiresAt) {
        return cachedPercent;
    }

    try {
        await ensureTable();
        const rows = await dbClient.$queryRawUnsafe<{ value: string }[]>(
            `SELECT "value" FROM "AppSetting" WHERE "key" = $1 LIMIT 1`,
            BEAD_PACK_PRICE_DISCOUNT_PERCENT_KEY,
        );
        const percent = parsePercent(rows[0]?.value);
        cachedPercent = percent;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return percent;
    } catch (error) {
        console.error('[AppSetting] getBeadPackPriceDiscountPercent failed:', error);
        return DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
    }
}
