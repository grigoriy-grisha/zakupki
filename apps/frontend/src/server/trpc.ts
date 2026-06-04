import { dbClient, RoleKind } from '@zakupki/database';
import {
    AppError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from '@zakupki/types';
import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import type { RbacConfig } from '@/lib/rbac-config';
import { buildRbac } from '@/lib/rbac-config';
import { ServiceContainer, serviceContainer } from '@/server/lib/service-container';
import { extractTelegramInitData, verifyTelegramInitData } from '@/server/lib/telegram-init-data';

type TrpcContext = {
    db: typeof dbClient;
    services: ServiceContainer;
    session: Session | null;
    userId: number | null;
    role: RoleKind | null;
    rbac: RbacConfig | undefined;
};

async function resolveAuth(req?: Request): Promise<Pick<TrpcContext, 'session' | 'userId' | 'role' | 'rbac'>> {
    const session = await getServerSession(authOptions);
    const sessionUserId = Number(session?.user?.id);
    if (session?.user?.id && sessionUserId && !Number.isNaN(sessionUserId)) {
        const role = (await serviceContainer.user.getCachedRole(sessionUserId)) ?? RoleKind.CLIENT;
        return {
            session,
            userId: sessionUserId,
            role,
            rbac: buildRbac(role),
        };
    }

    if (req) {
        const initData = extractTelegramInitData(req);
        if (initData) {
            const verified = await verifyTelegramInitData(initData);
            if (verified) {
                const user = await serviceContainer.user.signInWithTelegram(verified);
                const userId = Number(user.id);
                const role = (await serviceContainer.user.getCachedRole(userId)) ?? RoleKind.CLIENT;
                return {
                    session: null,
                    userId,
                    role,
                    rbac: buildRbac(role),
                };
            }
        }
    }

    return {
        session: session ?? null,
        userId: null,
        role: null,
        rbac: undefined,
    };
}

export const createTRPCContext = async (opts?: { req?: Request }): Promise<TrpcContext> => {
    const auth = await resolveAuth(opts?.req);

    return {
        db: dbClient,
        services: serviceContainer,
        ...auth,
    };
};

/** Convert AppError to the appropriate TRPCError code */
function appErrorToTrpc(err: AppError): TRPCError {
    if (err instanceof NotFoundError) {
        return new TRPCError({ code: 'NOT_FOUND', message: err.message });
    }
    if (err instanceof ValidationError) {
        return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
    }
    if (err instanceof ForbiddenError) {
        return new TRPCError({ code: 'FORBIDDEN', message: err.message });
    }
    // BusinessRuleError and other AppError subclasses
    return new TRPCError({ code: 'BAD_REQUEST', message: err.message });
}

const t = initTRPC.context<TrpcContext>().create({
    errorFormatter({ shape, error }) {
        const cause = error.cause;
        if (!(cause instanceof AppError)) {
            return shape;
        }

        const mapped = appErrorToTrpc(cause);
        return {
            ...shape,
            message: mapped.message,
            data: {
                ...shape.data,
                code: mapped.code as TRPC_ERROR_CODE_KEY,
            },
        };
    },
});

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
