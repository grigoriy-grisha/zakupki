import type { CustomContext } from '../lib/types';

/**
 * Middleware that requires an authenticated user (session.userId present).
 * Replies with a hint to press /start if not authenticated.
 */
export function requireAuth() {
    return async (ctx: CustomContext, next: () => Promise<void>) => {
        if (!ctx.session.userId) {
            await ctx.reply('Сначала нажмите /start');
            return;
        }
        await next();
    };
}
