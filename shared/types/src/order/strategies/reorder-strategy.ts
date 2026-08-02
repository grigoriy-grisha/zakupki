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
import { validateSupplierLimit } from '../limit';
import { effectiveQty } from '../order-math';
import type { OrderLine } from '../order-line';
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
        // Stage-scoped: только REORDER-созданная supp-строка. Generic findSupplementLine
        // зацепил бы supp-строку с другого этапа (PAYMENT+), если бы она существовала.
        const supp = this.findSupplementLineForStage(userId);

        // Permission: нужен supp (или право создать)
        if (!supp && !this.cfg.canAddNew) {
            return err(forbidden('На этом этапе нельзя добавить новый товар'));
        }

        // Агрегируем один раз — используется и для pool, и для supplier limit.
        // packSize обязателен: без него пакеты не учитываются в totalOrderedQuantity
        // и supplierLimit пускает сверх лимита (баг "Доступно: 70 гр" при qty+pkg = limit).
        const packSize = this.item.packAmount;
        const aggregation = aggregateForPool('REORDER', toActiveVOs(this.lines), packSize);

        // Pool: на суммарный user total. Пакеты = qty (effective).
        const userCurrent = effectiveQty(base, packSize) + effectiveQty(supp, packSize);
        const userNew = userCurrent + delta;
        const poolErr = validateSupplementPool(this.item, userNew, userCurrent, aggregation);
        if (poolErr) return err(poolErr);

        // Supplier limit: глобальный остаток поставщика. Если задан — не даёт сумме
        // всех заказов превысить лимит. Может быть жёстче, чем pool (если оба заданы).
        const limitErr = validateSupplierLimit(this.item, userNew, userCurrent, aggregation);
        if (limitErr) return err(limitErr);

        // Split: fillBase = сколько delta идёт в base (до baseQuantity), spillover — в supp
        const { fillBase, spillover } = splitReorderDelta(delta, base?.baseQuantity ?? 0, base?.quantity ?? 0);
        const updates: LineUpdate[] = [];
        const effects = [];

        if (fillBase > 0 && base) {
            const newQty = base.quantity + fillBase;
            const amountDue = computeAmountDueWithPackages(newQty, base.packageCount, this.item);
            const newBase = base.withQuantity(newQty, amountDue);
            updates.push({ old: base, new: newBase });
            effects.push(
                makeUpsertEffect(this.item, userId, base.createdOnStage, newQty, amountDue, base.packageCount),
            );
        }
        if (spillover > 0) {
            const newQty = (supp?.quantity ?? 0) + spillover;
            const amountDue = computeAmountDue(newQty, this.item);
            const newSupp = supp
                ? supp.withQuantity(newQty, amountDue)
                : makeNewLine(this.item, userId, 'REORDER', newQty, amountDue, 0);
            updates.push({ old: supp, new: newSupp });
            // Не передаём packageCount в effect — БД сохранит прежнее значение supp-строки
            // (хардкод 0 обнулял пакет при adjust(+qty), что было багом).
            effects.push(makeUpsertEffect(this.item, userId, 'REORDER', newQty, amountDue, supp?.packageCount ?? 0));
        }
        return { updates, effects };
    }

    /** REORDER adjust(-N): supp-first, потом base. */
    private adjustDecrease(userId: number, delta: number): MultiUpdate {
        // delta<0
        const supp = this.findSupplementLineForStage(userId);
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
        const supp = this.findSupplementLineForStage(userId);
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

        const { newBasePkg, newReorderPkg } = this.splitPackageDelta(delta, base, supp);
        if (newBasePkg < 0 || newReorderPkg < 0) {
            return err({ code: 'negative', message: 'Количество упаковок не может быть отрицательным' });
        }

        // Supplier limit check: пакеты дают qty (pkg * packAmount).
        // Если delta>0 и пакеты увеличивают qty — проверяем глобальный пул.
        if (delta > 0 && this.item.packAmount != null) {
            const packSize = this.item.packAmount;
            const pkgDeltaQty = delta * packSize;
            // userCurrent должен учитывать и текущие пакеты, иначе лимит считается
            // только от qty и разрешает превысить supplierLimit.
            const userCurrent = effectiveQty(base, packSize) + effectiveQty(supp, packSize);
            const userNew = userCurrent + pkgDeltaQty;
            if (userNew > 0) {
                const limitErr = validateSupplierLimit(
                    this.item,
                    userNew,
                    userCurrent,
                    aggregateForPool('REORDER', toActiveVOs(this.lines), packSize),
                );
                if (limitErr) return err(limitErr);
            }
        }

        return this.buildPackageUpdates(userId, base, supp, newBasePkg, newReorderPkg);
    }

    /**
     * Распределение delta упаковок между base (заполнение pkg-gap до basePackageCount)
     * и supp-строкой. Возвращает новые значения packageCount для base и supp.
     */
    private splitPackageDelta(
        delta: number,
        base: OrderLine,
        supp: OrderLine | null,
    ): { newBasePkg: number; newReorderPkg: number } {
        const baseFrozenPkg = base.basePackageCount ?? 0;
        const basePkgGap = Math.max(0, baseFrozenPkg - base.packageCount);
        const currentReorderPkg = supp?.packageCount ?? 0;

        if (delta > 0) {
            const fillBase = Math.min(delta, basePkgGap);
            return {
                newBasePkg: base.packageCount + fillBase,
                newReorderPkg: currentReorderPkg + (delta - fillBase),
            };
        }
        const take = Math.min(-delta, currentReorderPkg);
        return {
            newReorderPkg: currentReorderPkg - take,
            newBasePkg: base.packageCount - Math.min(-delta - take, base.packageCount),
        };
    }

    /**
     * Применяет новые packageCount к base и supp: update / hard-delete (qty=0 && pkg=0) /
     * create supp. Логика перенесена из adjustPackages без изменений.
     */
    private buildPackageUpdates(
        userId: number,
        base: OrderLine,
        supp: OrderLine | null,
        newBasePkg: number,
        newReorderPkg: number,
    ): MultiUpdate {
        const updates: LineUpdate[] = [];
        const effects: MultiUpdate['effects'] = [];

        // 1. base — если qty=0 && pkg=0 → hard-delete
        if (newBasePkg !== base.packageCount) {
            if (newBasePkg === 0 && base.quantity === 0) {
                updates.push({ old: base, new: null });
                effects.push({ type: 'delete', lineId: base.id });
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
            effects.push({ type: 'delete', lineId: supp.id });
        }
        return { updates, effects };
    }

    // ── aggregateForPool: REORDER формула ──

    override aggregateForPool() {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;
        let totalOrderedWithPackages = 0;
        const pack = this.item.packAmount ?? 0;
        for (const line of this.lines) {
            if (!line.isActive) continue;
            const bq = line.baseQuantity ?? 0;
            const qty = Number(line.quantity) + Number(line.packageCount) * pack;
            totalBaseQuantity += bq;
            supplementClaimed += Math.max(0, line.quantity - bq);
            totalOrderedQuantity += line.quantity;
            totalOrderedWithPackages += qty;
        }
        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity, totalOrderedWithPackages };
    }
}
