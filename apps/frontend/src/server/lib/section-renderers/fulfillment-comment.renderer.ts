import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { BaseSectionRenderer, escapeHtmlLocal, joinNonEmpty, type SectionProps } from './base-section-renderer';

const FULFILLMENT_HINTS: Record<PurchaseFulfillmentStatus, string> = {
    COLLECTION: 'Сбор заказов открыт. Добавляйте товар граммами или целыми пачками — кнопка «+1 упак.».',
    REORDER:
        'Добор: остатки добавляются граммами с шагом добора, целая пачка — сразу целиком кнопкой «+1 упак.» (упак. = полная пачка поставщика).',
    PAYMENT:
        'Добавить можно только остатки — граммами с шагом добора. Целые пачки («+1 упак.») на этом этапе уже недоступны.',
    SUPPLIER_ASSEMBLY: 'Заказ комплектуется поставщиком.',
    PREPARING_SHIPMENT_RF: 'Подготовка к отправке в РФ.',
    IN_TRANSIT_RF: 'Товар едет в РФ.',
    IN_TRANSIT_TO_ORGANIZER: 'Товар едет до организатора.',
    PACKAGING: 'Фасовка.',
    READY_FOR_PICKUP: 'Заказы готовы к выдаче.',
};

export interface FulfillmentCommentData {
    status: string;
    /** Опциональный ID поста в канале — для префикса "Пост #N" в обсуждении. */
    channelPostMessageId?: number;
}

/**
 * Комментарий «Статус закупки изменён» под постом в обсуждении.
 * В обычной супергруппе (не форум) — Telegram не поддерживает message_thread_id,
 * поэтому комментарий «висит» в общей ленте. Префикс "Пост #N" помогает
 * пользователю понять, к какому посту он относится.
 */
export class FulfillmentCommentRenderer extends BaseSectionRenderer<FulfillmentCommentData> {
    readonly id = 'FULFILLMENT_COMMENT' as const;

    render({ data }: SectionProps<FulfillmentCommentData>): string | null {
        const status = data.status as PurchaseFulfillmentStatus;
        const label = PURCHASE_FULFILLMENT_LABELS[status] ?? data.status;
        const hint = FULFILLMENT_HINTS[status] ?? '';
        const prefix = data.channelPostMessageId != null ? `Пост #${data.channelPostMessageId}` : null;

        return joinNonEmpty([
            '<b>Статус закупки изменён</b>',
            prefix,
            `<b>${escapeHtmlLocal(label)}</b>`,
            hint || null,
        ]);
    }
}
