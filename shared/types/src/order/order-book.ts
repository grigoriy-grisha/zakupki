/**
 * OrderBook — immutable aggregate root для одного PurchaseItem.
 *
 * Содержит ВСЕ строки товара (всех пользователей) — только так aggregate может
 * обеспечить инвариант пула добора (он охватывает строки всех юзеров).
 *
 * Immutable: любая операция (adjust/adjustPackages/freezeBaseQuantities) возвращает
 * НОВЫЙ OrderBook; исходный снимок не меняется. Возвращает changes (OrderEffect[])
 * для persistence-слоя — сама модель про БД не знает.
 *
 * Правила по этапам (COLLECTION/REORDER/PAYMENT+) — **приватная таблица STAGE_RULES**
 * внутри файла (без иерархии классов, без Strategy-интерфейса). Каждое правило —
 * просто объект с методами; aggregate выбирает rule по `item.fulfillmentStatus`.
 */
import type { PurchaseFulfillmentStatus } from '../index';
import {
    buildOrderQtyOptions,
    countFullSupplierPacks,
    getOrderQuantityStep,
    getPackDiscountPricingInfo,
    getSupplementStep,
    isSupplementPhase,
} from '../index';

import { mergeLines } from './aggregation';
import { OrderLine, type OrderLineProps } from './order-line';
import { computeAmountDue, computeAmountDueWithPackages, computePackagePrice } from './pricing';
import { computePoolInfo, computeRawPool } from './pool';
import type { OrderLineVO } from './types';
import type {
    AggregatedOrder,
    OrderDisplayContext,
    OrderEffect,
    OrderError,
    PoolInfo,
    PurchaseItem,
} from './types';
import { getUnitShortName } from './utils';

/** id для ещё не сохранённой строки (upsert-эффект ключуется по item+user+stage, не по id). */
const NEW_LINE_ID = 0;

/** Результат immutable-операции: новый снимок + изменения для persistence, либо ошибка. */
export type AdjustResult =
    | { ok: true; book: OrderBook; changes: OrderEffect[] }
    | { ok: false; error: OrderError };

type LineAction = 'add_new' | 'increase' | 'decrease';
type TargetLineType = 'base' | 'supplement';
type ZeroQuantityAction = 'hard_delete' | 'zero_out';

interface PoolAggregation {
    totalBaseQuantity: number;
    supplementClaimed: number;
    totalOrderedQuantity: number;
}

/** Правила этапа: всё, что раньше жил в StageStrategy, в одном объекте. */
interface StageRule {
    target: TargetLineType;
    onZero: ZeroQuantityAction;
    poolApplies: boolean;
    canAddPackages: boolean;
    canAddNew: boolean;
    /** Можно ли увеличить количество поверх существующей строки (COLLECTION — да). */
    canIncrease: boolean;
    /** Можно ли уменьшить количество (COLLECTION — да, PAYMENT+ — нет). */
    canDecrease: boolean;
    /** Агрегирует строки (активные) для расчёта пула — зависит от этапа. */
    aggregate(lines: OrderLineVO[]): PoolAggregation;
}

const COLLECTION_RULE: StageRule = {
    target: 'base',
    onZero: 'hard_delete',
    poolApplies: false,
    canAddPackages: true,
    canAddNew: true,
    canIncrease: true,
    canDecrease: true,
    aggregate(lines) {
        let totalOrderedQuantity = 0;
        for (const line of mergeActiveLines(lines)) {
            totalOrderedQuantity += line.quantity;
        }
        return { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity };
    },
};

/**
 * REORDER: добор из остатка + убавка добора/базы.
 *
 * - `delta > 0` идёт в supplement-строку (`createdOnStage: 'REORDER'`);
 *   COLLECTION-строка отдельно, она не трогается.
 * - `delta < 0` сначала убавляет supplement-строку (до 0 → hard_delete),
 *   потом COLLECTION-строку (до 0 → hard_delete).
 * - Упаковки живут в COLLECTION-строке.
 * - `onZero: 'hard_delete'` — «опустить до 0» = удалить строку.
 */
const REORDER_RULE: StageRule = {
    target: 'base',
    onZero: 'hard_delete',
    poolApplies: true,
    canAddPackages: true,
    canAddNew: true,
    canIncrease: true,
    canDecrease: true,
    aggregate(lines) {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;
        for (const line of mergeActiveLines(lines)) {
            const bq = line.baseQuantity ?? 0;
            totalBaseQuantity += bq;
            supplementClaimed += Math.max(0, line.quantity - bq);
            totalOrderedQuantity += line.quantity;
        }
        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity };
    },
};

const PAYMENT_PLUS_RULE: StageRule = {
    target: 'supplement',
    onZero: 'hard_delete',
    poolApplies: true,
    canAddPackages: false,
    canAddNew: true,
    // На PAYMENT+ target='supplement' — adjust(+N)/(-N) работает со supplement-строкой.
    // COLLECTION-строка защищена тем, что она не target.
    canIncrease: true,
    canDecrease: true,
    aggregate(lines) {
        let totalBaseQuantity = 0;
        let supplementClaimed = 0;
        let totalOrderedQuantity = 0;
        for (const line of mergeActiveLines(lines)) {
            totalOrderedQuantity += line.quantity;
            if (line.createdOnStage === 'COLLECTION') totalBaseQuantity += line.quantity;
            else supplementClaimed += line.quantity;
        }
        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity };
    },
};

/** Все PAYMENT+ этапы (PAYMENT и далее) используют одни правила. */
const PAYMENT_PLUS_STATUSES = new Set<PurchaseFulfillmentStatus>([
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP',
]);

