/**
 * Стратегия этапов PAYMENT и далее (PAYMENT, SUPPLIER_ASSEMBLY, ...).
 *
 * Правила:
 *  - Работаем с supplement-строкой (targetLineType = 'supplement', createdOnStage != COLLECTION).
 *  - COLLECTION-строка ЗАМОРОЖЕНА — её количество нельзя менять.
 *  - Можно добавлять/убавлять ТОЛЬКО supplement (россыпь из остатка).
 *  - Нельзя убавить ниже 0 (supplement отдельная строка, можно убрать до 0 и удалить).
 *  - Упаковки НЕ доступны.
 *  - Пул применим: supplement = Σ qty non-COLLECTION строк (createdOnStage-based).
 *  - При обнулении supplement — hard delete.
 */
import type { OrderLineVO, PurchaseItem } from '../types';
import type { PoolAggregation, StageStrategy } from '../stages';
import { validateSupplementPool } from '../stages';

export class PaymentPlusStage implements StageStrategy {
    readonly stage = 'PAYMENT' as const;
    readonly targetLineType = 'supplement' as const;

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
        return false;
    }

    onZeroQuantity() {
        // Supplement-строку можно убрать полностью — hard delete.
        return 'hard_delete' as const;
    }

    poolApplies() {
        return true;
    }

    /**
     * PAYMENT+: supplement = Σ qty non-COLLECTION строк (createdOnStage-based).
     * COLLECTION-строки (замороженная база) в supplement не входят.
     */
    aggregateForPool(lines: OrderLineVO[]): PoolAggregation {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;

        for (const line of lines) {
            if (line.status === 'CANCELLED') continue;
            const qty = line.quantity;
            totalOrderedQuantity += qty;
            if (line.createdOnStage === 'COLLECTION') {
                totalBaseQuantity += qty;
            } else {
                supplementClaimed += qty;
            }
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

    /**
     * Supplement-строка отдельная — её нижняя граница 0.
     * (COLLECTION-строка вообще не трогается на этом этапе.)
     */
    minDecreaseQuantity() {
        return 0;
    }
}
