import { GrammyError } from 'grammy';

import type { CustomContext } from '../domain/types';
import { getWebAppUrl, shopStartKeyboard } from '../lib/webapp-url';

const START_TEXT = (name: string, hasShop: boolean) =>
    `Привет, ${name}! 👋\n\n` +
    `Я бот закупок. Здесь можно:\n` +
    `• Просматривать активные закупки\n` +
    `• Делать заказы\n` +
    `• Оплачивать и отслеживать статус\n\n` +
    `📋 Команды:\n` +
    `/start — открыть магазин\n` +
    `/help — справка\n` +
    `/orders — мои заказы\n` +
    `/pay — отправить чек об оплате\n` +
    `/payments — мои оплаты\n` +
    `/cancel — отменить отправку оплаты\n\n` +
    (hasShop ? 'Нажмите кнопку ниже, чтобы открыть магазин:' : 'Магазин скоро будет доступен!');

export async function startCommand(ctx: CustomContext) {
    const name = ctx.from?.first_name ?? 'Друг';
    const text = START_TEXT(name, !!getWebAppUrl());
    const replyMarkup = shopStartKeyboard();

    try {
        await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    } catch (err) {
        if (err instanceof GrammyError && replyMarkup) {
            console.warn(`[start] Reply with button failed: ${err.description}`);
            await ctx.reply(text);
            return;
        }
        console.error('[start] Failed:', err);
        throw err;
    }
}

export async function helpCommand(ctx: CustomContext) {
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
