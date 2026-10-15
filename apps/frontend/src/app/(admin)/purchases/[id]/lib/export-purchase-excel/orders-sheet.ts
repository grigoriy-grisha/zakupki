import type { PurchaseItem } from '@zakupki/types';
import { isWeightUnit, resolveUnit } from '@zakupki/types';
import type ExcelJS from 'exceljs';

import type { AttributeTypeMeta } from '@/lib/product-label';

import { getPaymentStatus } from '../../../lib/payment-status';
import { unitsInPack } from '../purchase-item-order-stats';
import {
    applyOrdersCellFill,
    applySheetBorders,
    setExcelProductNameCell,
    styleFixedColumnCell,
    styleHeaderCell,
    styleNumericCell,
} from './excel-basics';
import { amountSplit, priceCells, quantitySplit, roundMoney, roundQty } from './pricing-cells';
import type { ExportOrder, ExportParticipant, ExportProduct } from './types';

const ORDERS_EXPORT_COLUMN_COUNT = 7;
const ORDERS_EXPORT_COL_PACK = 2;
const ORDERS_EXPORT_COL_PRICE_PACK = 3;
const ORDERS_EXPORT_COL_PRICE_510 = 4;
const ORDERS_EXPORT_COL_PRICE_1GR = 5;
const ORDERS_EXPORT_COL_ORDER_PARTIAL = 6;
const ORDERS_EXPORT_COL_ORDER_FULL_PACK = 7;
const ORDERS_EXPORT_FOOTER_LABEL_START = 3;
const ORDERS_EXPORT_FOOTER_LABEL_END = 5;

const ORDERS_EXPORT_FILL = {
    purchaseTag: 'FFFFC9CD',
    participantNumber: 'FF92D050',
    priceHeader: 'FF00B0F0',
    participantName: 'FFFFFF00',
    sumBeads: 'FFFFE0B2',
    balance: 'FFFFCDD2',
    pending: 'FFFFD966',
    overpaid: 'FFF8CBAD',
    paid: 'FF92D050',
} as const;

const ORDERS_EXPORT_PRICE_HEADERS = [
    'цена за пачку в рублях',
    'цена за фасовку (5/10 гр.) в рублях',
    'цена за 1 гр. в рублях',
] as const;

function formatSupplierPackage(item?: { packAmount?: unknown; packUnit?: string | null }) {
    if (!item || item.packAmount == null) return '';
    const amount = Number(item.packAmount);
    const unit = item.packUnit?.trim();
    if (!unit) return amount;
    const def = resolveUnit(unit);
    if (!def) return `${amount} ${unit}`;
    // Граммы — голое число (исторический формат листа), остальные — с единицей.
    return def.code === 'gram' ? amount : `${amount} ${def.shortName}`;
}

function participantBlockTitle(participant: ExportParticipant): ExcelJS.CellRichTextValue {
    const richText: ExcelJS.RichText[] = [];
    if (participant.purchaseOrderId != null) {
        richText.push({ text: `Заказ №${participant.purchaseOrderId}`, font: { bold: true } });
        richText.push({ text: '\n', font: { bold: true } });
    }
    richText.push({ text: participant.name, font: { bold: true } });
    if (participant.tgUsername) {
        richText.push({ text: '\n', font: { bold: true } });
        richText.push({ text: `@${participant.tgUsername}`, font: { color: { argb: 'FFFF0000' }, bold: true } });
    }
    if (participant.phone) {
        richText.push({ text: `\nТел: ${participant.phone}`, font: { size: 9 } });
    }
    if (participant.telegramId) {
        richText.push({ text: `\nTG ID: ${participant.telegramId}`, font: { size: 9 } });
    }
    if (participant.vkId) {
        richText.push({ text: `\nVK ID: ${participant.vkId}`, font: { size: 9 } });
    }
    return { richText };
}

function addParticipantQtyTotalRow(sheet: ExcelJS.Worksheet, totals: { partialGr: number; fullPackGr: number }) {
    if (totals.partialGr + totals.fullPackGr <= 0) return;

    const row = sheet.addRow(['', '', '', '', 'всего заказано', roundQty(totals.partialGr) || '', roundQty(totals.fullPackGr) || '']);
    const labelCell = row.getCell(ORDERS_EXPORT_COL_PRICE_1GR);
    labelCell.font = { bold: true };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    styleNumericCell(row.getCell(ORDERS_EXPORT_COL_ORDER_PARTIAL));
    styleNumericCell(row.getCell(ORDERS_EXPORT_COL_ORDER_FULL_PACK));
}

