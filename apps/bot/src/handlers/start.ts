import type { CustomContext } from '../types';

export async function startCommand(ctx: CustomContext) {
    const name = ctx.from?.first_name ?? 'Друг';
    const webAppUrl = getWebAppUrl();

    const replyMarkup = webAppUrl
        ? {
              reply_markup: {
                  inline_keyboard: [
                      [{ text: '🛒 Открыть магазин', web_app: { url: webAppUrl } }],
                  ],
              },
          }
        : undefined;

    await ctx.reply(
        `Привет, ${name}! 👋\n\n` +
        `Я бот закупок. Здесь можно:\n` +
        `• Просматривать активные закупки\n` +
        `• Делать заказы\n` +
        `• Оплачивать и отслеживать статус\n\n` +
        (webAppUrl ? 'Нажмите кнопку ниже, чтобы открыть магазин:' : 'Магазин скоро будет доступен!'),
        replyMarkup,
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

function getWebAppUrl(): string | null {
    const baseUrl = process.env.WEBAPP_URL?.trim();
    if (!baseUrl) return null;
    return `${baseUrl}/webapp`;
}