const STAGE_RULES: Record<PurchaseFulfillmentStatus, StageRule> = {
    COLLECTION: COLLECTION_RULE,
    REORDER: REORDER_RULE,
    PAYMENT: PAYMENT_PLUS_RULE,
    SUPPLIER_ASSEMBLY: PAYMENT_PLUS_RULE,
    PREPARING_SHIPMENT_RF: PAYMENT_PLUS_RULE,
    IN_TRANSIT_RF: PAYMENT_PLUS_RULE,
    IN_TRANSIT_TO_ORGANIZER: PAYMENT_PLUS_RULE,
    PACKAGING: PAYMENT_PLUS_RULE,
    READY_FOR_PICKUP: PAYMENT_PLUS_RULE,
};

// ── Приватные helpers ──────────────────────────────────────────────

function mergeActiveLines(lines: OrderLineVO[]): OrderLineVO[] {
    return lines.filter((l) => l.status !== 'CANCELLED');
}

/** Общая валидация пула для REORDER и PAYMENT+ (используется в adjust). */
function validatePool(
    item: PurchaseItem,
    newQty: number,
    currentQty: number,
    aggregation: PoolAggregation,
): OrderError | null {
    const pool = computeRawPool({
        targetRemainder: item.targetRemainder,
        packSize: item.supplierPackageAmount,
        aggregation,
    });
    if (pool == null) return null;

    const maxAllowed = pool + currentQty;
    if (newQty > maxAllowed + 1e-9) {
        const canAddMore = Math.max(0, maxAllowed - currentQty);
        const unitShort = getUnitShortName(item.unitCode);
        return {
            code: 'pool_exceeded',
            message: formatPoolExceededMessage(canAddMore, unitShort),
            canAddMore,
            unitShort,
        };
    }
    return null;
}

function formatPoolExceededMessage(canAddMore: number, unitShort: string): string {
    const formatted = canAddMore % 1 === 0 ? String(canAddMore) : canAddMore.toFixed(3).replace(/\.?0+$/, '');
    return `Нельзя добавить больше остатка. Можно ещё: ${formatted} ${unitShort}`;
}

function checkStagePermission(rule: StageRule, action: LineAction): OrderError | null {
    switch (action) {
        case 'add_new':
            return rule.canAddNew
                ? null
                : { code: 'forbidden', message: 'На этом этапе нельзя добавить новый товар' };
        case 'increase':
            return rule.canIncrease
                ? null
                : { code: 'forbidden', message: 'На этом этапе нельзя увеличить заказ' };
        case 'decrease':
            return rule.canDecrease
                ? null
                : { code: 'forbidden', message: 'На этом этапе нельзя уменьшить заказ' };
    }
}

// ── Aggregate ──────────────────────────────────────────────────────

export class OrderBook {
    readonly item: PurchaseItem;
    readonly lines: readonly OrderLine[];

    private constructor(item: PurchaseItem, lines: readonly OrderLine[]) {
        this.item = item;
        this.lines = lines;
    }

    /** Создать книгу из PurchaseItem и строк (props или готовых OrderLine). */
    static create(item: PurchaseItem, lines: readonly (OrderLineProps | OrderLine)[] = []): OrderBook {
        const orderLines = Object.freeze(
            lines.map((l) => (l instanceof OrderLine ? l : OrderLine.create(l))),
        ) as readonly OrderLine[];
        return new OrderBook(item, orderLines);
    }

    // ── Этап ──

    /** Правила текущего этапа (приватный API). */
    private get rule(): StageRule {
        return PAYMENT_PLUS_STATUSES.has(this.item.fulfillmentStatus)
            ? PAYMENT_PLUS_RULE
            : STAGE_RULES[this.item.fulfillmentStatus];
    }

    // ── Строки (чтение) ──

    get activeLines(): readonly OrderLine[] {
        return this.lines.filter((l) => l.isActive);
    }

    baseLineFor(userId: number): OrderLine | null {
        return this.activeLines.find((l) => l.userId === userId && l.isBase) ?? null;
    }

    supplementLineFor(userId: number): OrderLine | null {
        return this.activeLines.find((l) => l.userId === userId && l.isSupplement) ?? null;
    }

    /**
     * Supplement-строка юзера, привязанная к конкретному этапу.
     * На PAYMENT+ у юзера могут быть supplement-строки с разным `createdOnStage`
     * (REORDER из прошлого этапа + новые PAYMENT/SUPPLIER_ASSEMBLY/...).
     * adjust должен писать в строку текущего этапа, а не в REORDER.
     */
    supplementLineForStage(userId: number, stage: PurchaseFulfillmentStatus): OrderLine | null {
        return (
            this.activeLines.find((l) => l.userId === userId && l.isSupplement && l.createdOnStage === stage) ?? null
        );
    }

    // ── Агрегация ──

    totalFor(userId: number): AggregatedOrder {
        const userLines = this.activeLines.filter((l) => l.userId === userId);
        return mergeLines(userLines.map((l) => l.toVO()));
    }

    get total(): AggregatedOrder {
        return mergeLines(this.activeLines.map((l) => l.toVO()));
    }

    // ── Пул добора ──

    get remainder(): number | null {
        if (!this.rule.poolApplies) return null;
        return computeRawPool({
            targetRemainder: this.item.targetRemainder,
            packSize: this.item.supplierPackageAmount,
            aggregation: this.poolAggregation(),
        });
    }

