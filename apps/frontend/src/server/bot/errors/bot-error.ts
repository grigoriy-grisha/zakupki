import { AppError } from '@zakupki/types';

/**
 * Базовый класс ошибок бота. Расширяет AppError из @zakupki/types.
 *
 * Используется для всех доменных ошибок в bot/. ErrorTranslatorMiddleware
 * перехватывает BotError и отправляет пользователю `err.message` (на русском).
 */
export class BotError extends AppError {
    constructor(code: string, message: string) {
        super(`BOT_${code}`, message);
        this.name = 'BotError';
    }
}
