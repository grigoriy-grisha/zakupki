import type { PurchaseItem } from '@zakupki/types';
import { mapToPurchaseItem } from '@zakupki/types';
import ExcelJS from 'exceljs';

import { downloadWorkbook, safeFilename } from './excel-basics';
import { addParticipantOrdersTable } from './orders-sheet';
import { buildParticipants, buildParticipantSummary, groupOrdersByUser } from './participants';
import type { ExportPricingSettings, ExportPurchase, PurchaseExportData } from './types';

export type { PurchaseExportData } from './types';

function buildProductByItemId(purchase: ExportPurchase) {
    return new Map(purchase.items.map((item) => [item.id, item.product]));
}

function buildDomainItemByItemId(purchase: ExportPurchase, pricing: ExportPricingSettings) {
    const pricingContext = {
        orgFeeDefaultPercent: pricing.orgFeeDefaultPercent,
        deliveryPercent: Number(purchase.deliveryPercent ?? 0) || 0,
        currencyRates: (purchase.currencyRates ?? []).map((rate) => ({
            currencyId: rate.currencyId,
            rateToRub: Number(rate.rateToRub),
        })),
    };
    return new Map<number, PurchaseItem>(
        purchase.items.map((item) => [
            item.id,
            mapToPurchaseItem(
                { ...item, purchase: { fulfillmentStatus: purchase.fulfillmentStatus } },
                pricing.beadPackPriceDiscountPercent,
                pricingContext,
            ),
        ]),
    );
}

export async function exportOrdersPurchaseData({
    purchase,
    orders,
    payments,
    purchaseOrders,
    attributeTypes,
    pricing,
}: PurchaseExportData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zakupki';
    workbook.created = new Date();

    const productByItemId = buildProductByItemId(purchase);
    const itemByItemId = buildDomainItemByItemId(purchase, pricing);
    const sheet = workbook.addWorksheet('Заказы');
    sheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };

    const participants = buildParticipants(orders, purchaseOrders);
    const ordersByUser = groupOrdersByUser(orders);
    const paymentSummary = new Map(
        buildParticipantSummary(participants, orders, payments).map((entry) => [entry.userId, entry]),
    );

    participants.forEach((participant, index) => {
        if (index > 0) {
            sheet.addRow([]);
        }

        const userOrders = [...(ordersByUser.get(participant.userId) ?? [])].sort((a, b) => {
            const nameA = a.purchaseItem?.product?.name ?? productByItemId.get(a.purchaseItem?.id ?? -1)?.name ?? '';
            const nameB = b.purchaseItem?.product?.name ?? productByItemId.get(b.purchaseItem?.id ?? -1)?.name ?? '';
            return nameA.localeCompare(nameB, 'ru');
        });
        const payment = paymentSummary.get(participant.userId);

        addParticipantOrdersTable(
            sheet,
            purchase.tag,
            index + 1,
            participant,
            userOrders,
            {
                due: payment?.due ?? 0,
                paid: payment?.paid ?? 0,
                pending: payment?.pending ?? 0,
            },
            productByItemId,
            itemByItemId,
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
