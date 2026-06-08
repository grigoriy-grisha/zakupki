import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';

/** Короткие подписи для inline-кнопок (лимит Telegram — 64 символа). */
const FULFILLMENT_BUTTON_LABELS: Record<PurchaseFulfillmentStatus, string> = {
    COLLECTION: 'Сбор заказов',
    REORDER: 'Доборы',
    PAYMENT: 'Оплата заказов',
    SUPPLIER_ASSEMBLY: 'Комплектация',
    PREPARING_SHIPMENT_RF: 'Отправка в РФ',
    IN_TRANSIT_RF: 'Едет в РФ',
    IN_TRANSIT_TO_ORGANIZER: 'До организатора',
    PACKAGING: 'Фасовка',
    READY_FOR_PICKUP: 'К выдаче',
};

export function formatPurchaseButtonLabel(
    tag: string,
    fulfillmentStatus: string | null | undefined,
): string {
    const status = (fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const statusLabel = FULFILLMENT_BUTTON_LABELS[status] ?? PURCHASE_FULFILLMENT_LABELS[status];
    return `${tag} · ${statusLabel}`.slice(0, 64);
}
