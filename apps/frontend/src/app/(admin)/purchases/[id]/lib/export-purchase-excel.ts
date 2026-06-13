import ExcelJS from 'exceljs';
import { computeRawPool, getStageStrategy, parsePriceTiers, toOrderLinesVO, type PriceTier } from '@zakupki/types';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';

import { formatPurchaseProductLabel, type AttributeTypeMeta, type ProductLabelSource } from '../../../products/lib';
import { paymentTotal } from '../../lib/utils';
import { formatOrderStatValue, getPurchaseItemOrderStats, unitsInPack } from './purchase-item-order-stats';

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

type ExportProduct = ProductLabelSource & {
    pricePerUnit: unknown;
    priceTiers?: unknown;
    minPackageAmount?: unknown;
    minPackageUnit?: string | null;
    supplierPackageAmount?: unknown;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: unknown;
    referenceStock?: unknown;
    referenceStockUnit?: string | null;
    unit?: { shortName: string } | null;
};

type ExportPurchase = {
    tag: string;
    supplier: string;
    status: string;
    fulfillmentStatus?: string | null;
    minAmount: unknown;
    deadline: string | Date;
    items: {
        id: number;
        priceOverride?: unknown;
        publicationState: 'DRAFT' | 'PUBLISHED';
        tgMessageId?: string | null;
        targetRemainder?: unknown;
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
        priceOverride?: unknown;
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

function tierPrice(tiers: PriceTier[], amount: number): number | null {
    const tier = tiers.find((entry) => Math.abs(entry.amount - amount) < 1e-6);
    return tier ? tier.price : null;
}

function formatPrice510(tiers: PriceTier[]) {
    const price5 = tierPrice(tiers, 5);
    const price10 = tierPrice(tiers, 10);
    if (price5 != null && price10 != null) return `${price5} / ${price10}`;
    if (price5 != null) return String(price5);
    if (price10 != null) return String(price10);
    return '';
}

function formatPrice1Gr(product: ExportProduct, tiers: PriceTier[]) {
    const tier1 = tierPrice(tiers, 1);
    if (tier1 != null) return tier1;
    return formatMoney(product.pricePerUnit) || '';
}

function formatSupplierPackage(product: ExportProduct) {
    if (product.supplierPackageAmount == null) return '';
    const amount = Number(product.supplierPackageAmount);
    const unit = product.supplierPackageUnit?.trim();
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

const GENERAL_EXPORT_FIXED_COLUMNS = 5;
const GENERAL_EXPORT_SUMMARY_COLUMNS = 6;
const GENERAL_EXPORT_LABEL_START = 3;
const GENERAL_EXPORT_LABEL_END = 5;

const GENERAL_EXPORT_FILL = {
    purchaseTag: 'FFFFC9CD',
    participantNumber: 'FF92D050',
    priceHeader: 'FF00B0F0',
    productRow: 'FF00FF00',
    sumBeads: 'FFFFE0B2',
    balance: 'FFFFCDD2',
    paid: 'FF92D050',
} as const;

const GENERAL_EXPORT_PARTICIPANT_FILLS = ['FFFFFF00', 'FF92D050', 'FFFFC9CD'] as const;

const GENERAL_EXPORT_PRICE_HEADERS = [
    'цена за пачку в рублях',
    'цена за 5/10 гр. в рублях',
    'цена за 1 гр. в рублях',
] as const;

const GENERAL_EXPORT_SUMMARY_HEADERS = [
    'НАБРАНО, гр',
    'грамм в пачке',
    'кол-во пачек к заказу',
    'заказано пачек',
    'заказано грамм',
    'Свободный остаток',
] as const;

function applyGeneralSheetColumnWidths(
    sheet: ExcelJS.Worksheet,
    options: {
        participantCount: number;
        maxNameLineLength: number;
        headerRowNumber: number;
    },
) {
    const { participantCount, maxNameLineLength, headerRowNumber } = options;
    const fixedColumns = GENERAL_EXPORT_FIXED_COLUMNS;
    const summaryColumns = GENERAL_EXPORT_SUMMARY_COLUMNS;
    const summaryStart = fixedColumns + participantCount + 1;
    const narrowWidth = 11;
    const fixedWidths: Record<number, number> = {
        2: 12,
        3: 14,
        4: 16,
        5: 14,
    };

    sheet.getColumn(1).width = Math.min(Math.max(maxNameLineLength + 2, 28), 55);

    for (let col = 2; col <= fixedColumns; col++) {
        sheet.getColumn(col).width = fixedWidths[col] ?? narrowWidth;
    }

    const headerRow = sheet.getRow(headerRowNumber);
    for (let col = fixedColumns + 1; col <= fixedColumns + participantCount; col++) {
        sheet.getColumn(col).width = 18;
        headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    for (let col = summaryStart; col < summaryStart + summaryColumns; col++) {
        sheet.getColumn(col).width = narrowWidth;
        headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
}

function participantGramTotals(
    orders: ExportOrder[],
    participants: ExportParticipant[],
    productByItemId: Map<number, ExportProduct>,
) {
    const totals = new Map<number, number>();
    participants.forEach((participant) => totals.set(participant.userId, 0));

    orders.forEach((order) => {
        const product =
            (order.purchaseItem?.id != null ? productByItemId.get(order.purchaseItem.id) : undefined) ??
            order.purchaseItem?.product;
        if (!isGramProduct(product)) return;

        const qty = formatMoney(order.quantity);
        if (qty <= 0) return;
        totals.set(order.userId, (totals.get(order.userId) ?? 0) + qty);
    });

    return participants.map((participant) => totals.get(participant.userId) ?? 0);
}

function addGeneralFooterRow(
    sheet: ExcelJS.Worksheet,
    label: string,
    participantValues: (number | string)[],
    participantCount: number,
    fillArgb?: string,
) {
    const summaryColumns = GENERAL_EXPORT_SUMMARY_COLUMNS;
    const fixedColumns = GENERAL_EXPORT_FIXED_COLUMNS;
    const row = sheet.addRow(['', '', label, '', '', ...participantValues, ...Array(summaryColumns).fill('')]);

    sheet.mergeCells(row.number, GENERAL_EXPORT_LABEL_START, row.number, GENERAL_EXPORT_LABEL_END);

    const fill = fillArgb
        ? {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: fillArgb },
          }
        : undefined;

    const totalColumns = fixedColumns + participantCount + summaryColumns;
    for (let col = GENERAL_EXPORT_LABEL_START; col <= totalColumns; col++) {
        const cell = row.getCell(col);
        if (fill) cell.fill = fill;
        if (col <= GENERAL_EXPORT_LABEL_END) {
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', wrapText: true };
        } else if (col <= fixedColumns + participantCount) {
            styleNumericCell(cell);
            if (fill) cell.fill = fill;
        }
    }
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

function participantPaymentTotals(orders: ExportOrder[], payments: ExportPayment[], participants: ExportParticipant[]) {
    const summary = new Map(buildParticipantSummary(orders, payments).map((entry) => [entry.userId, entry]));

    return participants.map((participant) => {
        const entry = summary.get(participant.userId);
        const due = entry?.due ?? 0;
        const paid = entry?.paid ?? 0;

        return {
            due: due || '',
            balance: due > 0 || paid > 0 ? Math.max(0, due - paid) : '',
            paid: paid || '',
        };
    });
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

export async function exportGeneralPurchaseData({ purchase, orders, payments, attributeTypes }: PurchaseExportData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zakupki';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Общие данные');
    const participants = buildParticipants(orders);
    const productByItemId = buildProductByItemId(purchase);
    const fixedColumns = GENERAL_EXPORT_FIXED_COLUMNS;
    const summaryColumns = GENERAL_EXPORT_SUMMARY_COLUMNS;
    const participantCount = participants.length;
    const summaryStartCol = fixedColumns + participantCount + 1;
    const totalColumns = fixedColumns + participantCount + summaryColumns;

    const metaRow = sheet.addRow([
        '',
        purchase.tag,
        'НОМЕР УЧАСТНИКА',
        '',
        '',
        ...participants.map((_, index) => index + 1),
        ...Array(summaryColumns).fill(''),
    ]);
    sheet.mergeCells(metaRow.number, GENERAL_EXPORT_LABEL_START, metaRow.number, GENERAL_EXPORT_LABEL_END);
    applyOrdersCellFill(metaRow.getCell(2), GENERAL_EXPORT_FILL.purchaseTag);
    metaRow.getCell(2).font = { bold: true };
    metaRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    const participantLabelCell = metaRow.getCell(GENERAL_EXPORT_LABEL_START);
    participantLabelCell.font = { bold: true };
    participantLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = fixedColumns + 1; col <= fixedColumns + participantCount; col++) {
        const cell = metaRow.getCell(col);
        applyOrdersCellFill(cell, GENERAL_EXPORT_FILL.participantNumber);
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        styleNumericCell(cell);
    }

    const headerRow = sheet.addRow([
        '',
        'Фасовка поставщика, гр',
        ...GENERAL_EXPORT_PRICE_HEADERS,
        ...participants.map(() => ''),
        ...GENERAL_EXPORT_SUMMARY_HEADERS,
    ]);
    participants.forEach((participant, index) => {
        const cell = headerRow.getCell(fixedColumns + 1 + index);
        cell.value = participantBlockTitle(participant);
        applyOrdersCellFill(cell, GENERAL_EXPORT_PARTICIPANT_FILLS[index % GENERAL_EXPORT_PARTICIPANT_FILLS.length]);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    for (let col = GENERAL_EXPORT_LABEL_START; col <= GENERAL_EXPORT_LABEL_END; col++) {
        const cell = headerRow.getCell(col);
        styleHeaderCell(cell);
        applyOrdersCellFill(cell, GENERAL_EXPORT_FILL.priceHeader);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    const packHeaderCell = headerRow.getCell(2);
    styleHeaderCell(packHeaderCell);
    packHeaderCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    for (let col = summaryStartCol; col <= totalColumns; col++) {
        styleHeaderCell(headerRow.getCell(col));
    }

    let maxNameLineLength = 0;
    let grandCollected = 0;
    let grandPacksToOrder = 0;
    let grandOrderedPacks = 0;
    let grandOrderedGrams = 0;

    purchase.items.forEach((item) => {
        const product = item.product;
        const { line1 } = excelProductNameLines(product, attributeTypes);
        maxNameLineLength = Math.max(maxNameLineLength, line1.length);
        const tiers = parsePriceTiers(product.priceTiers);
        const stats = getPurchaseItemOrderStats(item);
        grandCollected += stats.totalQuantity;
        grandPacksToOrder += stats.packsToOrder ?? 0;
        grandOrderedPacks += stats.orderedPacks ?? 0;
        grandOrderedGrams += stats.orderedQuantity ?? 0;

        const quantitiesByUser = new Map<number, number>();
        item.orderLines.forEach((line) => {
            quantitiesByUser.set(line.userId, formatMoney(line.quantity));
        });

        // Пул добора — через доменную стратегию (REORDER: baseQuantity-based, PAYMENT+: createdOnStage-based)
        const strategy = getStageStrategy(
            (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus,
        );
        const aggregation = strategy.aggregateForPool(toOrderLinesVO(item.orderLines as any[]));
        const packSize = product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;
        const displayedRemainder = computeRawPool({
            targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
            packSize,
            aggregation,
        });

        const row = sheet.addRow([
            '',
            formatSupplierPackage(product),
            product.supplierPackagePrice != null ? formatMoney(product.supplierPackagePrice) : '',
            formatPrice510(tiers),
            formatPrice1Gr(product, tiers),
            ...participants.map((participant) => quantitiesByUser.get(participant.userId) ?? ''),
            stats.totalQuantity || '',
            stats.packSize ?? '',
            stats.packsToOrder ?? '',
            stats.orderedPacks ?? '',
            stats.orderedQuantity ?? '',
            // «Свободный остаток» — 6-я колонка summary:
            // null = без лимита (нет ни targetRemainder, ни packSize), выводим пусто.
            displayedRemainder != null ? formatOrderStatValue(displayedRemainder) : '',
        ]);
        for (let col = 1; col <= totalColumns; col++) {
            applyOrdersCellFill(row.getCell(col), GENERAL_EXPORT_FILL.productRow);
        }
        for (let col = 1; col <= fixedColumns; col++) {
            styleFixedColumnCell(row.getCell(col), col);
        }
        for (let col = fixedColumns + 1; col <= totalColumns; col++) {
            styleNumericCell(row.getCell(col));
        }
        setExcelProductNameCell(row.getCell(1), product, attributeTypes);
    });

    const summaryCollectedCol = summaryStartCol;

    const totalsRow = sheet.addRow([
        '',
        '',
        '',
        '',
        '',
        ...Array(participantCount).fill(''),
        grandCollected || '',
        '',
        '',
        '',
        '',
    ]);
    const collectedTotalCell = totalsRow.getCell(summaryCollectedCol);
    collectedTotalCell.font = { bold: true };
    styleNumericCell(collectedTotalCell);

    const gramTotals = participantGramTotals(orders, participants, productByItemId);
    const paymentTotals = participantPaymentTotals(orders, payments, participants);

    addGeneralFooterRow(
        sheet,
        'грамм всего',
        gramTotals.map((value) => value || ''),
        participantCount,
    );
    addGeneralFooterRow(
        sheet,
        'Сумма за бисер, руб',
        paymentTotals.map((entry) => entry.due),
        participantCount,
        GENERAL_EXPORT_FILL.sumBeads,
    );
    addGeneralFooterRow(
        sheet,
        'ОСТАТОК К ОПЛАТЕ, руб',
        paymentTotals.map((entry) => entry.balance),
        participantCount,
        GENERAL_EXPORT_FILL.balance,
    );
    addGeneralFooterRow(
        sheet,
        'ОПЛАЧЕНО',
        paymentTotals.map((entry) => entry.paid),
        participantCount,
        GENERAL_EXPORT_FILL.paid,
    );

    const verifyRow = sheet.addRow([
        'Проверка:',
        '',
        '',
        '',
        '',
        ...Array(participantCount).fill(''),
        grandCollected || '',
        '',
        grandPacksToOrder || '',
        grandOrderedPacks || '',
        grandOrderedGrams || '',
        '',
    ]);
    verifyRow.getCell(1).font = { bold: true };

    const footerEndRow = sheet.rowCount;
    applySheetBorders(sheet, metaRow.number, footerEndRow, 1, totalColumns);

    sheet.views = [{ state: 'frozen', xSplit: fixedColumns, ySplit: 2 }];
    applyGeneralSheetColumnWidths(sheet, {
        participantCount,
        maxNameLineLength,
        headerRowNumber: headerRow.number,
    });

    await downloadWorkbook(workbook, safeFilename(purchase.tag, 'общие_данные'));
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
    const pack = product ? unitsInPack(product) : null;
    if (pack?.unit === 'гр') return true;
    const short = product?.unit?.shortName?.trim().toLowerCase().replace(/\./g, '') ?? '';
    return short === 'гр' || short === 'g';
}

function isFullPackOrder(product: ExportProduct | undefined, quantity: unknown): boolean {
    const qty = formatMoney(quantity);
    const pack = product ? unitsInPack(product) : null;
    return Boolean(pack && qty > 0 && Math.abs(qty - pack.size) < 1e-6);
}

/** Слева — не целая пачка; справа — ровно одна пачка поставщика (например 50 при фасовке 50 гр). */
function orderQuantitySplitColumns(product: ExportProduct | undefined, quantity: unknown): [string, string] {
    const qty = formatMoney(quantity);
    if (!qty) return ['', ''];

    if (isFullPackOrder(product, quantity)) {
        return ['', String(qty)];
    }

    return [String(qty), ''];
}

function orderAmountSplit(product: ExportProduct | undefined, amountDue: unknown, quantity: unknown) {
    const amount = formatMoney(amountDue);
    if (isFullPackOrder(product, quantity)) {
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

function productPriceCells(product: ExportProduct | undefined) {
    if (!product) {
        return ['', '', ''] as const;
    }
    const tiers = parsePriceTiers(product.priceTiers);
    return [
        product.supplierPackagePrice != null ? formatMoney(product.supplierPackagePrice) : '',
        formatPrice510(tiers),
        formatPrice1Gr(product, tiers),
    ] as const;
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
        const [packPrice, price510, price1] = productPriceCells(product);
        const [partialQty, fullPackQty] = orderQuantitySplitColumns(product, order.quantity);
        const amounts = orderAmountSplit(product, order.amountDue, order.quantity);
        amountTotals.partial += amounts.partial;
        amountTotals.fullPack += amounts.fullPack;

        if (isGramProduct(product)) {
            const qty = formatMoney(order.quantity);
            if (isFullPackOrder(product, order.quantity)) {
                gramTotals.fullPackGr += qty;
            } else if (qty > 0) {
                gramTotals.partialGr += qty;
            }
        }

        const row = sheet.addRow([
            '',
            product ? formatSupplierPackage(product) : '',
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