function addParticipantFooterRow(
    sheet: ExcelJS.Worksheet,
    label: string,
    values: { left: number | string; right: number | string },
    fillArgb: string,
    mergeValues = false,
) {
    const row = sheet.addRow(['', '', label, '', '', values.left ?? '', values.right ?? '']);
    sheet.mergeCells(row.number, ORDERS_EXPORT_FOOTER_LABEL_START, row.number, ORDERS_EXPORT_FOOTER_LABEL_END);

    if (mergeValues) {
        sheet.mergeCells(row.number, ORDERS_EXPORT_COL_ORDER_PARTIAL, row.number, ORDERS_EXPORT_COL_ORDER_FULL_PACK);
        row.getCell(ORDERS_EXPORT_COL_ORDER_PARTIAL).value = values.left;
    }

    for (let col = ORDERS_EXPORT_FOOTER_LABEL_START; col <= ORDERS_EXPORT_COLUMN_COUNT; col++) {
        const cell = row.getCell(col);
        applyOrdersCellFill(cell, fillArgb);
        cell.font = { bold: true };
        if (col >= ORDERS_EXPORT_COL_ORDER_PARTIAL) {
            styleNumericCell(cell);
        } else {
            cell.alignment = { vertical: 'middle', wrapText: true };
        }
    }
}

