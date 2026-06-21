import {
    canTransitionFulfillment,
    FULFILLMENT_TRANSITIONS,
    isFreezePoint,
    isPaymentPlusFreezePoint,
    isUnfreezePoint,
    NotFoundError,
    ValidationError,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';
import type { EventBus } from '@zakupki/queue';

import { OrderRepository } from '../domain/order.repository';
import { PurchaseRepository } from '../domain/purchase.repository';

/**
 * Управление жизненным циклом закупки: переходы статусов (DRAFT/ACTIVE/DONE) и
 * этапов комплектации (fulfillment), включая заморозку/разморозку базовых
 * количеств заказов и эмиссию доменных событий для воркера постов.
 *
 * Работа с товарами закупки живёт в `PurchaseService`.
 */
export class PurchaseStatusService {
    constructor(
        private repo: PurchaseRepository,
        private orderRepo: OrderRepository,
        private eventBus: EventBus,
    ) {}

    async updateStatus(id: number, status: string) {
        return this.repo.updateStatus(id, status);
    }

    async updateFulfillmentStatus(id: number, fulfillmentStatus: string) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        const current = (purchase.fulfillmentStatus ?? 'COLLECTION') as PurchaseFulfillmentStatus;
        const next = fulfillmentStatus as PurchaseFulfillmentStatus;

        if (!canTransitionFulfillment(current, next)) {
            const allowed = FULFILLMENT_TRANSITIONS[current] ?? [];
            throw new ValidationError(
                `Недопустимый переход: ${current} → ${next}. Разрешено: ${allowed.join(', ') || '(нет)'} `,
            );
        }

        const result = await this.repo.updateFulfillmentStatus(id, next);

        // Заморозка baseQuantity при COLLECTION → REORDER И при REORDER → PAYMENT+
        // (повторная заморозка COLLECTION-строк, удалённых/пересозданных на REORDER).
        // freezeBaseQuantities идемпотентен: фильтрует `baseQuantity: null`.
        if (isFreezePoint(next) || isPaymentPlusFreezePoint(next)) {
            await this.orderRepo.freezeBaseQuantities(id);
        }

        // Разморозка при откате REORDER → COLLECTION
        if (isUnfreezePoint(next)) {
            await this.orderRepo.unfreezeBaseQuantities(id);
        }

        // Emit только если статус реально изменился (защита от no-op вызовов).
        if (current !== next) {
            await this.eventBus.emitPurchaseFulfillmentChanged(id, current, next);
        }

        return result;
    }

    async activate(purchaseId: number) {
        const purchase = await this.repo.getById(purchaseId);
        if (!purchase) throw new NotFoundError('Закупка', purchaseId);
        if (purchase.status !== 'DRAFT') {
            throw new ValidationError('Активировать можно только черновик');
        }
        const result = await this.repo.updateStatus(purchaseId, 'ACTIVE');
        await this.eventBus.emitPurchaseStatusChanged(purchaseId, 'DRAFT', 'ACTIVE');
        return result;
    }

    async complete(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.status !== 'ACTIVE') {
            throw new ValidationError('Завершить можно только активную закупку');
        }
        const result = await this.repo.updateStatus(id, 'DONE');
        await this.eventBus.emitPurchaseStatusChanged(id, 'ACTIVE', 'DONE');
        return result;
    }
}
