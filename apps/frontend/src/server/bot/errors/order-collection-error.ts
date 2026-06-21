import { BotError } from './bot-error';

export type OrderCollectionErrorReason =
    | 'INVALID_QUANTITY' // "+2п" / "abc" / "1.5.6" — не удалось распарсить
    | 'PRODUCT_NOT_FOUND' // Не найден PurchaseItem для этого сообщения
    | 'PURCHASE_INACTIVE' // Закупка уже не принимает заказы
    | 'UNKNOWN'; // Неожиданная ошибка при записи

/**
 * Ошибка order collection (когда бот собирает заказы из чата обсуждений/группы).
 * Бросается OrderCollectionService.collectFromReply.
 *
 * NOTE: текущая реализация OrderCollectionService возвращает `{ ok: false, reason, message }`
 * (не throws). Этот класс — для будущей миграции на exceptions (Phase E).
 */
export class OrderCollectionError extends BotError {
    constructor(public readonly reason: OrderCollectionErrorReason, message: string) {
        super(`ORDER_${reason}`, message);
        this.name = 'OrderCollectionError';
    }
}
