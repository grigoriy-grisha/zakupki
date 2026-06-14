/**
 * ReorderStrategy — логика для этапа REORDER (добор).
 *
 * Сложность: COLLECTION-строка уже заморожена (baseQuantity / basePackageCount).
 * При adjust(delta>0):
 *   1. Pool check на суммарный user total (base + supp)
 *   2. Split: заполняем base до baseQuantity (fillBase), остаток → новая/существующая supp
 * При adjust(delta<0):
 *   - Сначала supp (REORDER-строка), потом base
 * При adjustPackages:
 *   - Split: заполняем pkg-gap в base (base.basePackageCount - base.packageCount),
 *     остаток → supp
 *   - Возможно создание новой COLLECTION с pkg>0, qty=0
 *   - Hard-delete при qty=0 && pkg=0
 */
import { computeAmountDue, computeAmountDueWithPackages } from '../pricing';
import { validateSupplementPool } from '../pool';
import { BaseMutableStrategy } from './stage-strategy';
import {
    aggregateForPool,
    applySetPackagesOnLine,
    applyZeroOutOnLine,
    err,
    forbidden,
    makeNewLine,
    makeUpsertEffect,
    ok,
    splitReorderDelta,
    toActiveVOs,
    type LineUpdate,
    type MultiUpdate,
} from './atomic';

export class ReorderStrategy extends BaseMutableStrategy {
    readonly stageName = 'REORDER' as const;

    // ── adjust: split на base + supp ──

    override adjust(userId: number, delta: number): MultiUpdate {
        if (delta > 0) return this.adjustIncrease(userId, delta);
        if (delta < 0) return this.adjustDecrease(userId, delta);
        return ok();
    }

    /** REORDER adjust(+N): split fillBase/spillover. */
    private adjustIncrease(userId: number, delta: number): MultiUpdate {
        const base = this.findBaseLine(userId);
        const supp = this.findSupplementLine(userId);

        // Permission: нужен supp (или право создать)
        if (!supp && !this.cfg.canAddNew) {
            return err(forbidden('На этом этапе нельзя добавить новый товар'));
        }

        // Pool: на суммарный user total
        const userCurrent = (base?.quantity ?? 0) + (supp?.quantity ?? 0);
        const userNew = userCurrent + delta;
        const poolErr = validateSupplementPool(
            this.item,
            userNew,
            userCurrent,
            aggregateForPool('REORDER', toActiveVOs(this.lines)),
        );
        if (poolErr) return err(poolErr);

        // Split: fillBase = сколько delta идёт в base (до baseQuantity), spillover — в supp
        const { fillBase, spillover } = splitReorderDelta(delta, base?.baseQuantity ?? 0, base?.quantity ?? 0);
        const updates: LineUpdate[] = [];
        const effects = [];

        if (fillBase > 0 && base) {
            const newQty = base.quantity + fillBase;
            const amountDue = computeAmountDueWithPackages(newQty, base.packageCount, this.item);
            const newBase = base.withQuantity(newQty, amountDue);
            updates.push({ old: base, new: newBase });
            effects.push(makeUpsertEffect(this.item, userId, base.createdOnStage, newQty, amountDue, base.packageCount));
        }
        if (spillover > 0) {
            const newQty = (supp?.quantity ?? 0) + spillover;
            const amountDue = computeAmountDue(newQty, this.item);
            const newSupp = supp
                ? supp.withQuantity(newQty, amountDue)
                : makeNewLine(this.item, userId, 'REORDER', newQty, amountDue, 0);
            updates.push({ old: supp, new: newSupp });
            effects.push(makeUpsertEffect(this.item, userId, 'REORDER', newQty, amountDue, 0));
        }
        return { updates, effects };
    }

    /** REORDER adjust(-N): supp-first, потом base. */
    private adjustDecrease(userId: number, delta: number): MultiUpdate {
        // delta<0
        const supp = this.findSupplementLine(userId);
        if (supp && supp.quantity > 0) {
            const newQty = supp.quantity + delta;
            if (newQty > 0) {
                const amountDue = computeAmountDue(newQty, this.item);
                return {
                    updates: [{ old: supp, new: supp.withQuantity(newQty, amountDue) }],
                    effects: [makeUpsertEffect(this.item, userId, 'REORDER', newQty, amountDue, supp.packageCount)],
                };
            }
            return applyZeroOutOnLine(supp);
        }
        const base = this.findBaseLine(userId);
        if (base && base.quantity > 0) {
            const newQty = base.quantity + delta;
            if (newQty > 0) {
                const amountDue = computeAmountDueWithPackages(newQty, base.packageCount, this.item);
                return {
                    updates: [{ old: base, new: base.withQuantity(newQty, amountDue) }],
                    effects: [makeUpsertEffect(this.item, userId, 'COLLECTION', newQty, amountDue, base.packageCount)],
                };
            }
            return applyZeroOutOnLine(base);
        }
        return ok();
    }

