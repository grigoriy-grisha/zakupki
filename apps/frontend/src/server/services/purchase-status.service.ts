import { createLogger } from '@zakupki/logger';
import type { EventBus } from '@zakupki/queue';
import {
    canTransitionFulfillment,
    canTransitionPurchaseStatus,
    FULFILLMENT_TRANSITIONS,
    isFreezePoint,
    isPaymentPlusFreezePoint,
    isUnfreezePoint,
    NotFoundError,
    NOTIFIABLE_FULFILLMENT_STAGES,
    PURCHASE_STATUS_TRANSITIONS,
    type PurchaseFulfillmentStatus,
    type PurchaseStatus,
    ValidationError,
} from '@zakupki/types';

import type { OrderRepository } from '../domain/order.repository';
import type { PurchaseRepository } from '../domain/purchase.repository';
import type { NotificationService } from './notification.service';

const log = createLogger('purchase-status-service');

function pluralParticipants(count: number): string {
    return count % 10 === 1 && count % 100 !== 11 ? 'участника' : 'участников';
}

/**
 * Управление жизненным циклом закупки: переходы статусов (DRAFT/ACTIVE/DONE) и
 * этапов комплектации (fulfillment), включая заморозку/разморозку базовых
 * количеств заказов и эмиссию доменных событий для воркера постов.
 *
 * Работа с товарами закупки живёт в `PurchaseService`.
 *
 * Ключевые переходы статуса/этапа дополнительно пушат каждому участнику
 * уведомление через NotificationService (fan-out по всем OrderLine.userId).
 * Ошибки notify логируются и не пробрасываются — переход уже закоммичен.
 */
export class PurchaseStatusService {
    constructor(
        private repo: PurchaseRepository,
        private orderRepo: OrderRepository,
        private eventBus: EventBus,
        private notification: NotificationService,
    ) {}

    async updateStatus(id: number, status: string) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        const current = purchase.status as PurchaseStatus;
        const next = status as PurchaseStatus;

        // No-op call (same status): keep it silent — no event, no fan-out spam.
        if (current === next) {
            return this.repo.updateStatus(id, status);
        }

        if (!canTransitionPurchaseStatus(current, next)) {
            const allowed = PURCHASE_STATUS_TRANSITIONS[current] ?? [];
            throw new ValidationError(
                `Недопустимый переход статуса: ${current} → ${next}. Разрешено: ${allowed.join(', ') || '(нет)'}`,
            );
        }

        const result = await this.repo.updateStatus(id, status);
        await this.eventBus.emitPurchaseStatusChanged(id, current, next);
        await this.notifyStatusChanged(id, next);
        return result;
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
            // Notify only on the 3 key stages (REORDER, PAYMENT, READY_FOR_PICKUP).
            if (NOTIFIABLE_FULFILLMENT_STAGES.has(next)) {
                await this.notifyFulfillmentStage(id, next);
            }
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
        await this.notifyStatusChanged(purchaseId, 'ACTIVE');
        return result;
    }

    async complete(id: number) {
        const purchase = await this.repo.getById(id);
        if (!purchase) throw new NotFoundError('Закупка', id);
        if (purchase.status !== 'ACTIVE') {
            throw new ValidationError('Завершить можно только активную закупку');
        }
        const missing = await this.orderRepo.countParticipantsWithoutHandoff(id);
        if (missing > 0) {
            throw new ValidationError(
                `Нельзя завершить закупку: не проставлен статус выдачи у ${missing} ${pluralParticipants(missing)}`,
            );
        }
        const result = await this.repo.updateStatus(id, 'DONE');
        await this.eventBus.emitPurchaseStatusChanged(id, 'ACTIVE', 'DONE');
        await this.notifyStatusChanged(id, 'DONE');
        return result;
    }

    // ── Внутренние: fan-out уведомлений (best-effort) ───────────────

    /**
     * Fan-out a fulfillment-stage notification to every participant of the
     * purchase (anyone with at least one order line). Failures are logged per
     * user but never abort the loop — every user gets an independent chance.
     */
    private async notifyFulfillmentStage(
        purchaseId: number,
        stage: PurchaseFulfillmentStatus,
    ): Promise<void> {
        const purchaseTag = await this.repo.findTagById(purchaseId);
        if (!purchaseTag) return;
        const userIds = await this.orderRepo.findParticipantUserIds(purchaseId);
        await Promise.all(
            userIds.map((userId) =>
                this.notification
                    .notify({
                        userId,
                        type: 'PURCHASE_FULFILLMENT_STAGE',
                        payload: { purchaseId, purchaseTag, stage },
                    })
                    .catch((err) =>
                        log.warn({ purchaseId, userId, stage, err }, 'failed to notify fulfillment stage'),
                    ),
            ),
        );
    }

    /** Fan-out a purchase-status-change notification to every participant. */
    private async notifyStatusChanged(purchaseId: number, status: PurchaseStatus): Promise<void> {
        const purchaseTag = await this.repo.findTagById(purchaseId);
        if (!purchaseTag) return;
        const userIds = await this.orderRepo.findParticipantUserIds(purchaseId);
        await Promise.all(
            userIds.map((userId) =>
                this.notification
                    .notify({
                        userId,
                        type: 'PURCHASE_STATUS_CHANGED',
                        payload: { purchaseId, purchaseTag, status },
                    })
                    .catch((err) =>
                        log.warn({ purchaseId, userId, status, err }, 'failed to notify status change'),
                    ),
            ),
        );
    }
}