    poolFor(userId: number): PoolInfo {
        if (!this.rule.poolApplies) {
            return {
                pool: null,
                maxAllowed: Number.POSITIVE_INFINITY,
                canAddMore: Number.POSITIVE_INFINITY,
                supplementClaimed: 0,
                totalBaseQuantity: 0,
                totalOrderedQuantity: 0,
            };
        }
        // currentQty = общее количество юзера по этому товару.
        // На REORDER база и добор живут в РАЗНЫХ строках, поэтому суммируем обе.
        // На PAYMENT+ target='supplement', базы нет, берём только supplement.
        const baseLine = this.baseLineFor(userId);
        const supplementLine = this.supplementLineFor(userId);
        const currentQty =
            this.rule.target === 'base'
                ? (baseLine?.quantity ?? 0) + (supplementLine?.quantity ?? 0)
                : (supplementLine?.quantity ?? 0);
        return computePoolInfo({
            targetRemainder: this.item.targetRemainder,
            packSize: this.item.supplierPackageAmount,
            aggregation: this.poolAggregation(),
            currentQty,
        });
    }

    private poolAggregation(): PoolAggregation {
        return this.rule.aggregate(this.activeLines.map((l) => l.toVO()));
    }

    // ── Снимки состояния ──────────────────────────────────────────

    /**
     * Заморозить baseQuantity у активных COLLECTION-строк (COLLECTION→REORDER).
     * Возвращает новый OrderBook; исходный не меняется.
     */
    freezeBaseQuantities(): OrderBook {
        const frozen = this.lines.map((l) => (l.isBase && l.isActive ? l.freeze() : l));
        return this.withLines(frozen);
    }

    /**
     * Контекст для UI заказа (кнопки, лейблы, разрешения, пул).
     * Та же арифметика, что и в buildItemOrderContext (frontend) — единый источник истины.
     */
    displayContextFor(userId: number): OrderDisplayContext {
        const item = this.item;
        const rule = this.rule;
        const shortName = getUnitShortName(item.unitCode);
        const multiplicity = item.multiplicity || 1;
        const price = item.priceOverride ?? item.pricePerUnit;
        const minPackageAmount = item.minPackageAmount;
        const minPackageUnit = item.minPackageUnit ?? null;
        const packSize = item.supplierPackageAmount;

        const baseLine = this.baseLineFor(userId);
        const supplementLine = this.supplementLineFor(userId);
        const baseQty = baseLine?.quantity ?? 0;
        const frozenBase = baseLine?.baseQuantity ?? 0;
        const supplementQty = supplementLine?.quantity ?? 0;
        const currentQuantity = baseQty + supplementQty;
        const currentPackageCount = baseLine?.packageCount ?? 0;

        const orderQtyOptions = buildOrderQtyOptions({
            multiplicity,
            minPackageAmount,
            minPackageUnit,
            purchaseItemMinQty: null,
            unitShort: shortName,
        });
        const regularStep = getOrderQuantityStep(orderQtyOptions);
        const activeStep = getSupplementStep({
            fulfillmentStatus: item.fulfillmentStatus,
            supplementStep: item.supplementStep,
            regularStep,
        });

        const isSupplement = isSupplementPhase(item.fulfillmentStatus);
        const poolInfo = this.poolFor(userId);
        const availablePool = poolInfo.pool;

        const hasSupplierPackage = packSize != null && packSize > 0;
        const showPackageButtons = rule.canAddPackages && hasSupplierPackage;
        const packagePrice = computePackagePrice(item);
        const packageTotal = currentPackageCount * packagePrice;

        const total = computeAmountDueWithPackages(currentQuantity, currentPackageCount, item);
        const packDiscountInfo = getPackDiscountPricingInfo(item, item.packDiscountPercent);
        const fullPacks =
            packDiscountInfo != null ? countFullSupplierPacks(currentQuantity, packDiscountInfo.packSize) : 0;

        const maxAllowed =
            availablePool != null && Number.isFinite(availablePool)
                ? availablePool + currentQuantity
                : Number.POSITIVE_INFINITY;
        const minAllowed = rule.target === 'supplement' ? frozenBase : 0;

        const hasOrder = currentQuantity > 0 || currentPackageCount > 0;
        const poolExhausted = isSupplement && availablePool != null && availablePool <= 1e-9;
        const isSoldOut = poolExhausted && !hasOrder;
        const canAdd = currentQuantity < maxAllowed;
        const canDecrease =
            currentQuantity > 0 && (rule.target === 'base' || currentQuantity > frozenBase);

        return {
            shortName,
            price,
            currentQuantity,
            currentPackageCount,
            activeStep,
            isSupplement,
            pool: poolInfo,
            isSoldOut,
            packSize,
            showPackageButtons,
            packagePrice,
            packageTotal,
            total,
            fullPacks,
            canAdd,
            canDecrease,
            hasOrder,
            maxAllowed,
            minAllowed,
        };
    }

    // ── Операции (immutable) ───────────────────────────────────────

    /**
     * Изменить количество на delta для пользователя.
     * - COLLECTION → COLLECTION-строка.
     * - REORDER → `delta > 0` идёт в supplement-строку (создаёт с `createdOnStage: 'REORDER'`),
     *   `delta < 0` сначала убавляет supplement-строку, потом COLLECTION-строку.
     * - PAYMENT+ → supplement-строка.
     * Возвращает новый OrderBook + changes, либо ошибку (исходный снимок не меняется).
     */
    adjust(userId: number, delta: number): AdjustResult {
        if (delta === 0) return { ok: true, book: this, changes: [] };

        if (this.isReorderStage()) {
            return this.adjustReorder(userId, delta);
        }

        const rule = this.rule;
        // На PAYMENT+ ищем supplement-строку ТЕКУЩЕГО этапа, иначе перепутаем с REORDER.
        const line =
            rule.target === 'base'
                ? this.baseLineFor(userId)
                : this.supplementLineForStage(userId, this.item.fulfillmentStatus);

        // На PAYMENT+ target='supplement' — у юзера может быть COLLECTION-строка
        // (замороженная), но это НЕ target. Убавлять/увеличивать её через adjust
        // нельзя, а supplement-строки нет → delta<0 должен быть запрещён.
        // На COLLECTION убавка пустого — допустимый no-op (applyZero(null) → ok).
        if (rule.target === 'supplement' && delta < 0 && !line) {
            return {
                ok: false,
                error: { code: 'forbidden', message: 'На этом этапе нельзя уменьшить заказ' },
            };
        }

        const currentQty = line?.quantity ?? 0;
        const newQty = currentQty + delta;

        const action: LineAction = !line ? 'add_new' : delta > 0 ? 'increase' : 'decrease';
        const permErr = checkStagePermission(rule, action);
        if (permErr) return { ok: false, error: permErr };

        if (delta > 0 && rule.poolApplies) {
            const poolErr = validatePool(this.item, newQty, currentQty, this.poolAggregation());
            if (poolErr) return { ok: false, error: poolErr };
        }

        if (newQty <= 0) return this.applyZero(line);
        return this.applyUpsert(rule, line, userId, newQty);
    }

