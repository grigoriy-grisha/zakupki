import ExcelJS from 'exceljs';

import { formatPurchaseProductLabel, type AttributeTypeMeta, type ProductLabelSource } from '../../../products/lib';
import { paymentTotal } from '../../lib/utils';
import { unitsInPack } from './purchase-item-order-stats';

type ExportUser = {
    firstName: string;
    lastName?: string | null;
    username?: string | null;
    phone?: string | null;
    telegramCredential?: {
        telegramId: string;
        username?: string | null;
    } | null;
    vkCredential?: {
        vkId: string;
    } | null;
};

/** Каталожные данные товара (после миграции Supplier — без цен/фасовки). */
type ExportProduct = ProductLabelSource & {
    /** Плоский код единицы из Product.unitCode (gram | piece | tube). */
    unitCode: string;
};

type ExportPurchase = {
    tag: string;
    status: string;
    fulfillmentStatus?: string | null;
    items: {
        id: number;
        // Per-purchase поля:
        minPackageAmount?: unknown;
        minPackageUnit?: string | null;
        packAmount?: unknown;
        packUnit?: string | null;
        publicationState: 'DRAFT' | 'PUBLISHED';
        tgMessageId?: string | null;
        targetRemainder?: unknown;
        supplierId?: number | null;
        supplier?: { id: number; name: string } | null;
        product: ExportProduct;
        orderLines: {
            userId: number;
            quantity: unknown;
            amountDue: unknown;
            supplementRemainder?: unknown;
            supplementPacksAdded?: unknown;
            user?: ExportUser;
        }[];
    }[];
};

type ExportOrder = {
    id: number;
    userId: number;
    purchaseOrderId?: number | null;
    quantity: unknown;
    amountDue: unknown;
    user?: ExportUser;
    purchaseItem?: {
        id?: number;
        // Per-purchase поля:
        packAmount?: unknown;
        packUnit?: string | null;
        product?: ExportProduct;
    };
};

type ExportPayment = {
    id: number;
    userId: number;
    amount: unknown;
    status: string;
    submittedAt: string | Date;
    userComment?: string | null;
    adminNote?: string | null;
    user?: ExportUser;
    children?: { amount: unknown; promoCode?: { code: string } | null }[];
};

export type PurchaseExportData = {
    purchase: ExportPurchase;
    orders: ExportOrder[];
    payments: ExportPayment[];
    attributeTypes?: AttributeTypeMeta[];
};

function excelProductNameLines(product: ExportProduct, attributeTypes?: AttributeTypeMeta[]) {
    const label = formatPurchaseProductLabel(product, undefined, attributeTypes);
    return { line1: label.line1, line2: label.line2 };
}

function setExcelProductNameCell(
    cell: ExcelJS.Cell,
    product: ExportProduct | undefined,
    attributeTypes?: AttributeTypeMeta[],
) {
    cell.alignment = { horizontal: 'left', wrapText: true, vertical: 'middle' };
    if (!product) return;

    const { line1, line2 } = excelProductNameLines(product, attributeTypes);
    if (!line1 && !line2) {
        cell.value = product.name;
        return;
    }

    const richText: ExcelJS.RichText[] = [];
    if (line1) {
        richText.push({ text: line1.replace(/ /g, '\u00A0'), font: { bold: true } });
    }
    if (line2) {
        if (line1) {
            richText.push({ text: '\n', font: { bold: true } });
        }
        richText.push({ text: line2, font: { size: 9 } });
    }

    cell.value = { richText };
}

function buildProductByItemId(purchase: ExportPurchase) {
    return new Map(purchase.items.map((item) => [item.id, item.product]));
}

