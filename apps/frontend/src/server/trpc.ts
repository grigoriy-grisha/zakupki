import { dbClient, RoleKind } from '@zakupki/database';
import { initTRPC, TRPCError } from '@trpc/server';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import type { RbacConfig } from '@/lib/rbac-config';
import { buildRbac } from '@/lib/rbac-config';
import { createRoleService } from '@/server/lib/create-user-service';

export const createTRPCContext = async () => {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : null;
    const role =
        session?.user?.role ??
        (userId != null && !Number.isNaN(userId) ? await createRoleService().getUserRoleKind(userId) : null);
    const rbac = role ? buildRbac(role) : undefined;

    return {
        db: dbClient,
        session,
        userId: userId != null && !Number.isNaN(userId) ? userId : null,
        role,
        rbac,
    };
};

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const createProtectedProcedure = (requiredAccess: (keyof RbacConfig)[] = []) =>
    t.procedure.use(async ({ ctx, next }) => {
        if (ctx.userId == null) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Необходима авторизация' });
        }

        const rbac = ctx.rbac ?? buildRbac(RoleKind.CLIENT);

        for (const access of requiredAccess) {
            if (!rbac[access]) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Недостаточно прав' });
            }
        }

        return next({
            ctx: {
                ...ctx,
                session: ctx.session as Session,
                userId: ctx.userId,
                role: ctx.role ?? RoleKind.CLIENT,
                rbac,
            },
        });
    });

/** Any authenticated user */
export const protectedProcedure = createProtectedProcedure();

/** Admin-only access */
export const adminProcedure = createProtectedProcedure(['canAccessAdminPanel']);
