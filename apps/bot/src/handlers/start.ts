import type { CustomContext } from '../domain/types';
import { getWebAppUrl, shopInlineKeyboardForGroup } from '../lib/webapp-url';

export async function startCommand(ctx: CustomContext) {
    const name = ctx.from?.first_name ?? 'Друг';
    const webAppUrl = getWebAppUrl();
    const replyMarkup = shopInlineKeyboardForGroup();

    await ctx.reply(
        `Привет, ${name}! 👋\n\n` +
            `Я бот закупок. Здесь можно:\n` +
            `• Просматривать активные закупки\n` +
            `• Делать заказы\n` +
            `• Оплачивать и отслеживать статус\n\n` +
            `📋 Команды:\n` +
            `/start — открыть магазин\n` +
            `/help — справка\n` +
            `/orders — мои заказы\n` +
            `/payments — мои оплаты\n\n` +
            (webAppUrl ? 'Нажмите кнопку ниже, чтобы открыть магазин:' : 'Магазин скоро будет доступен!'),
        replyMarkup ? { reply_markup: replyMarkup } : undefined,
    );
}

export async function helpCommand(ctx: CustomContext) {
    await ctx.reply(
        '📋 Доступные команды:\n\n' +
            '/start — открыть магазин\n' +
            '/help — эта справка\n' +
            '/orders — мои заказы\n' +
            '/payments — мои оплаты\n\n' +
            'По вопросам обращайтесь сюда: @kind_of_girl',
    );
}
