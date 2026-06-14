import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import {
    Prisma,
    PrismaClient,
    PaymentStatus,
    PromoType,
    PurchaseFulfillmentStatus,
    PurchaseStatus,
    RoleKind,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const envPath of [path.join(__dirname, '../.env'), path.join(process.cwd(), '.env')]) {
    if (existsSync(envPath)) config({ path: envPath });
}

// Prisma 7: Prisma-классы (PrismaClientKnownRequestError, JsonNull, …) и TransactionClient
// живут внутри `Prisma` namespace. Экспортируем их под теми же именами через re-export
// из namespace, чтобы остальной код продолжал импортировать их плоско из `@zakupki/database`.
export { Prisma, PrismaClient, PurchaseStatus, PurchaseFulfillmentStatus, PaymentStatus, PromoType, RoleKind };
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
