import type { CustomContext } from '../domain/types';

export function requireAuth() {
    return async (ctx: CustomContext, next: () => Promise<void>) => {
        if (!ctx.session.userId) {
            await ctx.reply('Сначала нажмите /start');
            return;
        }
        await next();
    };
}
