/**
 * Стратегия этапа REORDER (добор).
 *
 * Правила:
 *  - Работаем с COLLECTION-строкой (targetLineType = 'base').
 *  - Можно свободно убавлять/добавлять (в т.ч. упаковки).
 *  - Пул добора применим: supplement = qty - baseQuantity внутри каждой строки
 *    (сколько пользователь добавил СВЕРХ замороженной базы).
 *  - При обнулении количества — zero_out (сохраняем строку с qty=0 и baseQuantity).
 *  - Можно убавить до 0 (minDecreaseQuantity = 0).
 */
import type { OrderLineVO, PurchaseItem } from '../types';
import type { PoolAggregation, StageStrategy } from './index';
import { validateSupplementPool } from './index';

export class ReorderStage implements StageStrategy {
    readonly stage = 'REORDER' as const;
    readonly targetLineType = 'base' as const;

    canAddNew() {
        return true;
    }
    canIncrease() {
        return true;
    }
    canDecrease() {
        return true;
    }
    canAddPackages() {
        return true;
    }

    onZeroQuantity() {
        // Сохраняем COLLECTION-строку с qty=0, чтобы baseQuantity остался
        // (нужен для корректного расчёта пула на REORDER).
        return 'zero_out' as const;
    }

    poolApplies() {
        return true;
    }

    /**
     * REORDER: supplement = Σ max(0, qty - baseQuantity) для каждой ACTIVE строки.
     * Здесь все строки createdOnStage='COLLECTION', но часть qty сверх
     * замороженной базы считается «добором».
     */
    aggregateForPool(lines: OrderLineVO[]): PoolAggregation {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;

        for (const line of lines) {
            if (line.status === 'CANCELLED') continue;
            const qty = line.quantity;
            const bq = line.baseQuantity ?? 0;
            totalBaseQuantity += bq;
            supplementClaimed += Math.max(0, qty - bq);
            totalOrderedQuantity += qty;
        }

        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity };
    }

    validatePool(
        item: PurchaseItem,
        _userId: number,
        newQty: number,
        currentQty: number,
        aggregation: PoolAggregation,
    ) {
        return validateSupplementPool(item, newQty, currentQty, aggregation);
    }

    minDecreaseQuantity() {
        // На REORDER можно убавить до 0 (база не защищена).
        return 0;
    }
}
