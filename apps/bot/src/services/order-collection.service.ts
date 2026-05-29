import type { PrismaClient } from '@zakupki/database';
import { calculateOrderAmount } from '@zakupki/types';

import { OrderRepository } from '../domain/repositories/order.repository';
import { PurchaseItemRepository } from '../domain/repositories/purchase-item.repository';
import { parseOrderQuantity } from '../lib/parse-order-quantity';
import { allTelegramPostRefs, type ReplyToMessage, walkReplyChain } from '../lib/resolve-reply-purchase-item';
import { UserService } from './user.service';

export type OrderCollectionResult =
    | {
          ok: true;
          productName: string;
          quantity: number;
          unitShort: string;
          amountDue: number;
          purchaseTag: string;
          added?: number;
          subtracted?: number;
          cancelled?: boolean;
      }
    | { ok: false; reason: 'invalid_quantity' | 'product_not_found' | 'purchase_inactive' | 'error'; message: string };

export class OrderCollectionService {
    private purchaseItems: PurchaseItemRepository;
    private orders: OrderRepository;
    private users: UserService;

    constructor(db: PrismaClient) {
        this.purchaseItems = new PurchaseItemRepository(db);
        this.orders = new OrderRepository(db);
        this.users = new UserService(db);
    }

    async resolvePurchaseItemFromReply(chatId: number, replyTo: ReplyToMessage) {
        const refs = allTelegramPostRefs(chatId, replyTo);

        for (const ref of refs) {
            const item = await this.purchaseItems.findByTelegramPost(ref.channelId, ref.messageId);
            if (item) return item;
        }

        for (const msg of walkReplyChain(replyTo)) {
            const item = await this.purchaseItems.findByTgMessageId(String(msg.message_id));
            if (item) return item;
        }

        return null;
    }

    async collectFromReply(params: {
        chatId: number;
        replyTo: ReplyToMessage;
        text: string;
        telegramId: string;
        userInfo: { firstName: string; lastName?: string; username?: string };
    }): Promise<OrderCollectionResult> {
        const parsed = parseOrderQuantity(params.text);
        if (parsed === null) {
            return {
                ok: false,
                reason: 'invalid_quantity',
                message: 'Напишите количество числом, например: 10 или -5',
            };
        }

        const purchaseItem = await this.resolvePurchaseItemFromReply(params.chatId, params.replyTo);

        if (!purchaseItem?.product) {
            return {
                ok: false,
                reason: 'product_not_found',
                message: 'Не найден товар для этого сообщения',
            };
        }

        const status = purchaseItem.purchase.status;
        if (status !== 'ACTIVE' && status !== 'SUPPLEMENT') {
            return {
                ok: false,
                reason: 'purchase_inactive',
                message: 'Закупка не принимает заказы',
            };
        }

        const user = await this.users.createOrGetUser(params.telegramId, params.userInfo);
        const unitShort = purchaseItem.product.unit?.shortName ?? 'ед.';
        const pricing = {
            priceTiers: purchaseItem.product.priceTiers,
            pricePerUnit: Number(purchaseItem.product.pricePerUnit),
            priceOverride: purchaseItem.priceOverride != null ? Number(purchaseItem.priceOverride) : null,
        };

        const existingLine = await this.orders.findByPurchaseItemAndUser(purchaseItem.id, user.id);
        const currentQty = existingLine ? Number(existingLine.quantity) : 0;

        let newQuantity: number;
        let added: number | undefined;
        let subtracted: number | undefined;

        if (parsed.kind === 'add') {
            added = parsed.amount;
            newQuantity = currentQty + parsed.amount;
        } else {
            if (currentQty <= 0) {
                return {
                    ok: false,
                    reason: 'error',
                    message: 'У вас нет заказа по этому товару',
                };
            }
            if (parsed.amount > currentQty) {
                return {
                    ok: false,
                    reason: 'error',
                    message: `В заказе ${formatQty(currentQty)} ${unitShort}, нельзя убрать ${formatQty(parsed.amount)} ${unitShort}`,
                };
            }
            subtracted = parsed.amount;
            newQuantity = currentQty - parsed.amount;
        }

        try {
            if (newQuantity <= 0) {
                if (existingLine) {
                    await this.orders.deleteAndRestoreStock(existingLine.id);
                }
                return {
                    ok: true,
                    productName: purchaseItem.product.name,
                    quantity: 0,
                    unitShort,
                    amountDue: 0,
                    purchaseTag: purchaseItem.purchase.tag,
                    subtracted,
                    cancelled: true,
                };
            }

            const amountDue = calculateOrderAmount(newQuantity, pricing);
            await this.orders.upsertWithStock(purchaseItem.id, user.id, newQuantity, amountDue);

            return {
                ok: true,
                productName: purchaseItem.product.name,
                quantity: newQuantity,
                unitShort,
                amountDue,
                purchaseTag: purchaseItem.purchase.tag,
                added,
                subtracted,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сохранить заказ';
            return { ok: false, reason: 'error', message };
        }
    }
}

function formatQty(quantity: number): string {
    return quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
}
