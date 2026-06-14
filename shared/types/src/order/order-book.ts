/**
 * OrderBook — aggregate root (immutable) для одного PurchaseItem.
 *
 * Архитектура (v3):
 *  - `lines` + `item` — единственное состояние.
 *  - Queries (1-2 строки каждая) — чистые find/filter/map.
 *  - Operations (3-5 строк каждая) — каждая вызывает `runStrategy(closure)`.
 *  - `runStrategy` — единый pipeline: makeStrategy → closure(strategy) → commitBatch.
 *  - Вся доменная логика (REORDER split, admin, команды) — в `strategies/`.
 *  - UI-проекция — в `order-display.ts`.
 */
import { OrderLine, type OrderLineProps } from './order-line';
import { computePoolInfo, computeRawPool } from './pool';
import { computeSupplierLimitInfo } from './limit';
import { getStageConfig } from './stages';
import { mergeLines } from './aggregation';
import { buildDisplayContext } from './order-display';
import { aggregateForPool, applyUpdates, toActiveVOs, type LineUpdate, type MultiUpdate } from './strategies/atomic';
import { makeStrategy } from './strategies/concrete-strategies';
import { StageStrategy } from './strategies/stage-strategy';
import type {
    AggregatedOrder,
    OrderDisplayContext,
    OrderEffect,
    OrderError,
    PoolInfo,
    PoolAggregation,
    PurchaseItem,
} from './types';

/** Результат immutable-операции: новый снимок + изменения для persistence, либо ошибка. */
export type AdjustResult = { ok: true; book: OrderBook; changes: OrderEffect[] } | { ok: false; error: OrderError };

// ── Aggregate ───────────────────────────────────────────────────────

export class OrderBook {
    readonly item: PurchaseItem;
    readonly lines: readonly OrderLine[];

    private constructor(item: PurchaseItem, lines: readonly OrderLine[]) {
        this.item = item;
        this.lines = lines;
    }

    static create(item: PurchaseItem, lines: readonly (OrderLineProps | OrderLine)[] = []): OrderBook {
        const orderLines = Object.freeze(
            lines.map((l) => (l instanceof OrderLine ? l : OrderLine.create(l))),
        ) as readonly OrderLine[];
        return new OrderBook(item, orderLines);
    }

    // ── Queries ──────────────────────────────────────────────────────

    get activeLines(): readonly OrderLine[] {
        return this.lines.filter((l) => l.isActive);
    }

    baseLineFor(userId: number): OrderLine | null {
        return this.activeLines.find((l) => l.userId === userId && l.isBase) ?? null;
    }

    supplementLineFor(userId: number): OrderLine | null {
        return this.activeLines.find((l) => l.userId === userId && l.isSupplement) ?? null;
    }

    /** Supplement-строка юзера, привязанная к конкретному этапу (для PAYMENT+). */
    supplementLineForStage(userId: number, stage: import('../index').PurchaseFulfillmentStatus): OrderLine | null {
        return (
            this.activeLines.find((l) => l.userId === userId && l.isSupplement && l.createdOnStage === stage) ?? null
        );
    }

    private userLines(userId: number): readonly OrderLine[] {
        return this.activeLines.filter((l) => l.userId === userId);
    }

    totalFor(userId: number): AggregatedOrder {
        return mergeLines(this.userLines(userId).map((l) => l.toVO()));
    }

    get total(): AggregatedOrder {
        return mergeLines(this.activeLines.map((l) => l.toVO()));
    }

    /** Pool aggregation — делегирует текущей StageStrategy. */
    private poolAggregation(): PoolAggregation {
        return makeStrategy(this.item, this.lines).aggregateForPool();
    }

    get remainder(): number | null {
        if (!getStageConfig(this.item.fulfillmentStatus).poolApplies) return null;
        return computeRawPool({
            targetRemainder: this.item.targetRemainder,
            packSize: this.item.supplierPackageAmount,
            aggregation: this.poolAggregation(),
        });
    }

