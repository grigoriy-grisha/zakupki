import type { Context, SessionFlavor } from 'grammy';
import type { PrismaClient } from '@zakupki/database';

export interface SessionData {
    userId?: number;
    telegramId?: number;
}

export type CustomContext = Context & SessionFlavor<SessionData> & {
    db: PrismaClient;
};
