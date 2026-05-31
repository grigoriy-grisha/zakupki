import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const envPath of [path.join(__dirname, '../.env'), path.join(process.cwd(), '.env')]) {
    if (existsSync(envPath)) config({ path: envPath });
}

import { Prisma } from '@prisma/client';

export * from '@prisma/client';
export { Prisma };
export type TransactionClient = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { db?: PrismaClient };

const { DATABASE_URL = '' } = process.env;

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
export const dbClient = globalForPrisma.db ?? (globalForPrisma.db = new PrismaClient({ adapter }));
