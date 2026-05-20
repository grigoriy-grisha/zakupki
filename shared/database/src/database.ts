import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../generated/client/client';

export * from '../generated/client/client';
export { Prisma };
export type TransactionClient = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { db?: PrismaClient };

const { DATABASE_URL = '' } = process.env;

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
export const dbClient = globalForPrisma.db ?? (globalForPrisma.db = new PrismaClient({ adapter }));