    private isReorderStage(): boolean {
        return this.item.fulfillmentStatus === 'REORDER';
    }

    /**
     * REORDER: добор в supplement-строку, убавка сначала добора, потом базы.
     * COLLECTION-строка живёт отдельно (с `baseQuantity`), supplement-строка отдельно
     * (с `createdOnStage: 'REORDER'`, `baseQuantity: null`).
     */
    private adjustReorder(userId: number, delta: number): AdjustResult {
        if (delta > 0) {
            return this.reorderAdd(userId, delta);
        }
        // delta < 0: сначала supplement, потом COLLECTION
        const supplementLine = this.supplementLineFor(userId);
        if (supplementLine && supplementLine.quantity > 0) {
            return this.reorderDecreaseSupplement(userId, supplementLine, delta);
        }
        const baseLine = this.baseLineFor(userId);
        if (baseLine && baseLine.quantity > 0) {
            return this.reorderDecreaseBase(userId, baseLine, delta);
        }
        // нечего убавлять
        return { ok: true, book: this, changes: [] };
    }

    private reorderAdd(userId: number, delta: number): AdjustResult {
        const rule = this.rule;
        // permission: add_new если строки нет, иначе increase
        const supplementLine = this.supplementLineFor(userId);
        const action: LineAction = !supplementLine ? 'add_new' : 'increase';
        const permErr = checkStagePermission(rule, action);
        if (permErr) return { ok: false, error: permErr };

        const baseLine = this.baseLineFor(userId);
        const baseFrozen = baseLine?.baseQuantity ?? 0;
        const currentBaseQty = baseLine?.quantity ?? 0;
        // gap в COLLECTION: если юзер убавил базу на REORDER — сначала заполняем её.
        const baseGap = Math.max(0, baseFrozen - currentBaseQty);
        const fillBase = Math.min(delta, baseGap);
        const spillover = delta - fillBase;

        if (rule.poolApplies) {
            // общий currentQty юзера = base + supplement
            const currentSuppQty = supplementLine?.quantity ?? 0;
            const userCurrent = currentBaseQty + currentSuppQty;
            const userNew = (currentBaseQty + fillBase) + (currentSuppQty + spillover);
            const poolErr = validatePool(this.item, userNew, userCurrent, this.poolAggregation());
            if (poolErr) return { ok: false, error: poolErr };
        }

        let lines = [...this.lines];
        const changes: OrderEffect[] = [];

        // 1. Заполняем COLLECTION до baseQuantity (если есть gap и есть что заполнить).
        if (fillBase > 0 && baseLine) {
            const newBaseQty = currentBaseQty + fillBase;
            const amountDue = computeAmountDueWithPackages(newBaseQty, baseLine.packageCount, this.item);
            const newBaseLine = baseLine.withQuantity(newBaseQty, amountDue);
            lines = lines.map((l) => (l === baseLine ? newBaseLine : l));
            changes.push({
                type: 'upsert',
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage: 'COLLECTION',
                quantity: newBaseQty,
                amountDue,
                packageCount: baseLine.packageCount,
            });
        }

        // 2. Spillover → REORDER-supplement (создать или увеличить).
        if (spillover > 0) {
            const currentSuppQty = supplementLine?.quantity ?? 0;
            const newSuppQty = currentSuppQty + spillover;
            const amountDue = computeAmountDue(newSuppQty, this.item);
            const newSuppLine = supplementLine
                ? supplementLine.withQuantity(newSuppQty, amountDue)
                : this.makeLine(userId, 'REORDER', newSuppQty, amountDue, 0);
            lines = supplementLine ? lines.map((l) => (l === supplementLine ? newSuppLine : l)) : [...lines, newSuppLine];
            changes.push({
                type: 'upsert',
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage: 'REORDER',
                quantity: newSuppQty,
                amountDue,
                packageCount: 0,
            });
        }

        return { ok: true, book: this.withLines(lines), changes };
    }

    private reorderDecreaseSupplement(
        userId: number,
        line: OrderLine,
        delta: number,
    ): AdjustResult {
        const newQty = line.quantity + delta; // delta<0
        if (newQty > 0) {
            const amountDue = computeAmountDueWithPackages(newQty, line.packageCount, this.item);
            return {
                ok: true,
                book: this.withLines(this.replaceLine(line, line.withQuantity(newQty, amountDue))),
                changes: [
                    {
                        type: 'upsert',
                        purchaseItemId: line.purchaseItemId,
                        userId,
                        createdOnStage: 'REORDER',
                        quantity: newQty,
                        amountDue,
                        packageCount: line.packageCount,
                    },
                ],
            };
        }
        // <=0 — единая логика через qtyZeroEffect: пакеты сохраняются, иначе delete.
        const { effect, updated } = this.qtyZeroEffect(line);
        const newLines = updated ? this.replaceLine(line, updated) : this.replaceLine(line, null);
        return { ok: true, book: this.withLines(newLines), changes: [effect] };
    }

