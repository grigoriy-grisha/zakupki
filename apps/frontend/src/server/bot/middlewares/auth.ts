import type { CustomContext } from '../domain/types';

/**
 * AuthGuard — middleware, требующий ctx.session.userId.
 *
 * В Phase C использовался как функция `requireAuth()`. После рефакторинга —
 * класс с методом middleware(). Старая функция оставлена для backward-compat.
 */
export class AuthGuard {
    middleware() {
        return async (ctx: CustomContext, next: () => Promise<void>): Promise<void> => {
            if (!ctx.session.userId) {
                await ctx.reply('Сначала нажмите /start');
                return;
            }
            await next();
        };
    }
}

/** Backward-compat функция. */
export function requireAuth() {
    return new AuthGuard().middleware();
}
