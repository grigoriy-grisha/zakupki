import { computePackagePrice, getUnitByCode, mergeLines, toOrderLinesVO } from '@zakupki/types';
import type { PurchaseFulfillmentStatus } from '@zakupki/types';
import { serviceContainer } from '@/server/lib/service-container';

import { parseOrderQuantity } from '../lib/parse-order-quantity';
import { PurchaseItemResolver } from './purchase-item-resolver';

export type OrderCollectionAction = { amount: number; unit: 'remainder' | 'packs' };

export type OrderCollectionResult =
    | {
          ok: true;
          productName: string;
          purchaseItemId: number;
          internalUserId: number;
          quantity: number;
          packageCount: number;
          unitShort: string;
          amountDue: number;
          purchaseTag: string;
          pricePerUnit: number;
          packSize: number | null;
          packagePrice: number | null;
          added?: OrderCollectionAction;
          subtracted?: OrderCollectionAction;
          cancelled?: boolean;
      }
    | { ok: false; reason: 'invalid_quantity' | 'product_not_found' | 'purchase_inactive' | 'error'; message: string };

type ResolvedItem = NonNullable<Awaited<ReturnType<PurchaseItemResolver['resolvePurchaseItem']>>>;

export class OrderCollectionService {
    private resolver: PurchaseItemResolver;

    constructor(resolver?: PurchaseItemResolver) {
        this.resolver = resolver ?? new PurchaseItemResolver();
    }

    async collectFromReply(params: {
        chatId: number;
        replyTo?: import('../lib/resolve-reply-purchase-item').ReplyToMessage;
        threadId?: number;
        text: string;
        telegramId: string;
        userInfo: { firstName: string; lastName?: string; username?: string };
        messageId?: number;
    }): Promise<OrderCollectionResult> {
        const parsed = parseOrderQuantity(params.text);
        if (parsed === null) {
            return {
                ok: false,
                reason: 'invalid_quantity',
                message:
                    'Напишите количество числом, например: 10 (граммов) или +2п (две пачки) или -1п (снять пачку)',
            };
        }

        const purchaseItem = await this.resolver.resolvePurchaseItem(params.chatId, {
            reply_to_message: params.replyTo,
            message_thread_id: params.threadId,
        });

        if (!purchaseItem?.product) {
            return {
                ok: false,
                reason: 'product_not_found',
                message: 'Не найден товар для этого сообщения',
            };
        }

        const user = await serviceContainer.user.createOrGetUser(params.telegramId, params.userInfo);
        const pricing = this.getItemPricing(purchaseItem);

        try {
            const result = await this.applyDelta(purchaseItem, user.id, parsed);

            // После операции получаем ВСЕ строки пользователя для этого purchaseItem
            // (с createdOnStage их может быть две: COLLECTION + supplement) и объединяем.
            const allLines = await serviceContainer.order.getActiveLinesForUserItem(purchaseItem.id, user.id);
            const aggregated = mergeLines(toOrderLinesVO(allLines));
            const hasLines = aggregated.quantity > 0;

            if (!hasLines) {
                return this.buildResult(purchaseItem, user.id, pricing, parsed, {
                    quantity: 0,
                    packageCount: 0,
                    amountDue: 0,
                    cancelled: true,
                });
            }

            return this.buildResult(purchaseItem, user.id, pricing, parsed, {
                quantity: aggregated.quantity,
                packageCount: aggregated.packageCount,
                amountDue: aggregated.amountDue,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сохранить заказ';
            return { ok: false, reason: 'error', message };
        }
    }

    // ── Private helpers ───────────────────────────────────────────

    private buildResult(
        item: ResolvedItem,
        userId: number,
        pricing: ReturnType<typeof this.getItemPricing>,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
        line: { quantity: number; packageCount: number; amountDue: number; cancelled?: true },
    ): Extract<OrderCollectionResult, { ok: true }> {
        const action: OrderCollectionAction = { amount: parsed.amount, unit: parsed.unit };
        return {
            ok: true,
            productName: item.product.name,
            purchaseItemId: item.id,
            internalUserId: userId,
            quantity: line.quantity,
            packageCount: line.packageCount,
            unitShort: pricing.unitShort,
            amountDue: line.amountDue,
            purchaseTag: item.purchase.tag,
            pricePerUnit: pricing.pricePerUnit,
            packSize: pricing.packSize,
            packagePrice: pricing.packagePrice,
            added: parsed.kind === 'add' ? action : undefined,
            subtracted: parsed.kind === 'subtract' ? action : undefined,
            ...(line.cancelled ? { cancelled: true } : {}),
        };
    }

    private getItemPricing(item: ResolvedItem) {
        const unitShort = getUnitByCode(item.product.unitCode)?.shortName ?? 'ед.';
        const packSize =
            item.product.supplierPackageAmount != null ? Number(item.product.supplierPackageAmount) : null;
        const pricePerUnit = Number(item.priceOverride ?? item.product.pricePerUnit);
        // computePackagePrice (shared) принимает PurchaseItem; собираем минимум полей.
        const packagePrice = computePackagePrice({
            purchaseItemId: item.id,
            pricePerUnit,
            priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
            priceTiers: null,
            packDiscountPercent: 0,
            supplierPackageAmount: packSize,
            supplierPackageUnit: item.product.supplierPackageUnit ?? null,
            supplierPackagePrice:
                item.product.supplierPackagePrice != null ? Number(item.product.supplierPackagePrice) : null,
            unitCode: item.product.unitCode ?? 'piece',
            multiplicity: Number(item.product.multiplicity ?? 1),
            minPackageAmount:
                item.product.minPackageAmount != null ? Number(item.product.minPackageAmount) : null,
            minPackageUnit: item.product.minPackageUnit ?? null,
            supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
            fulfillmentStatus: (item.purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus,
            targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        });

        return { unitShort, packSize, pricePerUnit, packagePrice };
    }

    private async applyDelta(
        purchaseItem: ResolvedItem,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        if (parsed.unit === 'packs') {
            return this.applyPackDelta(purchaseItem.id, userId, parsed);
        }
        return this.applyQuantityDelta(purchaseItem, userId, parsed);
    }

    private async applyPackDelta(
        purchaseItemId: number,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        const count = Math.round(parsed.amount);
        const sign = parsed.kind === 'add' ? 1 : -1;
        let lastResult: any = null;
        for (let i = 0; i < count; i++) {
            lastResult = await serviceContainer.order.adjustPackageCount(purchaseItemId, userId, sign);
        }
        return lastResult;
    }

    private async applyQuantityDelta(
        purchaseItem: ResolvedItem,
        userId: number,
        parsed: NonNullable<ReturnType<typeof parseOrderQuantity>>,
    ) {
        const minPackaging =
            Number(purchaseItem.product.minPackageAmount) ||
            Number(purchaseItem.product.multiplicity) ||
            1;
        const steps = Math.round(parsed.amount / minPackaging);
        const delta = parsed.kind === 'add' ? steps * minPackaging : -steps * minPackaging;
        return serviceContainer.order.adjustQuantity(purchaseItem.id, userId, delta);
    }
}