    private reorderDecreaseBase(userId: number, line: OrderLine, delta: number): AdjustResult {
        const newQty = line.quantity + delta; // delta<0
        if (newQty > 0) {
            const currentPkgCount = line.packageCount;
            const amountDue = computeAmountDueWithPackages(newQty, currentPkgCount, this.item);
            return {
                ok: true,
                book: this.withLines(this.replaceLine(line, line.withQuantity(newQty, amountDue))),
                changes: [
                    {
                        type: 'upsert',
                        purchaseItemId: line.purchaseItemId,
                        userId,
                        createdOnStage: 'COLLECTION',
                        quantity: newQty,
                        amountDue,
                        packageCount: currentPkgCount,
                    },
                ],
            };
        }
        // <=0: единая логика через qtyZeroEffect — пакеты сохраняются, иначе delete.
        const { effect, updated } = this.qtyZeroEffect(line);
        const newLines = updated ? this.replaceLine(line, updated) : this.replaceLine(line, null);
        return { ok: true, book: this.withLines(newLines), changes: [effect] };
    }

    /**
     * Изменить количество упаковок на delta (+1 / -1). Только COLLECTION/REORDER.
     * На REORDER — сначала заполняет COLLECTION до basePackageCount,
     * остаток льётся в REORDER-pkg (или существующую REORDER-строку).
     */
    adjustPackages(userId: number, delta: number): AdjustResult {
        if (delta === 0) return { ok: true, book: this, changes: [] };

        const rule = this.rule;
        if (!rule.canAddPackages) {
            return { ok: false, error: { code: 'forbidden', message: 'На этом этапе нельзя добавить упаковку' } };
        }

        const packSize = this.item.supplierPackageAmount;
        if (!packSize || packSize <= 0) {
            return {
                ok: false,
                error: { code: 'no_package', message: 'У товара не указан размер упаковки поставщика' },
            };
        }

        // На REORDER — split-логика: COLLECTION заполняется до basePackageCount,
        // остаток идёт в REORDER-строку (новую или существующую).
        if (this.isReorderStage()) {
            return this.reorderAdjustPackages(userId, delta);
        }

        const line = this.baseLineFor(userId);
        const currentPkgCount = line?.packageCount ?? 0;
        const newPkgCount = currentPkgCount + delta;

        if (newPkgCount < 0) {
            return {
                ok: false,
                error: { code: 'negative', message: 'Количество упаковок не может быть отрицательным' },
            };
        }

        if (!line && !rule.canAddNew) {
            return { ok: false, error: { code: 'forbidden', message: 'На этом этапе нельзя добавить новый товар' } };
        }

        const qty = line?.quantity ?? 0;

        // Если и qty, и packageCount достигли 0 — удалить строку совсем.
        // (Зеркальный кейс к qtyZeroEffect: здесь триггер — packageCount→0.)
        if (qty === 0 && newPkgCount === 0 && line) {
            return {
                ok: true,
                book: this.withLines(this.replaceLine(line, null)),
                changes: [{ type: 'delete', lineId: line.id }],
            };
        }

        const amountDue = computeAmountDueWithPackages(qty, newPkgCount, this.item);
        const createdOnStage: PurchaseFulfillmentStatus = 'COLLECTION';
        const newLine = line
            ? line.withQuantity(qty, amountDue).withPackageCount(newPkgCount)
            : this.makeLine(userId, createdOnStage, qty, amountDue, newPkgCount);

        const newLines = line ? this.replaceLine(line, newLine) : this.appendLine(newLine);
        const changes: OrderEffect[] = [
            {
                type: 'upsert',
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage,
                quantity: qty,
                amountDue,
                packageCount: newPkgCount,
            },
        ];
        return { ok: true, book: this.withLines(newLines), changes };
    }