    // ── adjustPackages: split на base (fill pkg-gap) + supp ──

    override adjustPackages(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        const base = this.findBaseLine(userId);
        const supp = this.findSupplementLine(userId);
        if (!base && !supp && !this.cfg.canAddNew) {
            return err(forbidden('На этом этапе нельзя добавить новый товар'));
        }

        // Нет COLLECTION-строки и delta>0 → создаём с pkg=delta, qty=0
        if (!base && delta > 0) {
            const newPkgCount = delta;
            const amountDue = computeAmountDueWithPackages(0, newPkgCount, this.item);
            const newBase = makeNewLine(this.item, userId, 'COLLECTION', 0, amountDue, newPkgCount);
            return {
                updates: [{ old: null, new: newBase }],
                effects: [makeUpsertEffect(this.item, userId, 'COLLECTION', 0, amountDue, newPkgCount)],
            };
        }
        if (!base) {
            return err({ code: 'negative', message: 'Количество упаковок не может быть отрицательным' });
        }

        // Split: заполняем pkg-gap в base, остаток → supp
        const baseFrozenPkg = base.basePackageCount ?? 0;
        const basePkgGap = Math.max(0, baseFrozenPkg - base.packageCount);
        const currentReorderPkg = supp?.packageCount ?? 0;

        let newBasePkg: number;
        let newReorderPkg: number;
        if (delta > 0) {
            const fillBase = Math.min(delta, basePkgGap);
            newBasePkg = base.packageCount + fillBase;
            newReorderPkg = currentReorderPkg + (delta - fillBase);
        } else {
            const take = Math.min(-delta, currentReorderPkg);
            newReorderPkg = currentReorderPkg - take;
            newBasePkg = base.packageCount - Math.min(-delta - take, base.packageCount);
        }
        if (newBasePkg < 0 || newReorderPkg < 0) {
            return err({ code: 'negative', message: 'Количество упаковок не может быть отрицательным' });
        }

        const updates: LineUpdate[] = [];
        const effects = [];

        // 1. base — если qty=0 && pkg=0 → hard-delete
        if (newBasePkg !== base.packageCount) {
            if (newBasePkg === 0 && base.quantity === 0) {
                updates.push({ old: base, new: null });
                effects.push({ type: 'delete' as const, lineId: base.id });
            } else {
                const amountDue = computeAmountDueWithPackages(base.quantity, newBasePkg, this.item);
                const newBaseLine = base.withQuantity(base.quantity, amountDue).withPackageCount(newBasePkg);
                updates.push({ old: base, new: newBaseLine });
                effects.push(makeUpsertEffect(this.item, userId, 'COLLECTION', base.quantity, amountDue, newBasePkg));
            }
        }

        // 2. supp — создать / обновить / удалить
        const suppQty = supp?.quantity ?? 0;
        if (newReorderPkg > 0 || suppQty > 0) {
            const amountDue = computeAmountDueWithPackages(suppQty, newReorderPkg, this.item);
            const newSupp = supp
                ? supp.withQuantity(suppQty, amountDue).withPackageCount(newReorderPkg)
                : makeNewLine(this.item, userId, 'REORDER', suppQty, amountDue, newReorderPkg);
            updates.push({ old: supp, new: newSupp });
            effects.push(makeUpsertEffect(this.item, userId, 'REORDER', suppQty, amountDue, newReorderPkg));
        } else if (supp) {
            // pkg=0, qty=0 → delete
            updates.push({ old: supp, new: null });
            effects.push({ type: 'delete' as const, lineId: supp.id });
        }
        return { updates, effects };
    }

    // ── aggregateForPool: REORDER формула ──

    override aggregateForPool() {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;
        for (const line of this.lines) {
            if (!line.isActive) continue;
            const bq = line.baseQuantity ?? 0;
            totalBaseQuantity += bq;
            supplementClaimed += Math.max(0, line.quantity - bq);
            totalOrderedQuantity += line.quantity;
        }
        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity };
    }
}
