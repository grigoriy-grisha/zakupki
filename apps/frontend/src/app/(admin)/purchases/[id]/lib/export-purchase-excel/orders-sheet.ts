import type ExcelJS from 'exceljs';

import type { AttributeTypeMeta } from '@/lib/product-label';

import { unitsInPack } from '../purchase-item-order-stats';
import {
    applyOrdersCellFill,
    applySheetBorders,
    formatMoney,
    setExcelProductNameCell,
    styleFixedColumnCell,
    styleHeaderCell,
    styleNumericCell,
} from './excel-basics';
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
    paid: 'FF92D050',
} as const;

const ORDERS_EXPORT_PRICE_HEADERS = [
    'цена за пачку в рублях',
    'цена за 5/10 гр. в рублях',
    'цена за 1 гр. в рублях',
] as const;

function isGramItem(
    purchaseItem: { unitCode?: string | null } | undefined,
    product: ExportProduct | undefined,
): boolean {
    const unitCode = purchaseItem?.unitCode ?? product?.unitCode;
    return unitCode?.toLowerCase() === 'gram';
}

function isFullPackOrder(
    item: { packAmount?: unknown; packUnit?: string | null } | undefined,
    quantity: unknown,
): boolean {
    const qty = formatMoney(quantity);
    const pack = item ? unitsInPack(item) : null;
    return Boolean(pack && qty > 0 && Math.abs(qty - pack.size) < 1e-6);
}

function orderQuantitySplitColumns(
    item: { packAmount?: unknown; packUnit?: string | null } | undefined,
    quantity: unknown,
): [string, string] {
    const qty = formatMoney(quantity);
    if (!qty) return ['', ''];

    if (isFullPackOrder(item, quantity)) {
        return ['', String(qty)];
    }

    return [String(qty), ''];
}

function orderAmountSplit(
    item: { packAmount?: unknown; packUnit?: string | null } | undefined,
    amountDue: unknown,
    quantity: unknown,
) {
    const amount = formatMoney(amountDue);
    if (isFullPackOrder(item, quantity)) {
        return { partial: 0, fullPack: amount };
    }
    return { partial: amount, fullPack: 0 };
}

function formatSupplierPackage(item?: { packAmount?: unknown; packUnit?: string | null }) {
    if (!item || item.packAmount == null) return '';
    const amount = Number(item.packAmount);
    const unit = item.packUnit?.trim();
    if (unit === 'гр' || unit === 'г') return amount;
    if (!unit) return amount;
    return `${amount} ${unit}`;
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

function purchaseItemPriceCells(_purchaseItem: unknown) {
    return ['', '', ''] as const;
}

function addParticipantGramTotalRow(sheet: ExcelJS.Worksheet, totals: { partialGr: number; fullPackGr: number }) {
    if (totals.partialGr + totals.fullPackGr <= 0) return;

    const row = sheet.addRow(['', '', '', '', 'грамм всего', totals.partialGr || '', totals.fullPackGr || '']);
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
    payment: { due: number; paid: number },
    productByItemId: Map<number, ExportProduct>,
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

    const headerRow = sheet.addRow(['', 'Фасовка поставщика, гр', ...ORDERS_EXPORT_PRICE_HEADERS, '', '']);
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
        const product =
            (order.purchaseItem?.id != null ? productByItemId.get(order.purchaseItem.id) : undefined) ??
            order.purchaseItem?.product;
        const gramItem = isGramItem(order.purchaseItem, product) ? order.purchaseItem : undefined;
        const [packPrice, price510, price1] = purchaseItemPriceCells(order.purchaseItem as never);
        const [partialQty, fullPackQty] = orderQuantitySplitColumns(gramItem, order.quantity);
        const amounts = orderAmountSplit(gramItem, order.amountDue, order.quantity);
        amountTotals.partial += amounts.partial;
        amountTotals.fullPack += amounts.fullPack;

        if (gramItem) {
            const qty = formatMoney(order.quantity);
            if (isFullPackOrder(gramItem, order.quantity)) {
                gramTotals.fullPackGr += qty;
            } else if (qty > 0) {
                gramTotals.partialGr += qty;
            }
        }

        const row = sheet.addRow([
            '',
            product ? formatSupplierPackage(gramItem) : '',
            packPrice,
            price510,
            price1,
            partialQty,
            fullPackQty,
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

    addParticipantGramTotalRow(sheet, gramTotals);

    const balance = Math.max(0, payment.due - payment.paid);

    addParticipantFooterRow(
        sheet,
        'Сумма за бисер, руб',
        {
            left: amountTotals.partial || '',
            right: amountTotals.fullPack || '',
        },
        ORDERS_EXPORT_FILL.sumBeads,
    );
    addParticipantFooterRow(
        sheet,
        'ОСТАТОК К ОПЛАТЕ, руб',
        { left: balance || '', right: '' },
        ORDERS_EXPORT_FILL.balance,
        true,
    );
    addParticipantFooterRow(sheet, 'ОПЛАЧЕНО', { left: payment.paid || '', right: '' }, ORDERS_EXPORT_FILL.paid, true);

    const blockEndRow = sheet.rowCount;
    applySheetBorders(sheet, blockStartRow, blockEndRow, 1, ORDERS_EXPORT_COLUMN_COUNT);
}
