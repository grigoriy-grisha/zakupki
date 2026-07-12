import { GrammyError } from 'grammy';
import { createLogger } from '@zakupki/logger';

import type { CustomContext } from '../../domain/types';
import { getWebAppUrl, shopStartKeyboard } from '../../lib/webapp-url';
import type { CommandHandler } from '../../domain/handler';

const log = createLogger('start-command');

const START_TEXT = (name: string, hasShop: boolean) =>
    `Привет, ${name}! 👋\n\n` +
    `Я бот закупок. Здесь можно:\n` +
    `• Просматривать активные закупки\n` +
    `• Делать заказы\n` +
    `• Оплачивать и отслеживать статус\n\n` +
    `📋 Команды:\n` +
    `/start — открыть приложение\n` +
    `/help — справка\n` +
    `/orders — мои заказы\n` +
    `/pay — отправить чек об оплате\n` +
    `/payments — мои оплаты\n` +
    `/cancel — отменить отправку оплаты\n\n` +
    (hasShop ? 'Нажмите кнопку ниже, чтобы открыть приложение:' : 'Приложение скоро будет доступно!');

/**
 * /start — welcome + shop button.
 */
export class StartCommand implements CommandHandler {
    readonly command = 'start';
    readonly requireAuth = false;

    async handle(ctx: CustomContext): Promise<void> {
        const name = ctx.from?.first_name ?? 'Друг';
        const text = START_TEXT(name, !!getWebAppUrl());
        const replyMarkup = shopStartKeyboard();

        try {
            await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
        } catch (err) {
            if (err instanceof GrammyError && replyMarkup) {
                log.warn({ description: err.description }, 'reply with button failed');
                await ctx.reply(text);
                return;
            }
            log.error({ err }, 'start command failed');
            throw err;
        }
    }
}
