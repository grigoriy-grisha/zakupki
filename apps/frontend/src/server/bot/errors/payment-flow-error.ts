import { BotError } from './bot-error';

/**
 * Категория ошибки payment flow. Используется для message-level switch
 * в ErrorTranslatorMiddleware, если потребуется разная логика для разных reason.
 */
export type PaymentFlowErrorReason =
    | 'NOT_OPEN' // Оплата по закупке ещё не открыта (статус не PAYMENT_*)
    | 'NO_INFO' // Не удалось получить payment info (закупка не найдена)
    | 'AMOUNT_INVALID' // Введено невалидное число
    | 'AMOUNT_TOO_LARGE' // Сумма больше remaining
    | 'PENDING_EXISTS' // Уже есть оплата на проверке
    | 'MIME_INVALID' // Файл не image/PDF
    | 'FILE_TOO_LARGE' // Файл больше 5 MB
    | 'UPLOAD_FAILED' // Не удалось скачать/загрузить
    | 'NOT_FOUND'; // Purchase / payment не найден

/**
 * Ошибка payment flow. Бросается сервисами `BotPaymentService` / `PaymentFlowStateMachine`.
 * `message` — это user-facing текст на русском, который ErrorTranslatorMiddleware
 * отправит пользователю.
 */
export class PaymentFlowError extends BotError {
    constructor(public readonly reason: PaymentFlowErrorReason, message: string) {
        super(`PAYMENT_${reason}`, message);
        this.name = 'PaymentFlowError';
    }
}
