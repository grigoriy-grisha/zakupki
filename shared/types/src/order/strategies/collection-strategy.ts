/**
 * CollectionStrategy — логика для этапа COLLECTION.
 *
 * На COLLECTION пользователь формирует базовый заказ:
 *  - adjust → addQty на base-строку (target='base', poolApplies=false)
 *  - adjustPackages → addPackages на base-строку (canAddPackages=true)
 *  - 4 admin* методов — default в BaseMutableStrategy
 *  - aggregateForPool: totalOrdered = Σ qty активных строк
 */
import type { OrderLine } from '../order-line';
import { BaseMutableStrategy } from './stage-strategy';
import {
    applySetPackagesOnLine,
    applySetQtyOnLine,
    applyZeroOutOnLine,
    err,
    forbidden,
    ok,
    resolveTargetLine,
    type MultiUpdate,
} from './atomic';

export class CollectionStrategy extends BaseMutableStrategy {
    readonly stageName = 'COLLECTION' as const;

    override adjust(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        const line = resolveTargetLine(this.item, this.lines, userId, true);
        const currentQty = line?.quantity ?? 0;
        const newQty = currentQty + delta;

        // COLLECTION: poolApplies=false, никаких pool check
        if (newQty <= 0) {
            if (!line) return ok(); // delta<0 на пустом месте — no-op
            return applyZeroOutOnLine(line);
        }
        return applySetQtyOnLine(this.item, line, userId, true, newQty);
    }

    override adjustPackages(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        // Pre-check `supplierPackageAmount` уже сделан в OrderBook.adjustPackages.
        const line = this.findBaseLine(userId);
        const newPkgCount = (line?.packageCount ?? 0) + delta;
        if (newPkgCount < 0) {
            return err({ code: 'negative', message: 'Количество упаковок не может быть отрицательным' });
        }
        return applySetPackagesOnLine(this.item, line, userId, true, newPkgCount);
    }

    override aggregateForPool() {
        let totalOrderedQuantity = 0;
        for (const line of this.lines) {
            if (line.isActive) totalOrderedQuantity += line.quantity;
        }
        return { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity };
    }
}