function userName(user?: ExportUser) {
    if (!user) return '';
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function formatMoney(value: unknown) {
    return Number(value);
}

function formatSupplierPackage(item?: { packAmount?: unknown; packUnit?: string | null }) {
    if (!item || item.packAmount == null) return '';
    const amount = Number(item.packAmount);
    const unit = item.packUnit?.trim();
    if (unit === 'гр' || unit === 'г') return amount;
    if (!unit) return amount;
    return `${amount} ${unit}`;
}

type ExportParticipant = {
    userId: number;
    purchaseOrderId: number | null;
    name: string;
    phone: string;
    tgUsername: string;
    telegramId: string;
    vkId: string;
};

function extractParticipantCredentials(user?: ExportUser) {
    const tgUsername = (user?.telegramCredential?.username ?? user?.username ?? '').replace(/^@/, '');
    return {
        tgUsername,
        telegramId: user?.telegramCredential?.telegramId ?? '',
        vkId: user?.vkCredential?.vkId ?? '',
    };
}

function buildParticipants(orders: ExportOrder[]): ExportParticipant[] {
    const map = new Map<number, ExportParticipant>();

    orders.forEach((order) => {
        if (map.has(order.userId)) return;
        map.set(order.userId, {
            userId: order.userId,
            purchaseOrderId: order.purchaseOrderId ?? null,
            name: userName(order.user) || `Участник #${order.userId}`,
            phone: order.user?.phone?.trim() ?? '',
            ...extractParticipantCredentials(order.user),
        });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function participantStatus(due: number, paid: number, pending: number) {
    if (paid >= due) return 'Оплачено';
    if (pending > 0) return 'Ожидает подтверждения';
    if (paid > 0) return 'Частично оплачено';
    return 'Не оплачено';
}

function safeFilename(tag: string, suffix: string) {
    const base = tag.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
    const date = new Date().toISOString().slice(0, 10);
    return `${base}_${suffix}_${date}.xlsx`;
}

const excelThinBorder: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: 'FF000000' },
};

const excelCellBorders: Partial<ExcelJS.Borders> = {
    top: excelThinBorder,
    left: excelThinBorder,
    bottom: excelThinBorder,
    right: excelThinBorder,
};

function applyCellBorder(cell: ExcelJS.Cell) {
    cell.border = excelCellBorders;
}

function applySheetBorders(sheet: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number) {
    for (let rowNumber = fromRow; rowNumber <= toRow; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        for (let col = fromCol; col <= toCol; col++) {
            applyCellBorder(row.getCell(col));
        }
    }
}

function styleNumericCell(cell: ExcelJS.Cell) {
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
}

function styleHeaderCell(cell: ExcelJS.Cell) {
    cell.font = { bold: true };
}

function styleFixedColumnCell(cell: ExcelJS.Cell, columnIndex: number) {
    if (columnIndex === 1) {
        cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
        };
        return;
    }
    if (columnIndex >= 3) {
        styleNumericCell(cell);
        return;
    }
    cell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
    };
}

function styleHeaderRow(row: ExcelJS.Row) {
    row.eachCell((cell) => styleHeaderCell(cell));
}

function addDataSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    headers: string[],
    rows: unknown[][],
    numericColumnIndices: number[] = [],
) {
    const sheet = workbook.addWorksheet(name);
    styleHeaderRow(sheet.addRow(headers));
    rows.forEach((row) => {
        const sheetRow = sheet.addRow(row);
        numericColumnIndices.forEach((col) => styleNumericCell(sheetRow.getCell(col)));
    });
    applySheetBorders(sheet, 1, sheet.rowCount, 1, headers.length);
    autoFitColumns(sheet);
    return sheet;
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
    sheet.columns.forEach((column) => {
        if (!column?.number) return;
        let maxLength = 10;
        sheet.getColumn(column.number).eachCell({ includeEmpty: false }, (cell) => {
            maxLength = Math.max(maxLength, String(cell.value ?? '').length);
        });
        column.width = Math.min(maxLength + 2, 50);
    });
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function buildParticipantSummary(orders: ExportOrder[], payments: ExportPayment[]) {
    const userOrders = new Map<number, ExportOrder[]>();
    orders.forEach((order) => {
        const list = userOrders.get(order.userId) ?? [];
        list.push(order);
        userOrders.set(order.userId, list);
    });

    const paidByUser = new Map<number, number>();
    const pendingByUser = new Map<number, number>();
    payments.forEach((payment) => {
        const total = paymentTotal(payment);
        if (payment.status === 'CONFIRMED') {
            paidByUser.set(payment.userId, (paidByUser.get(payment.userId) ?? 0) + total);
        }
        if (payment.status === 'PENDING') {
            pendingByUser.set(payment.userId, (pendingByUser.get(payment.userId) ?? 0) + total);
        }
    });

    return Array.from(userOrders.entries()).map(([userId, userOrdersList]) => {
        const due = userOrdersList.reduce((sum, order) => sum + formatMoney(order.amountDue), 0);
        const paid = paidByUser.get(userId) ?? 0;
        const pending = pendingByUser.get(userId) ?? 0;
        const user = userOrdersList.find((order) => order.user)?.user;

        return {
            userId,
            name: userName(user) || `Участник #${userId}`,
            ...extractParticipantCredentials(user),
            positions: userOrdersList.length,
            due,
            paid,
            pending,
            status: participantStatus(due, paid, pending),
        };
    });
}

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

function isGramProduct(product: ExportProduct | undefined): boolean {
    // unitsInPack теперь ожидает per-purchase поля (packAmount/Unit).
    // Для gram-проверки достаточно посмотреть product.unitCode (плоское каталожное поле).
    return product?.unitCode?.toLowerCase() === 'gram';
}

function isFullPackOrder(
    item: { packAmount?: unknown; packUnit?: string | null } | undefined,
    quantity: unknown,
): boolean {
    const qty = formatMoney(quantity);
    const pack = item ? unitsInPack(item) : null;
    return Boolean(pack && qty > 0 && Math.abs(qty - pack.size) < 1e-6);
}

/** Слева — не целая пачка; справа — ровно одна пачка поставщика (например 50 при фасовке 50 гр). */
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

function applyOrdersCellFill(cell: ExcelJS.Cell, fillArgb: string) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillArgb },
    };
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

