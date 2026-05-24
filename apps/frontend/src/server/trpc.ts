import { dbClient, getUserRoleKind, RoleKind } from '@zakupki/database';
import { initTRPC, TRPCError } from '@trpc/server';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

export const createTRPCContext = async () => {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : null;
    const role =
        session?.user?.role ??
        (userId != null && !Number.isNaN(userId) ? await getUserRoleKind(userId) : null);

    return {
        db: dbClient,
        session,
        userId: userId != null && !Number.isNaN(userId) ? userId : null,
        role,
    };
};

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(async ({ ctx, next }) => {
    if (ctx.userId == null) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Необходима авторизация' });
    }

    return next({
        ctx: {
            ...ctx,
            session: ctx.session as Session,
            userId: ctx.userId,
            role: ctx.role ?? RoleKind.CLIENT,
        },
    });
});

export const protectedProcedure = t.procedure.use(requireAuth);

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.role !== RoleKind.ADMIN) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Недостаточно прав администратора' });
    }
    return next({ ctx });
});
