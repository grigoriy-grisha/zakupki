import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from '@zakupki/types';

import { escapeHtmlLocal, joinNonEmpty, BaseSectionRenderer, type SectionProps } from './base-section-renderer';

const STATUS_HINTS: Record<PurchaseStatus, string> = {
    DRAFT: 'Закупка в черновике.',
    ACTIVE: 'Закупка активирована — приём заказов открыт.',
    CLOSED: 'Закупка закрыта.',
    ARRIVED: 'Товар прибыл.',
    DONE: 'Закупка завершена.',
};

export interface PurchaseStatusCommentData {
    status: string;
    channelPostMessageId?: number;
}

export class PurchaseStatusCommentRenderer extends BaseSectionRenderer<PurchaseStatusCommentData> {
    readonly id = 'PURCHASE_STATUS_COMMENT' as const;

    render({ data }: SectionProps<PurchaseStatusCommentData>): string | null {
        const status = data.status as PurchaseStatus;
        const label = PURCHASE_STATUS_LABELS[status] ?? data.status;
        const hint = STATUS_HINTS[status] ?? '';
        const prefix = data.channelPostMessageId != null ? `Пост #${data.channelPostMessageId}` : null;

        return joinNonEmpty(['🔔 <b>Закупка</b>', prefix, `<b>${escapeHtmlLocal(label)}</b>`, hint || null]);
    }
}
