/**
 * StageStrategy — абстрактный aggregate для всех стадий закупки.
 *
 * Архитектура:
 *   StageStrategy (abstract)
 *     └── BaseMutableStrategy (default 4 admin* метода)
 *
 * Concrete-стратегии (CollectionStrategy, ReorderStrategy, PaymentPlusStrategy)
 * и фабрика makeStrategy живут в `./concrete-strategies.ts` — так разрывается
 * циклическая зависимость: concrete → abstract (этот файл), а не наоборот.
 */
import type { PurchaseFulfillmentStatus } from '../../index';
import { OrderLine } from '../order-line';
import { computeAmountDue, computeAmountDueWithPackages } from '../pricing';
import type { OrderLineVO, PoolAggregation, PurchaseItem } from '../types';
import { getStageConfig, type StageConfig } from '../stages';
import {
    activeUserLines,
    aggregateForPool,
    applySetPackagesOnLine,
    applyZeroOutOnLine,
    err,
    findBaseLine,
    findSupplementLine,
    findSupplementLineForStage,
    makeNewLine,
    makeUpsertEffect,
    ok,
    type LineUpdate,
    type MultiUpdate,
} from './atomic';

// ── Abstract base ───────────────────────────────────────────────────

export abstract class StageStrategy {
    protected readonly item: PurchaseItem;
    protected readonly lines: readonly OrderLine[];
    abstract readonly stageName: PurchaseFulfillmentStatus;

    constructor(item: PurchaseItem, lines: readonly OrderLine[]) {
        this.item = item;
        this.lines = lines;
    }

    // 3 abstract methods (реализуются конкретными стратегиями)

    /** Изменить qty пользователя (delta>0 / delta<0). */
    abstract adjust(userId: number, delta: number): MultiUpdate;

    /** Изменить кол-во упаковок (delta>0 / delta<0). */
    abstract adjustPackages(userId: number, delta: number): MultiUpdate;

    /** Агрегировать строки для расчёта пула. */
    abstract aggregateForPool(): PoolAggregation;

    // 4 admin* метода (default в BaseMutableStrategy)

    abstract adminAdd(userId: number, amount: number): MultiUpdate;
    abstract adminDecrease(userId: number, amount: number): MultiUpdate;
    abstract adminSetQuantity(userId: number, qty: number): MultiUpdate;
    abstract adminDelete(userId: number): MultiUpdate;
    abstract adminAdjustPackages(userId: number, delta: number): MultiUpdate;

    // ── Protected helpers (доступны наследникам) ──

    protected get cfg(): StageConfig {
        return getStageConfig(this.item.fulfillmentStatus);
    }

    protected findBaseLine(userId: number): OrderLine | null {
        return findBaseLine(this.lines, userId);
    }

    protected findSupplementLine(userId: number): OrderLine | null {
        return findSupplementLine(this.lines, userId);
    }

    protected findSupplementLineForStage(userId: number): OrderLine | null {
        return findSupplementLineForStage(this.lines, userId, this.item.fulfillmentStatus);
    }

    protected activeUserLines(userId: number): OrderLine[] {
        return activeUserLines(this.lines, userId);
    }

    protected toActiveVOs(): OrderLineVO[] {
        return this.lines.filter((l) => l.isActive).map((l) => l.toVO());
    }
}

// ── BaseMutableStrategy: default admin* методы ──────────────────────

/**
 * Промежуточный abstract class с default реализациями 4 admin* методов.
 * Логика идентична для всех 3 стратегий, поэтому живёт здесь один раз.
 */
export abstract class BaseMutableStrategy extends StageStrategy {
    // ── adminAdd: base > supp > create new COLLECTION ──

