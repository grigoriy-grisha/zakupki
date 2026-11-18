import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import {
    PaymentMethod,
    PaymentStatus,
    Prisma,
    PrismaClient,
    PromoType,
    PurchaseFulfillmentStatus,
    PurchaseStatus,
    RoleKind,
} from '@prisma/client';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const envPath of [path.join(__dirname, '../.env.local'), path.join(process.cwd(), '.env.local')]) {
    if (existsSync(envPath)) config({ path: envPath });
}

// Prisma 7: Prisma-классы (PrismaClientKnownRequestError, JsonNull, …) и TransactionClient
// живут внутри `Prisma` namespace. Экспортируем их под теми же именами через re-export
// из namespace, чтобы остальной код продолжал импортировать их плоско из `@zakupki/database`.
export {
    PaymentMethod,
    PaymentStatus,
    Prisma,
    PrismaClient,
    PromoType,
    PurchaseFulfillmentStatus,
    PurchaseStatus,
    RoleKind,
};
export const {
    PrismaClientKnownRequestError,
    PrismaClientUnknownRequestError,
    PrismaClientValidationError,
    JsonNull,
    DbNull,
    AnyNull,
} = Prisma;
export type TransactionClient = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { db?: PrismaClient };

const { DATABASE_URL = '' } = process.env;

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
export const dbClient = globalForPrisma.db ?? (globalForPrisma.db = new PrismaClient({ adapter }));
