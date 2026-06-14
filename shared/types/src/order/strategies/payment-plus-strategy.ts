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
 *  - empty-decrease → forbidden (нельзя создать отрицательный заказ)
 *  - adjustPackages → forbidden (cfg.canAddPackages=false)
 *  - 4 admin* методов — default в BaseMutableStrategy
 *  - aggregateForPool: totalBase = Σ qty COLLECTION-строк, supplement = Σ qty не-COLLECTION
 */
import { validateSupplementPool } from '../pool';
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

        // Pool check (cfg.target='supplement' && cfg.poolApplies для PAYMENT+)
        if (delta > 0 && this.cfg.poolApplies) {
            const poolErr = validateSupplementPool(
                this.item,
                newQty,
                currentQty,
                aggregateForPool(this.item.fulfillmentStatus, toActiveVOs(this.lines)),
            );
            if (poolErr) return err(poolErr);
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