    override adminAdd(userId: number, amount: number): MultiUpdate {
        if (amount <= 0) return err({ code: 'negative', message: 'Размер добавки должен быть положительным' });
        const target = this.findBaseLine(userId) ?? this.findSupplementLine(userId);
        if (target) {
            const newQty = target.quantity + amount;
            const amountDue = target.isBase
                ? computeAmountDueWithPackages(newQty, target.packageCount, this.item)
                : computeAmountDue(newQty, this.item);
            return {
                updates: [{ old: target, new: target.withQuantity(newQty, amountDue) }],
                effects: [
                    makeUpsertEffect(this.item, userId, target.createdOnStage, newQty, amountDue, target.packageCount),
                ],
            };
        }
        // Нет строк → создаём COLLECTION
        const amountDue = computeAmountDue(amount, this.item);
        const newLine = makeNewLine(this.item, userId, 'COLLECTION', amount, amountDue, 0);
        return {
            updates: [{ old: null, new: newLine }],
            effects: [makeUpsertEffect(this.item, userId, 'COLLECTION', amount, amountDue, 0)],
        };
    }

    // ── adminDecrease: supplement-first sort ──

    override adminDecrease(userId: number, amount: number): MultiUpdate {
        if (amount <= 0) return err({ code: 'negative', message: 'Размер убавки должен быть положительным' });
        const userLines = this.activeUserLines(userId);
        if (userLines.length === 0) return err({ code: 'negative', message: 'У юзера нет заказа для убавки' });
        const totalQty = userLines.reduce((s, l) => s + l.quantity, 0);
        if (amount > totalQty) {
            return err({ code: 'negative', message: 'Нельзя убавить больше, чем есть в заказе' });
        }
        // supplement-first: isBase идут после isSupplement
        const sorted = [...userLines].sort((a, b) => Number(a.isBase) - Number(b.isBase));
        const updates: LineUpdate[] = [];
        const effects: MultiUpdate['effects'] = [];
        let remaining = amount;
        for (const line of sorted) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, line.quantity);
            const newQty = line.quantity - take;
            remaining -= take;
            if (newQty > 0) {
                const amountDue = line.isBase
                    ? computeAmountDueWithPackages(newQty, line.packageCount, this.item)
                    : computeAmountDue(newQty, this.item);
                updates.push({ old: line, new: line.withQuantity(newQty, amountDue) });
                effects.push(
                    makeUpsertEffect(this.item, userId, line.createdOnStage, newQty, amountDue, line.packageCount),
                );
            } else {
                // qty=0 → zeroOut (delete or keep packages)
                const r = applyZeroOutOnLine(line);
                updates.push(...r.updates);
                effects.push(...r.effects);
            }
        }
        return { updates, effects };
    }

    // ── adminSetQuantity: схлопывает в одну COLLECTION с total pkg ──

    override adminSetQuantity(userId: number, qty: number): MultiUpdate {
        if (qty < 0) return err({ code: 'negative', message: 'Количество не может быть отрицательным' });
        const userLines = this.activeUserLines(userId);
        const currentTotal = userLines.reduce((s, l) => s + l.quantity, 0);
        if (qty === 0) {
            if (userLines.length === 0) return ok();
            // zeroOut каждую (с сохранением упаковок)
            const updates: LineUpdate[] = [];
            const effects: MultiUpdate['effects'] = [];
            for (const line of userLines) {
                const r = applyZeroOutOnLine(line);
                updates.push(...r.updates);
                effects.push(...r.effects);
            }
            return { updates, effects };
        }
        if (currentTotal === qty) return ok();

        // Схлопываем в одну COLLECTION с total packageCount
        const totalPackageCount = userLines.reduce((s, l) => s + l.packageCount, 0);
        const amountDue = computeAmountDueWithPackages(qty, totalPackageCount, this.item);
        const newLine = makeNewLine(this.item, userId, 'COLLECTION', qty, amountDue, totalPackageCount);

        const updates: LineUpdate[] = [
            ...userLines.map((l) => ({ old: l, new: null }) as LineUpdate),
            { old: null, new: newLine },
        ];
        const effects: MultiUpdate['effects'] = [
            ...userLines.map((l) => ({ type: 'delete' as const, lineId: l.id })),
            makeUpsertEffect(this.item, userId, 'COLLECTION', qty, amountDue, totalPackageCount),
        ];
        return { updates, effects };
    }

    // ── adminDelete: удаляет все активные строки пользователя ──

    override adminDelete(userId: number): MultiUpdate {
        const userLines = this.activeUserLines(userId);
        if (userLines.length === 0) return ok();
        return {
            updates: userLines.map((l) => ({ old: l, new: null }) as LineUpdate),
            effects: userLines.map((l) => ({ type: 'delete' as const, lineId: l.id })),
        };
    }

    // ── adminAdjustPackages: override кол-ва упаковок на COLLECTION-строке ──

    /**
     * Admin: изменить кол-во упаковок на delta в обход stage-правил/пула/лимита.
     * Упаковки всегда живут на COLLECTION-строке (инвариант модели).
     *
     * delta>0 — добавить к существующей base-строке (или создать COLLECTION с qty=0).
     * delta<0 — убавить от base-строки; newPkg=0 + qty=0 → hard delete (см. applySetPackagesOnLine).
     * Нельзя убавить больше, чем есть packageCount.
     */
    override adminAdjustPackages(userId: number, delta: number): MultiUpdate {
        if (delta === 0) return ok();
        if (!this.item.packAmount) {
            return err({ code: 'no_package', message: 'У товара не указан размер упаковки поставщика' });
        }
        const base = this.findBaseLine(userId);
        const currentPkg = base?.packageCount ?? 0;
        if (delta < 0) {
            if (!base || currentPkg === 0) {
                return err({ code: 'negative', message: 'У участника нет упаковок для убавки' });
            }
            if (-delta > currentPkg) {
                return err({
                    code: 'negative',
                    message: 'Нельзя убавить упаковок больше, чем есть в заказе',
                });
            }
        }
        const newPkg = currentPkg + delta;
        return applySetPackagesOnLine(this.item, base ?? null, userId, true, newPkg);
    }
}

