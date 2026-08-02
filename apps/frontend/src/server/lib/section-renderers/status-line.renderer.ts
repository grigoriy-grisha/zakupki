import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { escapeHtmlLocal, formatNumberRu, BaseSectionRenderer, type SectionProps } from './base-section-renderer';

export interface StatusLineData {
    item: {
        supplierLimit: number | null;
        supplierLimitUnit: string | null;
        targetRemainder: number | null;
    };
    purchase: { fulfillmentStatus: string };
    orderLinesSum: number;
    /**
     * Сколько ещё свободно к заказу — пул добора, посчитанный как в UI
     * (`computeRawPool`: авто по пачкам, либо targetRemainder). null/undefined —
     * fallback на `supplierLimit - orderLinesSum` ниже по интерфейсу.
     */
    freeToOrder?: number | null;
    /** Единица для строки «Свободно к заказу» (short name продукта, напр. «гр»). Fallback на supplierLimitUnit. */
    unit?: string | null;
}

/**
 * Нижняя часть поста в канале: статус закупки + лимит/остаток поставщика + пул
 * добора. Лимит/целевой остаток гейтятся на supplierLimitUnit: если ед. не задана
 * — скрываются, но строка статуса остаётся (админ видит «нет единицы, иди в
 * ItemEditSheet»). «Свободно к заказу» — это пул (как в UI), с собственной ед.
 * (unit), поэтому показывается даже без supplierLimit — пока есть
 * packSize/targetRemainder.
 */
export class StatusLineRenderer extends BaseSectionRenderer<StatusLineData> {
    readonly id = 'STATUS_LINE' as const;

    render({ data }: SectionProps<StatusLineData>): string | null {
        const { item, purchase, orderLinesSum } = data;
        const status = purchase.fulfillmentStatus as PurchaseFulfillmentStatus;
        const statusLabel = PURCHASE_FULFILLMENT_LABELS[status] ?? status;
        const unit = item.supplierLimitUnit;
        const supplierLimit = item.supplierLimit;
        const targetRemainder = item.targetRemainder;

        const lines: string[] = [`<b>${escapeHtmlLocal(statusLabel)}</b>`];

        if (supplierLimit != null && unit) {
            lines.push(`Лимит поставщика: <b>${formatNumberRu(supplierLimit)} ${escapeHtmlLocal(unit)}</b>`);
        }
        if (targetRemainder != null && unit) {
            lines.push(`Целевой остаток: <b>${formatNumberRu(targetRemainder)} ${escapeHtmlLocal(unit)}</b>`);
        }

        // «Свободно к заказу» — это пул добора, он имеет смысл только начиная с
        // REORDER. На этапе COLLECTION (Сбор заказов) строка не показывается.
        const free = data.freeToOrder ?? (supplierLimit != null ? Math.max(0, supplierLimit - orderLinesSum) : null);
        const freeUnit = data.unit ?? unit;
        if (status !== 'COLLECTION' && free != null && freeUnit) {
            lines.push(`Свободно к заказу: <b>${formatNumberRu(free)} ${escapeHtmlLocal(freeUnit)}</b>`);
        }

        return lines.join('\n');
    }
}
