import type { CustomContext } from '../types';

export async function startCommand(ctx: CustomContext) {
    const name = ctx.from?.first_name ?? 'Друг';
    await ctx.reply(
        `Привет, ${name}! 👋\n\n` +
        `Я бот закупок. Здесь можно:\n` +
        `• Просматривать активные закупки\n` +
        `• Делать заказы\n` +
        `• Оплачивать и отслеживать статус\n\n` +
        `Нажмите кнопку ниже, чтобы открыть магазин:`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛒 Открыть магазин', web_app: { url: getWebAppUrl(ctx) } }],
                ],
            },
        },
    );
}

export async function helpCommand(ctx: CustomContext) {
    await ctx.reply(
        '📋 Доступные команды:\n\n' +
        '/start — Открыть магазин\n' +
        '/help — Эта справка\n' +
        '/orders — Мои заказы\n' +
        '/payments — Мои оплаты',
    );
}

function getWebAppUrl(ctx: CustomContext): string {
    const botUsername = process.env.BOT_USERNAME ?? '';
    const baseUrl = process.env.WEBAPP_URL ?? `https://${botUsername}.t.me`;
    return `${baseUrl}/webapp`;
}
