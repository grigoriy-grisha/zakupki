import type { CustomContext } from '../../domain/types';
import type { CommandHandler } from '../../domain/handler';

/**
 * /help — статическая справка.
 */
export class HelpCommand implements CommandHandler {
    readonly command = 'help';
    readonly requireAuth = false;

    async handle(ctx: CustomContext): Promise<void> {
        await ctx.reply(
            '📋 Доступные команды:\n\n' +
                '/start — открыть магазин\n' +
                '/help — эта справка\n' +
                '/orders — мои заказы\n' +
                '/pay — отправить чек об оплате\n' +
                '/payments — мои оплаты\n' +
                '/cancel — отменить отправку оплаты\n\n' +
                'По вопросам обращайтесь сюда: @kind_of_girl',
        );
    }
}
