import ExcelJS from 'exceljs';
import { parsePriceTiers, type PriceTier } from '@zakupki/types';

import {
    formatPurchaseProductLabel,
    type AttributeTypeMeta,
    type ProductLabelSource,
} from '../../../products/lib';
import { paymentTotal } from '../../lib/utils';
import {
    getPurchaseItemOrderStats,
} from './purchase-item-order-stats';

type ExportUser = {
    firstName: string;
    lastName?: string | null;
    username?: string | null;
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
    availableAmount?: unknown;
    availableUnit?: string | null;
    unit?: { shortName: string } | null;
};

type ExportPurchase = {
    tag: string;
    supplier: string;
    status: string;
    minAmount: unknown;
    deadline: string | Date;
    items: {
        id: number;
        priceOverride?: unknown;
        shouldPublish: boolean;
        tgMessageId?: string | null;
        availableQty?: unknown;
        product: ExportProduct;
        orderLines: { userId: number; quantity: unknown; amountDue: unknown; user?: ExportUser }[];
    }[];
};

type ExportOrder = {
    id: number;
    userId: number;
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
    paidAt: string | Date;
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
    if (product.supplierPackageAmount == null || !product.supplierPackageUnit) return '';
    return `${Number(product.supplierPackageAmount)} ${product.supplierPackageUnit}`;
}

function freeRemainder(item: ExportPurchase['items'][number]) {
    const stats = getPurchaseItemOrderStats(item);
    return stats.freeRemainder ?? '';
}

type ExportParticipant = {
    userId: number;
    name: string;
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
            name: userName(order.user) || `Участник #${order.userId}`,
            ...extractParticipantCredentials(order.user),
        });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function participantHeaderLabel(participant: ExportParticipant) {
    const lines = [participant.name];
    if (participant.tgUsername) {
        lines.push(`@${participant.tgUsername}`);
    }
    if (participant.telegramId) {
        lines.push(`TG ID: ${participant.telegramId}`);
    }
    if (participant.vkId) {
        lines.push(`VK ID: ${participant.vkId}`);
    }
    return lines.join('\n');
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

function styleFixedColumnCell(cell: ExcelJS.Cell, columnIndex: number) {
    cell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: columnIndex === 1,
    };
}

function styleHeaderCell(cell: ExcelJS.Cell) {
    cell.font = { bold: true };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
    };
}

function styleHeaderRow(row: ExcelJS.Row) {
    row.eachCell((cell) => styleHeaderCell(cell));
}

function addDataSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: unknown[][]) {
    const sheet = workbook.addWorksheet(name);
    styleHeaderRow(sheet.addRow(headers));
    rows.forEach((row) => sheet.addRow(row));
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

function applyGeneralSheetColumnWidths(
    sheet: ExcelJS.Worksheet,
    options: {
        fixedColumns: number;
        participantCount: number;
        summaryColumns: number;
        maxNameLineLength: number;
    },
) {
    const { fixedColumns, participantCount, summaryColumns, maxNameLineLength } = options;
    const summaryStart = fixedColumns + participantCount + 1;
    const narrowWidth = 10;
    const fixedWidths: Record<number, number> = {
        2: 12,
        3: 11,
        4: 12,
        5: 10,
    };

    sheet.getColumn(1).width = Math.min(Math.max(maxNameLineLength + 2, 28), 55);

    for (let col = 2; col <= fixedColumns; col++) {
        sheet.getColumn(col).width = fixedWidths[col] ?? narrowWidth;
    }

    const headerRow = sheet.getRow(2);
    for (let col = 1; col <= fixedColumns; col++) {
        headerRow.getCell(col).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    }

    for (let col = fixedColumns + 1; col <= fixedColumns + participantCount; col++) {
        const label = String(headerRow.getCell(col).value ?? '');
        const maxLine = Math.max(...label.split('\n').map((line) => line.length), 8);
        sheet.getColumn(col).width = Math.min(Math.max(maxLine + 2, 14), 32);
        headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    for (let col = summaryStart; col < summaryStart + summaryColumns; col++) {
        sheet.getColumn(col).width = narrowWidth;
        headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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

function addFooterRow(
    sheet: ExcelJS.Worksheet,
    label: string,
    participantValues: (number | string)[],
    fixedColumns: number,
    summaryColumns: number,
) {
    const row = sheet.addRow([
        label,
        ...Array(fixedColumns - 1).fill(''),
        ...participantValues,
        ...Array(summaryColumns).fill(''),
    ]);

    if (fixedColumns > 1) {
        sheet.mergeCells(row.number, 1, row.number, fixedColumns);
    }

    const labelCell = row.getCell(1);
    labelCell.font = { bold: true };
    labelCell.alignment = { vertical: 'middle', wrapText: true };

    participantValues.forEach((_, index) => {
        const cell = row.getCell(fixedColumns + 1 + index);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    return row;
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

export async function exportGeneralPurchaseData({
    purchase,
    orders,
    payments,
    attributeTypes,
}: PurchaseExportData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zakupki';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Общие данные');
    const participants = buildParticipants(orders);
    const fixedColumns = 5;
    const summaryColumns = 6;
    const summaryHeaders = [
        'НАБРАНО, гр',
        'грамм в пачке',
        'кол-во пачек к заказу',
        'заказано пачек',
        'заказано грамм',
        'Свободный остаток',
    ];
    const fixedHeaders = [
        'Название товара',
        'Фасовка поставщика',
        'Цена за пачку в рублях',
        'Цена за 5/10 гр. в рублях',
        'Цена за 1 гр/шт в рублях',
    ];

    const numberRow = sheet.addRow([
        ...Array(fixedColumns).fill(''),
        ...participants.map((_, index) => index + 1),
        ...Array(summaryColumns).fill(''),
    ]);
    const headerRow = sheet.addRow([
        ...fixedHeaders,
        ...participants.map(participantHeaderLabel),
        ...summaryHeaders,
    ]);

    numberRow.eachCell((cell, colNumber) => {
        if (colNumber > fixedColumns && colNumber <= fixedColumns + participants.length) {
            styleHeaderCell(cell);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
    });
    headerRow.eachCell((cell, colNumber) => {
        styleHeaderCell(cell);
        cell.alignment = {
            horizontal: colNumber <= fixedColumns ? 'left' : 'center',
            vertical: 'middle',
            wrapText: colNumber > fixedColumns && colNumber <= fixedColumns + participants.length,
        };
    });

    let maxNameLineLength = 0;

    purchase.items.forEach((item) => {
        const product = item.product;
        const { line1 } = excelProductNameLines(product, attributeTypes);
        maxNameLineLength = Math.max(maxNameLineLength, line1.length);
        const tiers = parsePriceTiers(product.priceTiers);
        const stats = getPurchaseItemOrderStats(item);
        const packGrams = stats.packGrams;
        const totalGrams = stats.totalGrams;
        const packsToOrder = stats.packsToOrder ?? '';
        const orderedPacks = stats.orderedPacks ?? '';

        const quantitiesByUser = new Map<number, number>();
        item.orderLines.forEach((line) => {
            quantitiesByUser.set(line.userId, formatMoney(line.quantity));
        });

        const row = sheet.addRow([
            '',
            formatSupplierPackage(product),
            product.supplierPackagePrice != null ? formatMoney(product.supplierPackagePrice) : '',
            formatPrice510(tiers),
            formatPrice1Gr(product, tiers),
            ...participants.map((participant) => quantitiesByUser.get(participant.userId) ?? ''),
            totalGrams || '',
            packGrams ?? '',
            packsToOrder,
            orderedPacks,
            totalGrams || '',
            freeRemainder(item),
        ]);
        for (let col = 1; col <= fixedColumns; col++) {
            styleFixedColumnCell(row.getCell(col), col);
        }
        setExcelProductNameCell(row.getCell(1), product, attributeTypes);
    });

    const paymentTotals = participantPaymentTotals(orders, payments, participants);

    sheet.addRow([]);
    addFooterRow(
        sheet,
        'Сумма за бисер, руб',
        paymentTotals.map((entry) => entry.due),
        fixedColumns,
        summaryColumns,
    );
    addFooterRow(
        sheet,
        'ОСТАТОК К ОПЛАТЕ, руб',
        paymentTotals.map((entry) => entry.balance),
        fixedColumns,
        summaryColumns,
    );
    addFooterRow(
        sheet,
        'ОПЛАЧЕНО',
        paymentTotals.map((entry) => entry.paid),
        fixedColumns,
        summaryColumns,
    );

    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    applyGeneralSheetColumnWidths(sheet, {
        fixedColumns,
        participantCount: participants.length,
        summaryColumns,
        maxNameLineLength,
    });

    await downloadWorkbook(workbook, safeFilename(purchase.tag, 'общие_данные'));
}

export async function exportOrdersPurchaseData({
    purchase,
    orders,
    payments,
    attributeTypes,
}: PurchaseExportData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zakupki';
    workbook.created = new Date();
    const productByItemId = buildProductByItemId(purchase);

    const ordersSheet = workbook.addWorksheet('Заказы');
    styleHeaderRow(ordersSheet.addRow(['Участник', 'ID в TG', 'TG ID', 'VK ID', 'Товар', 'Ед. изм.', 'Кол-во', 'Цена/ед', 'Сумма']));
    orders.forEach((order) => {
        const product =
            (order.purchaseItem?.id != null ? productByItemId.get(order.purchaseItem.id) : undefined) ??
            order.purchaseItem?.product;
        const unit = product?.unit?.shortName ?? '';
        const price = formatMoney(order.purchaseItem?.priceOverride ?? product?.pricePerUnit ?? 0);
        const credentials = extractParticipantCredentials(order.user);
        const row = ordersSheet.addRow([
            userName(order.user),
            credentials.tgUsername ? `@${credentials.tgUsername}` : '',
            credentials.telegramId,
            credentials.vkId,
            '',
            unit,
            formatMoney(order.quantity),
            price,
            formatMoney(order.amountDue),
        ]);
        setExcelProductNameCell(row.getCell(5), product, attributeTypes);
    });
    autoFitColumns(ordersSheet);
    ordersSheet.getColumn(5).width = Math.max(ordersSheet.getColumn(5).width ?? 10, 28);

    const byProduct = new Map<
        number,
        {
            product?: ExportProduct;
            unit: string;
            qty: number;
            amount: number;
            orders: number;
            participants: Set<number>;
        }
    >();
    orders.forEach((order) => {
        const itemId = order.purchaseItem?.id;
        if (itemId == null) return;

        const product =
            productByItemId.get(itemId) ?? order.purchaseItem?.product;
        const unit = product?.unit?.shortName ?? '';
        const current = byProduct.get(itemId) ?? {
            product,
            unit,
            qty: 0,
            amount: 0,
            orders: 0,
            participants: new Set<number>(),
        };
        current.qty += formatMoney(order.quantity);
        current.amount += formatMoney(order.amountDue);
        current.orders += 1;
        current.participants.add(order.userId);
        byProduct.set(itemId, current);
    });

    const byProductsSheet = workbook.addWorksheet('По товарам');
    styleHeaderRow(
        byProductsSheet.addRow(['Товар', 'Ед. изм.', 'Строк заказов', 'Участников', 'Кол-во всего', 'Сумма']),
    );
    byProduct.forEach((stats) => {
        const row = byProductsSheet.addRow([
            '',
            stats.unit,
            stats.orders,
            stats.participants.size,
            stats.qty,
            stats.amount,
        ]);
        setExcelProductNameCell(row.getCell(1), stats.product, attributeTypes);
    });
    autoFitColumns(byProductsSheet);
    byProductsSheet.getColumn(1).width = Math.max(byProductsSheet.getColumn(1).width ?? 10, 28);

    const participants = buildParticipantSummary(orders, payments);
    addDataSheet(
        workbook,
        'По участникам',
        ['Участник', 'ID в TG', 'TG ID', 'VK ID', 'Позиций', 'К оплате', 'Покрыто', 'Остаток', 'Статус'],
        participants.map((participant) => [
            participant.name,
            participant.tgUsername ? `@${participant.tgUsername}` : '',
            participant.telegramId,
            participant.vkId,
            participant.positions,
            participant.due,
            participant.paid,
            participant.due - participant.paid,
            participant.status,
        ]),
    );

    await downloadWorkbook(workbook, safeFilename(purchase.tag, 'данные_заказов'));
}
