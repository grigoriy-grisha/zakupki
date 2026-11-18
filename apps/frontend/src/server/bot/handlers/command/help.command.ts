import type { CommandHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';

/**
 * /help — статическая справка.
 */
export class HelpCommand implements CommandHandler {
    readonly command = 'help';
    readonly requireAuth = false;

    async handle(ctx: CustomContext): Promise<void> {
        await ctx.reply(
            'Доступные команды:\n\n' +
                '/start — открыть приложение\n' +
                '/help — эта справка\n' +
                '/orders — мои заказы\n' +
                '/pay — оплатить картой или по СБП\n' +
                '/payments — мои оплаты\n' +
                '/cancel — отменить оплату\n\n' +
                'По вопросам обращайтесь сюда: @kind_of_girl',
        );
    }
}