    poolFor(userId: number): PoolInfo {
        const cfg = getStageConfig(this.item.fulfillmentStatus);
        if (!cfg.poolApplies) {
            return {
                pool: null,
                maxAllowed: Number.POSITIVE_INFINITY,
                canAddMore: Number.POSITIVE_INFINITY,
                supplementClaimed: 0,
                totalBaseQuantity: 0,
                totalOrderedQuantity: 0,
            };
        }
        const baseQty = this.userLines(userId)
            .filter((l) => l.isBase)
            .reduce((s, l) => s + l.quantity, 0);
        const suppQty = this.userLines(userId)
            .filter((l) => l.isSupplement)
            .reduce((s, l) => s + l.quantity, 0);
        const currentQty = cfg.target === 'base' ? baseQty + suppQty : suppQty;
        const poolInfo = computePoolInfo({
            targetRemainder: this.item.targetRemainder,
            packSize: this.item.supplierPackageAmount,
            aggregation: this.poolAggregation(),
            currentQty,
        });

        // Supplier limit (если задан) — действует как жёсткий верх для всех этапов.
        // Применяется даже когда poolApplies=false (COLLECTION): используем
        // aggregateForPool с явным stage, чтобы не дублировать inline-цикл.
        if (this.item.supplierLimit != null) {
            const aggregation = cfg.poolApplies
                ? poolInfo.totalOrderedQuantity > 0
                    ? {
                          totalBaseQuantity: poolInfo.totalBaseQuantity,
                          supplementClaimed: poolInfo.supplementClaimed,
                          totalOrderedQuantity: poolInfo.totalOrderedQuantity,
                      }
                    : this.poolAggregation()
                : aggregateForPool('COLLECTION', toActiveVOs(this.lines));
            const limitInfo = computeSupplierLimitInfo({
                supplierLimit: this.item.supplierLimit,
                aggregation,
                currentQty,
            });
            if (limitInfo.maxAllowed < poolInfo.maxAllowed) {
                return {
                    ...poolInfo,
                    maxAllowed: limitInfo.maxAllowed,
                    canAddMore: limitInfo.canAddMore,
                };
            }
        }

        return poolInfo;
    }

    displayContextFor(userId: number): OrderDisplayContext {
        return buildDisplayContext(this.item, this.lines, userId);
    }

    /** Заморозить baseQuantity/basePackageCount у активных COLLECTION-строк (COLLECTION→REORDER). */
    freezeBaseQuantities(): OrderBook {
        const frozen = this.lines.map((l) => (l.isBase && l.isActive ? l.freeze() : l));
        return this.withLines(frozen);
    }

    // ── Operations (user) ──────────────────────────────────────────

    /** Изменить количество. Делегирует в StageStrategy.adjust (которая знает про split). */
    adjust(userId: number, delta: number): AdjustResult {
        if (delta === 0) return ok(this);
        return this.runStrategy((s) => s.adjust(userId, delta));
    }

    /** Изменить количество упаковок. */
    adjustPackages(userId: number, delta: number): AdjustResult {
        if (delta === 0) return ok(this);
        if (!this.item.supplierPackageAmount) {
            return {
                ok: false,
                error: { code: 'no_package', message: 'У товара не указан размер упаковки поставщика' },
            };
        }
        return this.runStrategy((s) => s.adjustPackages(userId, delta));
    }

    // ── Operations (admin) ──────────────────────────────────────────

    adminDelete(userId: number): AdjustResult {
        return this.runStrategy((s) => s.adminDelete(userId));
    }

    adminAdd(userId: number, amount: number): AdjustResult {
        if (amount <= 0) return neg('Размер добавки должен быть положительным');
        return this.runStrategy((s) => s.adminAdd(userId, amount));
    }

    adminDecrease(userId: number, amount: number): AdjustResult {
        if (amount <= 0) return neg('Размер убавки должен быть положительным');
        return this.runStrategy((s) => s.adminDecrease(userId, amount));
    }

    adminSetQuantity(userId: number, qty: number): AdjustResult {
        if (qty < 0) return neg('Количество не может быть отрицательным');
        return this.runStrategy((s) => s.adminSetQuantity(userId, qty));
    }

    // ── Internal: единый pipeline мутации ─────────────────────────

    /** Создаёт strategy и вызывает closure с ней. Pipeline: strategy → MultiUpdate → commit. */
    private runStrategy(closure: (s: StageStrategy) => MultiUpdate): AdjustResult {
        const strategy = makeStrategy(this.item, this.lines);
        const multi = closure(strategy);
        if (multi.error) return { ok: false, error: multi.error };
        return this.commitBatch(multi.updates, multi.effects);
    }

    private commitBatch(updates: LineUpdate[], effects: OrderEffect[]): AdjustResult {
        if (updates.length === 0) return ok(this);
        return {
            ok: true,
            book: this.withLines(applyUpdates(this.lines, updates)),
            changes: effects,
        };
    }

    private withLines(lines: readonly OrderLine[]): OrderBook {
        return new OrderBook(this.item, Object.freeze(lines) as readonly OrderLine[]);
    }
}

// ── Pure helpers ────────────────────────────────────────────────────

function ok(book: OrderBook): AdjustResult {
    return { ok: true, book, changes: [] };
}

function neg(message: string): AdjustResult {
    return { ok: false, error: { code: 'negative', message } };
}