    /**
     * REORDER: adjustPackages с разделением между COLLECTION и REORDER-pkg.
     *  - Если COLLECTION-строки нет, новая упаковка создаёт её (qty=0, pkg=delta).
     *  - Если COLLECTION есть: delta>0 сначала заполняет COLLECTION до basePackageCount,
     *    остаток — в REORDER-pkg.
     *  - delta<0: сначала забираем из REORDER-pkg, потом из COLLECTION.
     *  - Если строка (REORDER или COLLECTION) становится qty=0 && pkg=0 — hard-delete.
     */
    private reorderAdjustPackages(userId: number, delta: number): AdjustResult {
        const rule = this.rule;
        const baseLine = this.baseLineFor(userId);
        const supplementLine = this.supplementLineFor(userId);

        if (!baseLine && !supplementLine && !rule.canAddNew) {
            return { ok: false, error: { code: 'forbidden', message: 'На этом этапе нельзя добавить новый товар' } };
        }

        let lines = [...this.lines];
        const changes: OrderEffect[] = [];

        // Случай 1: нет COLLECTION-строки — создаём её с pkg=delta, qty=0.
        // (Юзер пришёл на REORDER только за упаковками.)
        if (!baseLine && delta > 0) {
            const amountDue = computeAmountDueWithPackages(0, delta, this.item);
            const newBaseLine = this.makeLine(userId, 'COLLECTION', 0, amountDue, delta);
            lines = [...lines, newBaseLine];
            changes.push({
                type: 'upsert',
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage: 'COLLECTION',
                quantity: 0,
                amountDue,
                packageCount: delta,
            });
            return { ok: true, book: this.withLines(lines), changes };
        }

        if (!baseLine) {
            // baseLine=null и delta<=0 — нечего убавлять.
            return {
                ok: false,
                error: { code: 'negative', message: 'Количество упаковок не может быть отрицательным' },
            };
        }

        const baseFrozenPkg = baseLine.basePackageCount ?? 0;
        const currentBasePkg = baseLine.packageCount;
        const basePkgGap = Math.max(0, baseFrozenPkg - currentBasePkg);
        const currentReorderPkg = supplementLine?.packageCount ?? 0;

        let newBasePkg = currentBasePkg;
        let newReorderPkg = currentReorderPkg;

        if (delta > 0) {
            const fillBase = Math.min(delta, basePkgGap);
            const spillover = delta - fillBase;
            newBasePkg = currentBasePkg + fillBase;
            newReorderPkg = currentReorderPkg + spillover;
        } else {
            // delta < 0
            const take = Math.min(-delta, currentReorderPkg);
            newReorderPkg = currentReorderPkg - take;
            const remaining = -delta - take;
            newBasePkg = currentBasePkg - Math.min(remaining, currentBasePkg);
        }

        if (newBasePkg < 0 || newReorderPkg < 0) {
            return {
                ok: false,
                error: { code: 'negative', message: 'Количество упаковок не может быть отрицательным' },
            };
        }

        // 1. Обновляем COLLECTION pkg.
        const newQty = baseLine.quantity;
        const amountDue = computeAmountDueWithPackages(newQty, newBasePkg, this.item);
        if (newQty === 0 && newBasePkg === 0) {
            // Hard-delete COLLECTION.
            lines = lines.filter((l) => l !== baseLine);
            changes.push({ type: 'delete', lineId: baseLine.id });
        } else if (newBasePkg !== currentBasePkg) {
            // Меняем только если действительно изменилось.
            const newBaseLine = baseLine.withQuantity(newQty, amountDue).withPackageCount(newBasePkg);
            lines = lines.map((l) => (l === baseLine ? newBaseLine : l));
            changes.push({
                type: 'upsert',
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage: 'COLLECTION',
                quantity: newQty,
                amountDue,
                packageCount: newBasePkg,
            });
        }

        // 2. Обновляем REORDER-pkg.
        const suppQty = supplementLine?.quantity ?? 0;
        if (newReorderPkg > 0 || suppQty > 0) {
            const suppAmountDue = computeAmountDueWithPackages(suppQty, newReorderPkg, this.item);
            if (supplementLine) {
                if (newReorderPkg !== currentReorderPkg) {
                    const newSuppLine = supplementLine
                        .withQuantity(suppQty, suppAmountDue)
                        .withPackageCount(newReorderPkg);
                    lines = lines.map((l) => (l === supplementLine ? newSuppLine : l));
                    changes.push({
                        type: 'upsert',
                        purchaseItemId: this.item.purchaseItemId,
                        userId,
                        createdOnStage: 'REORDER',
                        quantity: suppQty,
                        amountDue: suppAmountDue,
                        packageCount: newReorderPkg,
                    });
                }
            } else {
                const newSuppLine = this.makeLine(userId, 'REORDER', suppQty, suppAmountDue, newReorderPkg);
                lines = [...lines, newSuppLine];
                changes.push({
                    type: 'upsert',
                    purchaseItemId: this.item.purchaseItemId,
                    userId,
                    createdOnStage: 'REORDER',
                    quantity: suppQty,
                    amountDue: suppAmountDue,
                    packageCount: newReorderPkg,
                });
            }
        } else if (supplementLine) {
            // newReorderPkg=0, suppQty=0 → hard-delete REORDER-строку.
            lines = lines.filter((l) => l !== supplementLine);
            changes.push({ type: 'delete', lineId: supplementLine.id });
        }

        return { ok: true, book: this.withLines(lines), changes };
    }

    // ── Admin-методы (в обход правил этапа) ────────────────────────

    /**
     * Admin-only: удалить ВСЕ активные строки юзера по этому PurchaseItem (bulk).
     * В обход `canAddNew`, `onZero`, любых правил. Не трогает CANCELLED-строки.
     * Если у юзера нет активных строк — no-op (ok, без изменений).
     */
    adminDelete(userId: number): AdjustResult {
        const userLines = this.activeLines.filter((l) => l.userId === userId);
        if (userLines.length === 0) return { ok: true, book: this, changes: [] };

        const ids = new Set(userLines.map((l) => l.id));
        const newLines = this.lines.filter((l) => !ids.has(l.id));
        const changes: OrderEffect[] = userLines.map((l) => ({ type: 'delete', lineId: l.id }));
        return { ok: true, book: this.withLines(newLines), changes };
    }