export function addParticipantOrdersTable(
    sheet: ExcelJS.Worksheet,
    purchaseTag: string,
    participantNumber: number,
    participant: ExportParticipant,
    userOrders: ExportOrder[],
    payment: { due: number; paid: number; pending: number },
    productByItemId: Map<number, ExportProduct>,
    itemByItemId: Map<number, PurchaseItem>,
    attributeTypes?: AttributeTypeMeta[],
) {
    const metaRow = sheet.addRow(['', '', purchaseTag, 'НОМЕР УЧАСТНИКА', '', participantNumber, '']);
    sheet.mergeCells(metaRow.number, ORDERS_EXPORT_COL_PRICE_510, metaRow.number, ORDERS_EXPORT_COL_PRICE_1GR);
    sheet.mergeCells(
        metaRow.number,
        ORDERS_EXPORT_COL_ORDER_PARTIAL,
        metaRow.number,
        ORDERS_EXPORT_COL_ORDER_FULL_PACK,
    );

    applyOrdersCellFill(metaRow.getCell(ORDERS_EXPORT_COL_PRICE_PACK), ORDERS_EXPORT_FILL.purchaseTag);
    metaRow.getCell(ORDERS_EXPORT_COL_PRICE_PACK).font = { bold: true };
    metaRow.getCell(ORDERS_EXPORT_COL_PRICE_PACK).alignment = { horizontal: 'center', vertical: 'middle' };

    const participantLabelCell = metaRow.getCell(ORDERS_EXPORT_COL_PRICE_510);
    participantLabelCell.font = { bold: true };
    participantLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const participantNumberCell = metaRow.getCell(ORDERS_EXPORT_COL_ORDER_PARTIAL);
    participantNumberCell.font = { bold: true };
    participantNumberCell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyOrdersCellFill(participantNumberCell, ORDERS_EXPORT_FILL.participantNumber);
    styleNumericCell(participantNumberCell);

    const headerRow = sheet.addRow(['', 'Фасовка поставщика', ...ORDERS_EXPORT_PRICE_HEADERS, '', '']);
    sheet.mergeCells(
        headerRow.number,
        ORDERS_EXPORT_COL_ORDER_PARTIAL,
        headerRow.number,
        ORDERS_EXPORT_COL_ORDER_FULL_PACK,
    );
    const participantTitleCell = headerRow.getCell(ORDERS_EXPORT_COL_ORDER_PARTIAL);
    participantTitleCell.value = participantBlockTitle(participant);
    participantTitleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const packHeaderCell = headerRow.getCell(ORDERS_EXPORT_COL_PACK);
    styleHeaderCell(packHeaderCell);
    packHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    for (let col = ORDERS_EXPORT_COL_PRICE_PACK; col <= ORDERS_EXPORT_COL_PRICE_1GR; col++) {
        const cell = headerRow.getCell(col);
        styleHeaderCell(cell);
        applyOrdersCellFill(cell, ORDERS_EXPORT_FILL.priceHeader);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    applyOrdersCellFill(participantTitleCell, ORDERS_EXPORT_FILL.participantName);

    const blockStartRow = metaRow.number;
    const gramTotals = { partialGr: 0, fullPackGr: 0 };
    const amountTotals = { partial: 0, fullPack: 0 };

    userOrders.forEach((order) => {
        const itemId = order.purchaseItem?.id;
        const product = (itemId != null ? productByItemId.get(itemId) : undefined) ?? order.purchaseItem?.product;
        const item = itemId != null ? itemByItemId.get(itemId) : undefined;
        const weight = isWeightUnit(item?.unitCode ?? order.purchaseItem?.unitCode ?? product?.unitCode ?? 'piece');
        const fallbackPack = order.purchaseItem ? unitsInPack(order.purchaseItem) : null;
        const packSize = item?.packAmount ?? fallbackPack?.size ?? null;

        const cells = priceCells(item);
        const split = quantitySplit(order, packSize, weight);
        const amounts = amountSplit(order, item);
        amountTotals.partial += amounts.partial;
        amountTotals.fullPack += amounts.fullPack;
        gramTotals.partialGr += split.partialGr;
        gramTotals.fullPackGr += split.fullPackGr;

        const row = sheet.addRow([
            '',
            weight ? formatSupplierPackage(order.purchaseItem) : '',
            cells.packPrice,
            cells.facingPrice,
            cells.unitPrice,
            split.partialQty,
            split.fullPackCell,
        ]);
        setExcelProductNameCell(row.getCell(1), product, attributeTypes);
        styleFixedColumnCell(row.getCell(1), 1);
        row.getCell(ORDERS_EXPORT_COL_PACK).alignment = { horizontal: 'center', vertical: 'middle' };
        styleNumericCell(row.getCell(ORDERS_EXPORT_COL_PRICE_PACK));
        styleNumericCell(row.getCell(ORDERS_EXPORT_COL_PRICE_510));
        styleNumericCell(row.getCell(ORDERS_EXPORT_COL_PRICE_1GR));
        styleNumericCell(row.getCell(ORDERS_EXPORT_COL_ORDER_PARTIAL));
        styleNumericCell(row.getCell(ORDERS_EXPORT_COL_ORDER_FULL_PACK));
    });

    addParticipantQtyTotalRow(sheet, gramTotals);

    const balance = roundMoney(Math.max(0, payment.due - payment.paid));

    addParticipantFooterRow(
        sheet,
        'Сумма за бисер, руб',
        {
            left: roundMoney(amountTotals.partial) || '',
            right: roundMoney(amountTotals.fullPack) || '',
        },
        ORDERS_EXPORT_FILL.sumBeads,
    );
    if (payment.pending > 0) {
        addParticipantFooterRow(
            sheet,
            'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ, руб',
            { left: payment.pending, right: '' },
            ORDERS_EXPORT_FILL.pending,
            true,
        );
    }
    addParticipantFooterRow(
        sheet,
        'ОСТАТОК К ОПЛАТЕ, руб',
        { left: balance || '', right: '' },
        ORDERS_EXPORT_FILL.balance,
        true,
    );
    if (getPaymentStatus(payment.due, payment.paid) === 'overpaid') {
        addParticipantFooterRow(
            sheet,
            'ПЕРЕПЛАТА, руб',
            { left: roundMoney(payment.paid - payment.due), right: '' },
            ORDERS_EXPORT_FILL.overpaid,
            true,
        );
    }
    addParticipantFooterRow(
        sheet,
        'ОПЛАЧЕНО',
        { left: roundMoney(payment.paid) || '', right: '' },
        ORDERS_EXPORT_FILL.paid,
        true,
    );

    const blockEndRow = sheet.rowCount;
    applySheetBorders(sheet, blockStartRow, blockEndRow, 1, ORDERS_EXPORT_COLUMN_COUNT);
}
