import { InlineKeyboard } from 'grammy';
import { isPurchasePaymentOpen } from '@zakupki/types';

import type { CustomContext } from '../../domain/types';
import { formatPurchaseButtonLabel } from '../../lib/purchase-button-label';
import { escapeHtml } from '../../lib/html';
import type { CommandHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';
import type { BotPurchaseListItem } from '../../services/bot/bot-order.service';

function buildPurchasesKeyboard(purchases: BotPurchaseListItem[]) {
    const keyboard = new InlineKeyboard();
    for (const p of purchases) {
        const label = formatPurchaseButtonLabel(p.tag, p.fulfillmentStatus);
        keyboard.text(label, `orders:pick:${p.purchaseId}`).row();
    }
    return keyboard;
}

function formatPurchasesList(purchases: BotPurchaseListItem[]): string {
    if (purchases.length === 0) {
        return 'У вас нет заказов в активных закупках.';
    }
    const lines = purchases.map((p) => {
        const statusLabel = p.fulfillmentStatus ?? 'COLLECTION';
        return `• <b>${escapeHtml(p.tag)}</b>\n  ${escapeHtml(statusLabel)} · ${p.totalDue.toLocaleString('ru-RU')} ₽`;
    });
    return `${lines.join('\n\n')}\n\nВыберите закупку:`;
}

async function replyPurchasesList(
    ctx: CustomContext,
    container: ServiceContainer,
    edit = false,
): Promise<void> {
    const userId = ctx.session.userId!;
    const purchases = await container.orderService.getActivePurchases(userId);

    const text = formatPurchasesList(purchases);
    const options = purchases.length > 0 ? { reply_markup: buildPurchasesKeyboard(purchases) } : {};
    const htmlOptions = { ...options, parse_mode: 'HTML' as const };

    if (edit && ctx.callbackQuery?.message) {
        await ctx.editMessageText(text, htmlOptions);
    } else {
        await ctx.reply(text, htmlOptions);
    }
}

/**
 * /orders — список активных закупок пользователя.
 */
export class OrdersCommand implements CommandHandler {
    readonly command = 'orders';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext): Promise<void> {
        await replyPurchasesList(ctx, this.container, false);
    }
}
