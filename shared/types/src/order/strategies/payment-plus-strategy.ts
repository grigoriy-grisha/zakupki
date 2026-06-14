/**
 * PaymentPlusStrategy — логика для этапов PAYMENT+.
 *
 * Покрывает все 7 подстадий: PAYMENT, SUPPLIER_ASSEMBLY, PREPARING_SHIPMENT_RF,
 * IN_TRANSIT_RF, IN_TRANSIT_TO_ORGANIZER, PACKAGING, READY_FOR_PICKUP.
 *
 * На PAYMENT+ пользователь может только добавлять добор (supplement) к своей
 * COLLECTION-строке:
 *  - adjust → addQty на supplement-for-stage строку (target='supplement')
 *  - pool check обязателен (cfg.target==='supplement' && cfg.poolApplies)
 *  - supplier limit check (глобальный остаток поставщика, если задан)
 *  - empty-decrease → forbidden (нельзя создать отрицательный заказ)
 *  - adjustPackages → forbidden (cfg.canAddPackages=false)
 *  - 4 admin* методов — default в BaseMutableStrategy
 *  - aggregateForPool: totalBase = Σ qty COLLECTION-строк, supplement = Σ qty не-COLLECTION
 */
import { validateSupplementPool } from '../pool';
import { validateSupplierLimit } from '../limit';
import { BaseMutableStrategy } from './stage-strategy';
import {
    aggregateForPool,
    applySetQtyOnLine,
    applyZeroOutOnLine,
    err,
    forbidden,
    ok,
    toActiveVOs,
    type MultiUpdate,
} from './atomic';

export class PaymentPlusStrategy extends BaseMutableStrategy {
    readonly stageName = 'PAYMENT' as const; // конкретное имя этапа берётся из item.fulfillmentStatus

    override adjust(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        const line = this.findSupplementLineForStage(userId);
        const currentQty = line?.quantity ?? 0;
        const newQty = currentQty + delta;

        // delta>0 → проверяем pool (если применим) и supplier limit.
        // Агрегируем один раз — используется обеими проверками.
        if (delta > 0) {
            const aggregation = aggregateForPool(this.item.fulfillmentStatus, toActiveVOs(this.lines));

            if (this.cfg.poolApplies) {
                const poolErr = validateSupplementPool(this.item, newQty, currentQty, aggregation);
                if (poolErr) return err(poolErr);
            }

            // Supplier limit (глобальный остаток поставщика). Проверяем только
            // supplement-прирост — frozen base уже не меняется и был проверен
            // на COLLECTION/REORDER.
            const limitErr = validateSupplierLimit(this.item, newQty, currentQty, aggregation);
            if (limitErr) return err(limitErr);
        }

        // Уменьшение на пустом месте
        if (newQty <= 0) {
            if (!line) {
                // PAYMENT+ supplement: уменьшение пустого = запрещено
                if (delta < 0) return err(forbidden('На этом этапе нельзя уменьшить заказ'));
                return ok();
            }
            return applyZeroOutOnLine(line);
        }
        return applySetQtyOnLine(this.item, line, userId, false, newQty);
    }

    override adjustPackages(_userId: number, _delta: number): MultiUpdate {
        return err(forbidden('На этом этапе нельзя добавить упаковку'));
    }

    override aggregateForPool() {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;
        for (const line of this.lines) {
            if (!line.isActive) continue;
            totalOrderedQuantity += line.quantity;
            if (line.isBase) totalBaseQuantity += line.quantity;
            else supplementClaimed += line.quantity;
        }
        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity };
    }
}