    /**
     * Admin-only: убавить суммарное количество юзера на `amount`.
     * В обход `canDecrease`, `onZero`. Сначала убавляет supplement-строки
     * (REORDER/PAYMENT/etc), потом COLLECTION-строку. При qty→0 → hard_delete.
     */
    adminDecrease(userId: number, amount: number): AdjustResult {
        if (amount <= 0) {
            return {
                ok: false,
                error: { code: 'negative', message: 'Размер убавки должен быть положительным' },
            };
        }

        const userLines = this.activeLines.filter((l) => l.userId === userId);
        const totalQty = userLines.reduce((s, l) => s + l.quantity, 0);
        if (totalQty === 0) {
            return {
                ok: false,
                error: { code: 'negative', message: 'У юзера нет заказа для убавки' },
            };
        }
        if (amount > totalQty) {
            return {
                ok: false,
                error: { code: 'negative', message: 'Нельзя убавить больше, чем есть в заказе' },
            };
        }

        // сначала supplement (REORDER/PAYMENT), потом COLLECTION
        const sorted = [...userLines].sort((a, b) => Number(a.isBase) - Number(b.isBase));
        let remaining = amount;
        const newLines = [...this.lines];
        const changes: OrderEffect[] = [];

        for (const line of sorted) {
            if (remaining <= 0) break;
            if (line.quantity === 0) continue;
            const take = Math.min(remaining, line.quantity);
            const newQty = line.quantity - take;
            remaining -= take;

            const idx = newLines.indexOf(line);
            if (newQty === 0) {
                // qty → 0: единая логика через qtyZeroEffect — пакеты сохраняются, иначе delete.
                const { effect, updated } = this.qtyZeroEffect(line);
                if (updated) {
                    newLines[idx] = updated;
                } else {
                    newLines.splice(idx, 1);
                }
                changes.push(effect);
            } else {
                const newLine = this.recomputeLineAfterQtyChange(line, newQty);
                newLines[idx] = newLine;
                changes.push({
                    type: 'upsert',
                    purchaseItemId: line.purchaseItemId,
                    userId: line.userId,
                    createdOnStage: line.createdOnStage,
                    quantity: newQty,
                    amountDue: newLine.amountDue,
                    packageCount: newLine.packageCount,
                });
            }
        }

        return { ok: true, book: this.withLines(newLines), changes };
    }

    /**
     * Admin-only: добавить `amount` к суммарному количеству юзера.
     * В обход `canIncrease`, `canAddNew`, `poolApplies`.
     * Стратегия: если есть COLLECTION-строка — увеличиваем её; иначе если есть
     * supplement-строка — увеличиваем её; иначе создаём новую COLLECTION-строку.
     */
    adminAdd(userId: number, amount: number): AdjustResult {
        if (amount <= 0) {
            return {
                ok: false,
                error: { code: 'negative', message: 'Размер добавки должен быть положительным' },
            };
        }

        const baseLine = this.baseLineFor(userId);
        const supplementLine = this.supplementLineFor(userId);
        const targetLine = baseLine ?? supplementLine;

        if (targetLine) {
            const newQty = targetLine.quantity + amount;
            const newLine = this.recomputeLineAfterQtyChange(targetLine, newQty);
            const newLines = this.replaceLine(targetLine, newLine);
            return {
                ok: true,
                book: this.withLines(newLines),
                changes: [
                    {
                        type: 'upsert',
                        purchaseItemId: this.item.purchaseItemId,
                        userId,
                        createdOnStage: targetLine.createdOnStage,
                        quantity: newQty,
                        amountDue: newLine.amountDue,
                        packageCount: newLine.packageCount,
                    },
                ],
            };
        }

        // нет строк — создаём новую COLLECTION
        const newQty = amount;
        const amountDue = computeAmountDue(newQty, this.item);
        const newLine = this.makeLine(userId, 'COLLECTION', newQty, amountDue, 0);
        return {
            ok: true,
            book: this.withLines(this.appendLine(newLine)),
            changes: [
                {
                    type: 'upsert',
                    purchaseItemId: this.item.purchaseItemId,
                    userId,
                    createdOnStage: 'COLLECTION',
                    quantity: newQty,
                    amountDue,
                    packageCount: 0,
                },
            ],
        };
    }

    /**
     * Admin-only: установить точное суммарное qty юзера.
     * В обход всех правил. qty=0 → удалить все строки юзера (с сохранением упаковок).
     * Стратегия: всё в COLLECTION-строку (схлопывание supplement в COLLECTION), packageCount суммируется.
     */
    adminSetQuantity(userId: number, qty: number): AdjustResult {
        if (qty < 0) {
            return {
                ok: false,
                error: { code: 'negative', message: 'Количество не может быть отрицательным' },
            };
        }
        if (qty === 0) {
            // qty=0: применяем package-preservation к каждой строке юзера через qtyZeroEffect.
            const userLines = this.activeLines.filter((l) => l.userId === userId);
            if (userLines.length === 0) return { ok: true, book: this, changes: [] };

            let lines = [...this.lines];
            const changes: OrderEffect[] = [];
            for (const line of userLines) {
                const { effect, updated } = this.qtyZeroEffect(line);
                if (updated) {
                    lines = lines.map((l) => (l === line ? updated : l));
                } else {
                    lines = lines.filter((l) => l !== line);
                }
                changes.push(effect);
            }
            return { ok: true, book: this.withLines(lines), changes };
        }

        const current = this.totalFor(userId);
        if (current.quantity === qty) {
            return { ok: true, book: this, changes: [] };
        }

        // Удаляем все существующие строки юзера, создаём одну COLLECTION-строку с qty.
        // Суммарный packageCount из старых строк сохраняется в новой строке.
        const userLines = this.activeLines.filter((l) => l.userId === userId);
        const totalPackageCount = userLines.reduce((s, l) => s + l.packageCount, 0);
        const ids = new Set(userLines.map((l) => l.id));
        const linesWithout = this.lines.filter((l) => !ids.has(l.id));
        const amountDue = computeAmountDueWithPackages(qty, totalPackageCount, this.item);
        const newLine = this.makeLine(userId, 'COLLECTION', qty, amountDue, totalPackageCount);
        const changes: OrderEffect[] = [
            ...userLines.map((l) => ({ type: 'delete' as const, lineId: l.id })),
            {
                type: 'upsert' as const,
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage: 'COLLECTION' as PurchaseFulfillmentStatus,
                quantity: qty,
                amountDue,
                packageCount: totalPackageCount,
            },
        ];
        return {
            ok: true,
            book: this.withLines([...linesWithout, newLine]),
            changes,
        };
    }