/**
 * Возвращает [packPrice, price510, price1] для строки заказа.
 * Старая ценовая модель удалена — колонки возвращаются пустыми.
 */
function purchaseItemPriceCells(_purchaseItem: unknown) {
    return ['', '', ''] as const;
}

function groupOrdersByUser(orders: ExportOrder[]) {
    const map = new Map<number, ExportOrder[]>();
    orders.forEach((order) => {
        const list = map.get(order.userId) ?? [];
        list.push(order);
        map.set(order.userId, list);
    });
    return map;
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

function addParticipantOrdersTable(
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
        const [packPrice, price510, price1] = purchaseItemPriceCells(order.purchaseItem as never);
        const [partialQty, fullPackQty] = orderQuantitySplitColumns(order.purchaseItem, order.quantity);
        const amounts = orderAmountSplit(order.purchaseItem, order.amountDue, order.quantity);
        amountTotals.partial += amounts.partial;
        amountTotals.fullPack += amounts.fullPack;

        if (isGramProduct(product)) {
            const qty = formatMoney(order.quantity);
            if (isFullPackOrder(order.purchaseItem, order.quantity)) {
                gramTotals.fullPackGr += qty;
            } else if (qty > 0) {
                gramTotals.partialGr += qty;
            }
        }

        const row = sheet.addRow([
            '',
            product ? formatSupplierPackage(order.purchaseItem) : '',
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

export async function exportOrdersPurchaseData({ purchase, orders, payments, attributeTypes }: PurchaseExportData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zakupki';
    workbook.created = new Date();

    const productByItemId = buildProductByItemId(purchase);
    const sheet = workbook.addWorksheet('Заказы');
    const participants = buildParticipants(orders);
    const ordersByUser = groupOrdersByUser(orders);
    const paymentSummary = new Map(buildParticipantSummary(orders, payments).map((entry) => [entry.userId, entry]));

    participants.forEach((participant, index) => {
        if (index > 0) {
            sheet.addRow([]);
        }

        const userOrders = [...(ordersByUser.get(participant.userId) ?? [])].sort((a, b) => {
            const nameA = a.purchaseItem?.product?.name ?? '';
            const nameB = b.purchaseItem?.product?.name ?? '';
            return nameA.localeCompare(nameB, 'ru');
        });
        const payment = paymentSummary.get(participant.userId);
        const due = payment?.due ?? userOrders.reduce((sum, order) => sum + formatMoney(order.amountDue), 0);
        const paid = payment?.paid ?? 0;

        addParticipantOrdersTable(
            sheet,
            purchase.tag,
            index + 1,
            participant,
            userOrders,
            { due, paid },
            productByItemId,
            attributeTypes,
        );
    });

    sheet.getColumn(1).width = 40;
    sheet.getColumn(ORDERS_EXPORT_COL_PACK).width = 12;
    sheet.getColumn(ORDERS_EXPORT_COL_PRICE_PACK).width = 14;
    sheet.getColumn(ORDERS_EXPORT_COL_PRICE_510).width = 16;
    sheet.getColumn(ORDERS_EXPORT_COL_PRICE_1GR).width = 14;
    sheet.getColumn(ORDERS_EXPORT_COL_ORDER_PARTIAL).width = 10;
    sheet.getColumn(ORDERS_EXPORT_COL_ORDER_FULL_PACK).width = 12;

    await downloadWorkbook(workbook, safeFilename(purchase.tag, 'данные_заказов'));
}
