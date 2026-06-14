/**
 * CollectionStrategy — логика для этапа COLLECTION.
 *
 * На COLLECTION пользователь формирует базовый заказ:
 *  - adjust → addQty на base-строку (target='base', poolApplies=false)
 *  - adjustPackages → addPackages на base-строку (canAddPackages=true)
 *  - 4 admin* методов — default в BaseMutableStrategy
 *  - aggregateForPool: totalOrdered = Σ qty активных строк
 *
 * Также проверяет глобальный supplierLimit (если задан): на adjust(+) и
 * adjustPackages(+) — не даёт сумме всех заказов превысить лимит.
 */
import type { OrderLine } from '../order-line';
import { validateSupplierLimit } from '../limit';
import { BaseMutableStrategy } from './stage-strategy';
import {
    applySetPackagesOnLine,
    applySetQtyOnLine,
    applyZeroOutOnLine,
    err,
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

        // Supplier limit check (глобальный пул, не зависит от poolApplies)
        if (delta > 0) {
            const limitErr = validateSupplierLimit(this.item, newQty, currentQty, this.aggregateForPool());
            if (limitErr) return err(limitErr);
        }

        return applySetQtyOnLine(this.item, line, userId, true, newQty);
    }

    override adjustPackages(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        // Pre-check `supplierPackageAmount` уже сделан в OrderBook.adjustPackages.
        const line = this.findBaseLine(userId);
        const currentQty = line?.quantity ?? 0;
        const newPkgCount = (line?.packageCount ?? 0) + delta;
        if (newPkgCount < 0) {
            return err({ code: 'negative', message: 'Количество упаковок не может быть отрицательным' });
        }

        // Supplier limit check: пакеты добавляют qty, проверяем глобальный пул.
        // supplierPackageAmount добавляется к qty (qty += pkg * supplierPackageAmount).
        if (delta > 0 && this.item.supplierPackageAmount != null) {
            const newQty = currentQty + newPkgCount * this.item.supplierPackageAmount;
            if (newQty > 0) {
                const limitErr = validateSupplierLimit(this.item, newQty, currentQty, this.aggregateForPool());
                if (limitErr) return err(limitErr);
            }
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