// ── Back-compat shim для фронтенда ──────────────────────────────────

/**
 * Возвращает «стратегию» этапа для совместимости с фронтом (3 файла).
 * Фронт вызывает `getStageStrategy(stage).aggregateForPool(vos)`.
 *
 * Реализация: static singleton map — aggregateForPool не требует item/lines,
 * только stage+vos. Не аллоцируем новый объект на каждый вызов.
 *
 * Shim — НЕ настоящая StageStrategy (aggregateForPool принимает vos).
 * Возвращаемый тип — узкий интерфейс, чтобы TS не ругался на несовпадение сигнатур.
 */
export interface StageStrategyShim {
    readonly stageName: PurchaseFulfillmentStatus;
    aggregateForPool(vos: OrderLineVO[]): PoolAggregation;
}

const STATIC_STRATEGIES: Record<PurchaseFulfillmentStatus, StageStrategyShim> = {
    COLLECTION: { stageName: 'COLLECTION', aggregateForPool: (vos) => aggregateForPool('COLLECTION', vos) },
    REORDER: { stageName: 'REORDER', aggregateForPool: (vos) => aggregateForPool('REORDER', vos) },
    PAYMENT: { stageName: 'PAYMENT', aggregateForPool: (vos) => aggregateForPool('PAYMENT', vos) },
    SUPPLIER_ASSEMBLY: {
        stageName: 'SUPPLIER_ASSEMBLY',
        aggregateForPool: (vos) => aggregateForPool('SUPPLIER_ASSEMBLY', vos),
    },
    PREPARING_SHIPMENT_RF: {
        stageName: 'PREPARING_SHIPMENT_RF',
        aggregateForPool: (vos) => aggregateForPool('PREPARING_SHIPMENT_RF', vos),
    },
    IN_TRANSIT_RF: { stageName: 'IN_TRANSIT_RF', aggregateForPool: (vos) => aggregateForPool('IN_TRANSIT_RF', vos) },
    IN_TRANSIT_TO_ORGANIZER: {
        stageName: 'IN_TRANSIT_TO_ORGANIZER',
        aggregateForPool: (vos) => aggregateForPool('IN_TRANSIT_TO_ORGANIZER', vos),
    },
    PACKAGING: { stageName: 'PACKAGING', aggregateForPool: (vos) => aggregateForPool('PACKAGING', vos) },
    READY_FOR_PICKUP: {
        stageName: 'READY_FOR_PICKUP',
        aggregateForPool: (vos) => aggregateForPool('READY_FOR_PICKUP', vos),
    },
};

export function getStageStrategy(stage: PurchaseFulfillmentStatus): StageStrategyShim {
    return STATIC_STRATEGIES[stage];
}
