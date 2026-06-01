import { dbClient } from '@zakupki/database';
import { isPurchasePaymentOpen } from '@zakupki/types';

export async function isPurchasePaymentOpenById(purchaseId: number): Promise<boolean> {
    const purchase = await dbClient.purchase.findUnique({
        where: { id: purchaseId },
        select: { fulfillmentStatus: true },
    });
    return isPurchasePaymentOpen(purchase?.fulfillmentStatus);
}

export const PAYMENT_NOT_OPEN_MESSAGE =
    'Пока нельзя оплатить заказ.\nОплата ещё не открыта — дождитесь этапа «Оплата заказов».\nСтатус: /orders';
