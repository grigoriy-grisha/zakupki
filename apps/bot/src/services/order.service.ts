import { OrderRepository } from '../domain/repositories/order.repository';
import { buildTelegramChannelPostUrl } from '../lib/telegram-channel-post-url';
import { PURCHASE_FULFILLMENT_LABELS, isPurchasePaymentOpen, type PurchaseFulfillmentStatus } from '@zakupki/types';

import type { PurchasePaymentInfo } from './payment.service';

type OrderLineWithRelations = Awaited<ReturnType<OrderRepository['findByUserAndPurchase']>>[number];

export type ActivePurchaseSummary = {
    purchaseId: number;
    tag: string;
    supplier: string | null;
    totalDue: number;
    itemCount: number;
    fulfillmentStatus: PurchaseFulfillmentStatus;
};

export type PurchaseOrderDetail = {
    purchaseId: number;
    purchaseOrderId: number | null;
    tag: string;
    supplier: string | null;
    lines: OrderLineWithRelations[];
    totalDue: number;
    payment: PurchasePaymentInfo | null;
};

const ACTIVE_STATUSES = new Set(['ACTIVE', 'SUPPLEMENT']);

function formatOrderLine(o: OrderLineWithRelations): string {
    const purchaseItem = o.purchaseItem;
    const product = purchaseItem?.product;
    const unit = product?.unit?.shortName ?? '';
    const qty = Number(o.quantity).toLocaleString('ru-RU');
    const amount = Number(o.amountDue).toLocaleString('ru-RU');
    const name = escapeHtml(product?.name ?? 'Товар');

    const postUrl = buildTelegramChannelPostUrl(purchaseItem?.tgChannelId, purchaseItem?.tgMessageId);
    const title = postUrl ? `<a href="${escapeHtmlAttr(postUrl)}">${name}</a>` : `<b>${name}</b>`;

    const qtyLine = `${qty}${unit ? ` ${escapeHtml(unit)}` : ''} · ${amount} ₽`;

    return `▫️ ${title}\n<code>${qtyLine}</code>`;
}

export class OrderService {
    private repo = new OrderRepository();

    async getActivePurchases(userId: number): Promise<ActivePurchaseSummary[]> {
        const orders = await this.repo.findActiveOrdersByUserId(userId);
        const map = new Map<number, ActivePurchaseSummary>();

        for (const line of orders) {
            const purchase = line.purchaseItem?.purchase;
            if (!purchase || !ACTIVE_STATUSES.has(purchase.status)) continue;

            const existing = map.get(purchase.id) ?? {
                purchaseId: purchase.id,
                tag: purchase.tag,
                supplier: purchase.supplier,
                totalDue: 0,
                itemCount: 0,
                fulfillmentStatus: purchase.fulfillmentStatus as PurchaseFulfillmentStatus,
            };
            existing.totalDue += Number(line.amountDue);
            existing.itemCount += 1;
            map.set(purchase.id, existing);
        }

        return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
    }

    async getPurchaseOrderDetail(userId: number, purchaseId: number): Promise<PurchaseOrderDetail | null> {
        const lines = await this.repo.findByUserAndPurchase(userId, purchaseId);
        if (lines.length === 0) return null;

        const purchase = lines[0]?.purchaseItem?.purchase;
        if (!purchase) return null;

        const sorted = [...lines].sort((a, b) => {
            const nameA = a.purchaseItem?.product?.name ?? '';
            const nameB = b.purchaseItem?.product?.name ?? '';
            return nameA.localeCompare(nameB, 'ru');
        });

        const totalDue = sorted.reduce((s, o) => s + Number(o.amountDue), 0);
        const purchaseOrder = await this.repo.findPurchaseOrder(userId, purchaseId);

        return {
            purchaseId: purchase.id,
            purchaseOrderId: purchaseOrder?.id ?? null,
            tag: purchase.tag,
            supplier: purchase.supplier,
            lines: sorted,
            totalDue,
            payment: null,
        };
    }

    formatPurchaseListMessage(purchases: ActivePurchaseSummary[]): string {
        if (purchases.length === 0) {
            return 'У вас нет заказов в активных закупках.';
        }

        const lines = purchases.map((p) => {
            const statusLabel = PURCHASE_FULFILLMENT_LABELS[p.fulfillmentStatus];
            return `• <b>${escapeHtml(p.tag)}</b>\n  ${escapeHtml(statusLabel)} · ${p.totalDue.toLocaleString('ru-RU')} ₽`;
        });

        return `${lines.join('\n\n')}\n\nВыберите закупку:`;
    }

    formatPurchaseDetailMessage(
        detail: PurchaseOrderDetail,
        payment: PurchasePaymentInfo | null,
        fulfillmentStatus?: PurchaseFulfillmentStatus | null,
    ): string {
        const lineTexts = detail.lines.map(formatOrderLine);
        const status = fulfillmentStatus ?? 'COLLECTION';
        const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[status];
        const parts = [
            detail.purchaseOrderId != null ? `📦 Заказ №${detail.purchaseOrderId}` : null,
            `🛒 <b>${escapeHtml(detail.tag)}</b>`,
            `📋 Статус: ${escapeHtml(fulfillmentLabel)}`,
            detail.supplier ? `Поставщик: ${escapeHtml(detail.supplier)}` : null,
            '',
            lineTexts.join('\n\n'),
            '',
            `💰 <b>Итого: ${detail.totalDue.toLocaleString('ru-RU')} ₽</b>`,
        ];

        if (payment) {
            if (payment.paid > 0) {
                parts.push(`✅ Учтено оплат: ${payment.paid.toLocaleString('ru-RU')} ₽`);
            }
            if (payment.hasPending) {
                parts.push('⏳ Есть оплата на проверке');
            } else if (!isPurchasePaymentOpen(status) && payment.remaining > 0) {
                parts.push('❌ Пока нельзя оплатить заказ');
                parts.push('⏳ Ждём начала оплаты — следите за статусом выше');
            } else if (payment.remaining > 0) {
                parts.push(`📌 К оплате: ${payment.remaining.toLocaleString('ru-RU')} ₽`);
            } else if (payment.due > 0) {
                parts.push('✅ Оплачено');
            }
        }

        return parts.filter((p) => p !== null).join('\n');
    }
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttr(text: string): string {
    return escapeHtml(text).replace(/"/g, '&quot;');
}
