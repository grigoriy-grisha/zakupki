import { getActiveBotConfig } from '../config/bot-config';
import { CallbackParser } from '../domain/callback-data';

export function privacyUrl(): string {
    const base = getActiveBotConfig().webapp.url;
    return `${base ?? 'https://scheglove.ru'}/privacy`;
}

export function welcomeText(name: string, hasShop: boolean): string {
    return (
        `Привет, ${name}!\n\n` +
        `Я бот закупок. Здесь можно:\n` +
        `• Просматривать активные закупки\n` +
        `• Делать заказы\n` +
        `• Оплачивать и отслеживать статус\n\n` +
        `Команды:\n` +
        `/start — открыть приложение\n` +
        `/help — справка\n` +
        `/orders — мои заказы\n` +
        `/pay — отправить чек об оплате\n` +
        `/payments — мои оплаты\n` +
        `/cancel — отменить отправку оплаты\n\n` +
        (hasShop ? 'Нажмите кнопку ниже, чтобы открыть приложение:' : 'Приложение скоро будет доступно!')
    );
}

export function consentText(name: string): string {
    return (
        `Привет, ${name}!\n\n` +
        `Прежде чем продолжить, подтвердите согласие на обработку персональных данных — ` +
        `без него бот не сможет вести ваши заказы и оплаты.\n\n` +
        `Полный текст согласия: ${privacyUrl()}`
    );
}

export function consentKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '✅ Даю согласие', callback_data: CallbackParser.build({ kind: 'consent:accept' }) }],
            [{ text: '📄 Открыть согласие', url: privacyUrl() }],
        ],
    };
}
