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
import { effectiveQty } from '../order-math';
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
        const packSize = this.item.packAmount;
        // currentQty (effective) — qty + пакеты как qty. Используется только для
        // supplierLimit. На строке сохраняем сырой line.quantity + delta.
        const currentQtyEffective = effectiveQty(line, packSize);
        const lineQty = line?.quantity ?? 0;
        const newLineQty = lineQty + delta;

        // COLLECTION: poolApplies=false, никаких pool check
        if (newLineQty <= 0) {
            if (!line) return ok(); // delta<0 на пустом месте — no-op
            return applyZeroOutOnLine(line);
        }

        // Supplier limit check (глобальный пул, не зависит от poolApplies)
        if (delta > 0) {
            const newEffectiveQty = currentQtyEffective + delta;
            const limitErr = validateSupplierLimit(this.item, newEffectiveQty, currentQtyEffective, this.aggregateForPool());
            if (limitErr) return err(limitErr);
        }

        return applySetQtyOnLine(this.item, line, userId, true, newLineQty);
    }

    override adjustPackages(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        // Pre-check `packAmount` уже сделан в OrderBook.adjustPackages.
        const line = this.findBaseLine(userId);
        const packSize = this.item.packAmount;
        const currentQty = effectiveQty(line, packSize);
        const newPkgCount = (line?.packageCount ?? 0) + delta;
        if (newPkgCount < 0) {
            return err({ code: 'negative', message: 'Количество упаковок не может быть отрицательным' });
        }

        // Supplier limit check: пакеты добавляют qty, проверяем глобальный пул.
        if (delta > 0 && packSize != null) {
            const newQty = currentQty + delta * packSize;
            if (newQty > 0) {
                const limitErr = validateSupplierLimit(this.item, newQty, currentQty, this.aggregateForPool());
                if (limitErr) return err(limitErr);
            }
        }

        return applySetPackagesOnLine(this.item, line, userId, true, newPkgCount);
    }

    override aggregateForPool() {
        let totalOrderedQuantity = 0;
        let totalOrderedWithPackages = 0;
        const pack = this.item.packAmount ?? 0;
        for (const line of this.lines) {
            if (!line.isActive) continue;
            totalOrderedQuantity += Number(line.quantity);
            totalOrderedWithPackages += Number(line.quantity) + Number(line.packageCount) * pack;
        }
        return { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity, totalOrderedWithPackages };
    }
}
