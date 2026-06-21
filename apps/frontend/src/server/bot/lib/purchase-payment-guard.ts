import { dbClient, type PrismaClient } from '@zakupki/database';
import { isPurchasePaymentOpen } from '@zakupki/types';

export const PAYMENT_NOT_OPEN_MESSAGE =
    'Пока нельзя оплатить заказ.\nОплата ещё не открыта — дождитесь этапа «Оплата заказов».\nСтатус: /orders';

/**
 * Проверяет, открыт ли приём оплаты по закупке.
 *
 * Раньше был модульной функцией `isPurchasePaymentOpenById`. После рефакторинга —
 * класс с constructor-DI Prisma. ServiceContainer может передать свой `db`.
 */
export class PurchasePaymentGuard {
    constructor(private readonly db: PrismaClient = dbClient) {}

    async isOpenById(purchaseId: number): Promise<boolean> {
        const purchase = await this.db.purchase.findUnique({
            where: { id: purchaseId },
            select: { fulfillmentStatus: true },
        });
        return isPurchasePaymentOpen(purchase?.fulfillmentStatus);
    }

    /** Удобный алиас для константы. */
    get notOpenMessage(): string {
        return PAYMENT_NOT_OPEN_MESSAGE;
    }
}

/**
 * Backward-compat module function — старые импорты продолжают работать.
 * Использует singleton-инстанс guard'а.
 */
let _defaultGuard: PurchasePaymentGuard | null = null;

export async function isPurchasePaymentOpenById(purchaseId: number): Promise<boolean> {
    if (!_defaultGuard) _defaultGuard = new PurchasePaymentGuard();
    return _defaultGuard.isOpenById(purchaseId);
}
