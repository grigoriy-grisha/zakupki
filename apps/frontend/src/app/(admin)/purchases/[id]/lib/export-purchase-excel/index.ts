import ExcelJS from 'exceljs';

import { downloadWorkbook, formatMoney, safeFilename } from './excel-basics';
import { addParticipantOrdersTable } from './orders-sheet';
import { buildParticipants, buildParticipantSummary, groupOrdersByUser } from './participants';
import type { ExportPurchase, PurchaseExportData } from './types';

export type { PurchaseExportData } from './types';

function buildProductByItemId(purchase: ExportPurchase) {
    return new Map(purchase.items.map((item) => [item.id, item.product]));
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
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 10;
    sheet.getColumn(7).width = 12;

    await downloadWorkbook(workbook, safeFilename(purchase.tag, 'данные_заказов'));
}
