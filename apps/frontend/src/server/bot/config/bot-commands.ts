/**
 * Команды бота, регистрируемые через bot.api.setMyCommands.
 * Используется в ServiceContainer.init() или в start.ts.
 */
export const BOT_COMMANDS = [
    { command: 'start', description: 'Открыть магазин' },
    { command: 'help', description: 'Справка' },
    { command: 'orders', description: 'Мои заказы' },
    { command: 'pay', description: 'Отправить чек об оплате' },
    { command: 'payments', description: 'Мои платеты' },
    { command: 'cancel', description: 'Отменить отправку оплаты' },
] as const;
