import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';

/** Подпись для inline-кнопки закупки: «тег · этап» (лимит Telegram — 64 символа). */
export function formatPurchaseButtonLabel(tag: string, fulfillmentStatus: string | null | undefined): string {
    const status = (fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
    const statusLabel = PURCHASE_FULFILLMENT_LABELS[status] ?? status;
    return `${tag} · ${statusLabel}`.slice(0, 64);
}
