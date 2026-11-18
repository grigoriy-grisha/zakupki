/**
 * Команды бота, регистрируемые через bot.api.setMyCommands.
 * Используется в ServiceContainer.init() или в start.ts.
 */
export const BOT_COMMANDS = [
    { command: 'start', description: 'Открыть приложение' },
    { command: 'help', description: 'Справка' },
    { command: 'orders', description: 'Мои заказы' },
    { command: 'pay', description: 'Оплатить картой или по СБП' },
    { command: 'payments', description: 'Мои платежи' },
    { command: 'cancel', description: 'Отменить оплату' },
] as const;