    /** Пересчитать строку (amountDue + packageCount-aware) после изменения qty. */
    private recomputeLineAfterQtyChange(line: OrderLine, newQty: number): OrderLine {
        if (line.isBase) {
            const amountDue = computeAmountDueWithPackages(newQty, line.packageCount, this.item);
            return line.withQuantity(newQty, amountDue);
        }
        const amountDue = computeAmountDue(newQty, this.item);
        return line.withQuantity(newQty, amountDue);
    }

    /**
     * Единая логика «что делать со строкой, когда её количество → 0».
     * Возвращает эффект для persistence и (опционально) обновлённую строку для snapshot.
     *  - packageCount > 0 → upsert с qty=0, amountDue=0, packageCount сохранён.
     *  - packageCount == 0 → delete.
     */
    private qtyZeroEffect(line: OrderLine): { effect: OrderEffect; updated: OrderLine | null } {
        if (line.packageCount > 0) {
            return {
                effect: {
                    type: 'upsert',
                    purchaseItemId: line.purchaseItemId,
                    userId: line.userId,
                    createdOnStage: line.createdOnStage,
                    quantity: 0,
                    amountDue: 0,
                    packageCount: line.packageCount,
                },
                updated: line.zeroQtyKeepPackages(),
            };
        }
        return { effect: { type: 'delete', lineId: line.id }, updated: null };
    }

    // ── Внутренние: сборка нового снимка ───────────────────────────

    private applyZero(line: OrderLine | null): AdjustResult {
        if (!line) return { ok: true, book: this, changes: [] };

        // Унифицированная логика: пакеты есть → upsert, нет → delete.
        const { effect, updated } = this.qtyZeroEffect(line);
        const newLines = updated ? this.replaceLine(line, updated) : this.replaceLine(line, null);
        return { ok: true, book: this.withLines(newLines), changes: [effect] };
    }

    private applyUpsert(
        rule: StageRule,
        line: OrderLine | null,
        userId: number,
        newQty: number,
    ): AdjustResult {
        // target=base → COLLECTION. target=supplement → ВСЕГДА текущий этап.
        // (Не переиспользуем `line.createdOnStage`: на PAYMENT+ у юзера может быть
        // REORDER-строка из прошлого этапа, и писать в неё нельзя — нужно создать новую.)
        const createdOnStage: PurchaseFulfillmentStatus =
            rule.target === 'base' ? 'COLLECTION' : this.item.fulfillmentStatus;

        if (rule.target === 'base') {
            const currentPkgCount = line?.packageCount ?? 0;
            const amountDue = computeAmountDueWithPackages(newQty, currentPkgCount, this.item);
            const newLine = line
                ? line.withQuantity(newQty, amountDue)
                : this.makeLine(userId, createdOnStage, newQty, amountDue, currentPkgCount);
            return this.commitUpsert(line, newLine, userId, createdOnStage, newQty, amountDue, currentPkgCount);
        }

        // supplement — россыпь, без упаковок.
        // Если line существует с тем же createdOnStage — обновляем её.
        // Если line из другого этапа (напр. REORDER на PAYMENT+) — создаём новую
        // строку через makeLine с createdOnStage=текущий_этап, старая остаётся.
        const amountDue = computeAmountDue(newQty, this.item);
        const sameStage = line?.createdOnStage === createdOnStage;
        const newLine =
            line && sameStage
                ? line.withQuantity(newQty, amountDue)
                : this.makeLine(userId, createdOnStage, newQty, amountDue, 0);
        return this.commitUpsert(line, newLine, userId, createdOnStage, newQty, amountDue, undefined);
    }

    private commitUpsert(
        oldLine: OrderLine | null,
        newLine: OrderLine,
        userId: number,
        createdOnStage: PurchaseFulfillmentStatus,
        quantity: number,
        amountDue: number,
        packageCount: number | undefined,
    ): AdjustResult {
        // Если `oldLine` относится к ДРУГОМУ этапу (напр. REORDER на PAYMENT+),
        // мы не должны его трогать — оставляем как есть, добавляем новую строку.
        // `newLine` в этом случае уже корректно создан с правильным createdOnStage
        // (через makeLine с createdOnStage=this.item.fulfillmentStatus).
        const sameStage = oldLine?.createdOnStage === createdOnStage;
        const newLines = oldLine && sameStage ? this.replaceLine(oldLine, newLine) : this.appendLine(newLine);
        const changes: OrderEffect[] = [
            {
                type: 'upsert',
                purchaseItemId: this.item.purchaseItemId,
                userId,
                createdOnStage,
                quantity,
                amountDue,
                ...(packageCount !== undefined ? { packageCount } : {}),
            },
        ];
        return { ok: true, book: this.withLines(newLines), changes };
    }

    // ── Внутренние: работа с массивом строк ────────────────────────

    private withLines(lines: readonly OrderLine[]): OrderBook {
        return new OrderBook(this.item, Object.freeze(lines) as readonly OrderLine[]);
    }

    private replaceLine(target: OrderLine, replacement: OrderLine | null): readonly OrderLine[] {
        if (replacement) {
            return this.lines.map((l) => (l === target ? replacement : l));
        }
        return this.lines.filter((l) => l !== target);
    }

    private appendLine(line: OrderLine): readonly OrderLine[] {
        return [...this.lines, line];
    }

    private makeLine(
        userId: number,
        createdOnStage: PurchaseFulfillmentStatus,
        quantity: number,
        amountDue: number,
        packageCount: number,
    ): OrderLine {
        return OrderLine.create({
            id: NEW_LINE_ID,
            purchaseItemId: this.item.purchaseItemId,
            userId,
            quantity,
            amountDue,
            packageCount,
            status: 'ACTIVE',
            createdOnStage,
            baseQuantity: null,
            basePackageCount: null,
        });
    }
}

