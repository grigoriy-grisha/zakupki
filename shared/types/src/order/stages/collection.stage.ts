/**
 * Стратегия этапа COLLECTION.
 *
 * Свободный сбор заказа: добавляем/убавляем сколько угодно, упаковки доступны,
 * при обнулении — полное удаление строки. Пул добора НЕ применим.
 */
import type { OrderError, OrderLineVO } from '../types';
import type { PoolAggregation, StageStrategy } from '../stages';

export class CollectionStage implements StageStrategy {
    readonly stage = 'COLLECTION' as const;
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
        return 'hard_delete' as const;
    }

    poolApplies() {
        return false;
    }

    aggregateForPool(lines: OrderLineVO[]): PoolAggregation {
        const active = lines.filter((l) => l.status !== 'CANCELLED');
        let totalOrderedQuantity = 0;
        for (const line of active) {
            totalOrderedQuantity += line.quantity;
        }
        // На COLLECTION заморозки нет — supplement всегда 0, base всегда 0.
        return { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity };
    }

    validatePool(): OrderError | null {
        // Пул не применим на COLLECTION — без ограничений.
        return null;
    }

    minDecreaseQuantity() {
        // На COLLECTION можно убавить до 0.
        return 0;
    }
}
