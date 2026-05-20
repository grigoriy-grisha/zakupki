import { dbClient } from '@zakupki/database';
import { initTRPC, TRPCError } from '@trpc/server';

export const createTRPCContext = async () => {
    return { db: dbClient };
};

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(async ({ next }) => {
    // TODO: implement admin auth check (X-Telegram-Id in ADMIN_TELEGRAM_IDS)
    return next();
});

export const telegramProcedure = t.procedure.use(async ({ next }) => {
    // TODO: implement Telegram WebApp initData validation
    return next();
});
