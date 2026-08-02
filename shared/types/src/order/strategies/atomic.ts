/**
 * Atomic helpers для StageStrategy классов.
 *
 * Содержит:
 *  - Базовые операции над OrderLine: applyUpdates, applySetQtyOnLine, applySetPackagesOnLine,
 *    applyZeroOutOnLine, makeNewLine, makeUpsertEffect
 *  - Поиск строк: findBaseLine, findSupplementLine, findSupplementLineForStage,
 *    activeUserLines, toActiveVOs, resolveTargetLine
 *  - REORDER split: splitReorderDelta
 *  - Pool aggregation (pure function): aggregateForPool
 *  - Result constructors: ok, err, forbidden
 *  - Const: NEW_LINE_ID
 *  - Типы: LineUpdate, MultiUpdate
 *
 * Все helpers — pure functions, не зависят от классов. Используются стратегиями
 * для построения MultiUpdate-результатов.
 */
import { OrderLine } from '../order-line';
import { computeAmountDue, computeAmountDueWithPackages } from '../pricing';
import type { PurchaseFulfillmentStatus } from '../../index';
import type { OrderEffect, OrderError, OrderLineVO, PoolAggregation, PurchaseItem } from '../types';

// ── Public types ────────────────────────────────────────────────────

/** id для ещё не сохранённой строки. */
export const NEW_LINE_ID = 0;

/**
 * Изменение одной строки в массиве lines:
 *  - `old: null`, `new: OrderLine` — append new line
 *  - `old: OrderLine`, `new: OrderLine` — replace
 *  - `old: OrderLine`, `new: null` — delete
 */
export interface LineUpdate {
    old: OrderLine | null;
    new: OrderLine | null;
}

export interface MultiUpdate {
    updates: LineUpdate[];
    effects: OrderEffect[];
    /** Если задана — операция запрещена (forbidden, pool_exceeded, и т.п.). */
    error?: OrderError;
}

// ── applyUpdates: pure функция для коммита списка изменений ───────

/**
 * Применяет список LineUpdate к массиву lines, возвращая НОВЫЙ массив.
 * Если список пуст — возвращает исходный массив без изменений.
 *
 * Логика:
 *  - {old: null, new: L} → добавить L в конец
 *  - {old: L, new: L'} → заменить L на L' (по ссылочному равенству)
 *  - {old: L, new: null} → удалить L
 */
export function applyUpdates(lines: readonly OrderLine[], updates: readonly LineUpdate[]): readonly OrderLine[] {
    if (updates.length === 0) return lines;
    const oldSet = new Set<OrderLine>();
    const replacements = new Map<OrderLine, OrderLine>();
    const appends: OrderLine[] = [];
    for (const u of updates) {
        if (u.old === null && u.new !== null) appends.push(u.new);
        else if (u.old !== null && u.new === null) oldSet.add(u.old);
        else if (u.old !== null && u.new !== null) {
            oldSet.add(u.old);
            replacements.set(u.old, u.new);
        }
    }
    const next: OrderLine[] = [];
    for (const l of lines) {
        if (oldSet.has(l)) {
            const r = replacements.get(l);
            if (r) next.push(r);
            // else: deleted, skip
        } else {
            next.push(l);
        }
    }
    next.push(...appends);
    return next;
}

// ── Atomic line operations ──────────────────────────────────────────

export function applySetQtyOnLine(
    item: PurchaseItem,
    line: OrderLine | null,
    userId: number,
    targetIsBase: boolean,
    newQty: number,
): MultiUpdate {
    const usesPackages = line?.isBase ?? targetIsBase;
    const pkgCount = line?.packageCount ?? 0;
    const amountDue = usesPackages
        ? computeAmountDueWithPackages(newQty, pkgCount, item)
        : computeAmountDue(newQty, item);
    const createdOnStage: PurchaseFulfillmentStatus =
        line?.createdOnStage ?? (targetIsBase ? 'COLLECTION' : item.fulfillmentStatus);
    const newLine = line
        ? line.withQuantity(newQty, amountDue)
        : makeNewLine(item, userId, createdOnStage, newQty, amountDue, pkgCount);
    return {
        updates: [{ old: line, new: newLine }],
        effects: [makeUpsertEffect(item, userId, createdOnStage, newQty, amountDue, pkgCount)],
    };
}

export function applySetPackagesOnLine(
    item: PurchaseItem,
    line: OrderLine | null,
    userId: number,
    targetIsBase: boolean,
    newPkgCount: number,
): MultiUpdate {
    const qty = line?.quantity ?? 0;
    // pkg=0 + qty=0 → hard delete
    if (line && newPkgCount === 0 && qty === 0) {
        return { updates: [{ old: line, new: null }], effects: [{ type: 'delete', lineId: line.id }] };
    }
    const amountDue = computeAmountDueWithPackages(qty, newPkgCount, item);
    const createdOnStage: PurchaseFulfillmentStatus =
        line?.createdOnStage ?? (targetIsBase ? 'COLLECTION' : item.fulfillmentStatus);
    const newLine = line
        ? line.withQuantity(qty, amountDue).withPackageCount(newPkgCount)
        : makeNewLine(item, userId, createdOnStage, qty, amountDue, newPkgCount);
    return {
        updates: [{ old: line, new: newLine }],
        effects: [makeUpsertEffect(item, userId, createdOnStage, qty, amountDue, newPkgCount)],
    };
}

export function applyZeroOutOnLine(line: OrderLine): MultiUpdate {
    if (line.packageCount > 0) {
        // Сохраняем упаковки, qty=0
        return {
            updates: [{ old: line, new: line.zeroQtyKeepPackages() }],
            effects: [
                {
                    type: 'upsert',
                    purchaseItemId: line.purchaseItemId,
                    userId: line.userId,
                    createdOnStage: line.createdOnStage,
                    quantity: 0,
                    amountDue: 0,
                    packageCount: line.packageCount,
                },
            ],
        };
    }
    return { updates: [{ old: line, new: null }], effects: [{ type: 'delete', lineId: line.id }] };
}

export function makeNewLine(
    item: PurchaseItem,
    userId: number,
    createdOnStage: PurchaseFulfillmentStatus,
    quantity: number,
    amountDue: number,
    packageCount: number,
): OrderLine {
    return OrderLine.create({
        id: NEW_LINE_ID,
        purchaseItemId: item.purchaseItemId,
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

export function makeUpsertEffect(
    item: PurchaseItem,
    userId: number,
    createdOnStage: PurchaseFulfillmentStatus,
    quantity: number,
    amountDue: number,
    packageCount: number,
): OrderEffect {
    return {
        type: 'upsert',
        purchaseItemId: item.purchaseItemId,
        userId,
        createdOnStage,
        quantity,
        amountDue,
        packageCount,
    };
}

// ── Поиск строк ─────────────────────────────────────────────────────

export function findBaseLine(lines: readonly OrderLine[], userId: number): OrderLine | null {
    return lines.find((l) => l.userId === userId && l.isActive && l.isBase) ?? null;
}

export function findSupplementLine(lines: readonly OrderLine[], userId: number): OrderLine | null {
    return lines.find((l) => l.userId === userId && l.isActive && l.isSupplement) ?? null;
}

export function findSupplementLineForStage(
    lines: readonly OrderLine[],
    userId: number,
    stage: PurchaseFulfillmentStatus,
): OrderLine | null {
    return lines.find((l) => l.userId === userId && l.isActive && l.isSupplement && l.createdOnStage === stage) ?? null;
}

export function activeUserLines(lines: readonly OrderLine[], userId: number): OrderLine[] {
    return lines.filter((l) => l.userId === userId && l.isActive);
}

export function toActiveVOs(lines: readonly OrderLine[]): OrderLineVO[] {
    return lines.filter((l) => l.isActive).map((l) => l.toVO());
}

export function resolveTargetLine(
    item: PurchaseItem,
    lines: readonly OrderLine[],
    userId: number,
    targetIsBase: boolean,
): OrderLine | null {
    if (targetIsBase) return findBaseLine(lines, userId);
    return findSupplementLineForStage(lines, userId, item.fulfillmentStatus);
}

// ── REORDER split helper ────────────────────────────────────────────

/** REORDER: распределяет delta между заполнением базы (до baseQuantity) и spillover. */
export function splitReorderDelta(
    delta: number,
    baseFrozen: number,
    currentBase: number,
): { fillBase: number; spillover: number } {
    const baseGap = Math.max(0, baseFrozen - currentBase);
    const fillBase = Math.min(delta, baseGap);
    return { fillBase, spillover: delta - fillBase };
}

// ── Pool aggregation (pure function, public) ────────────────────────

/**
 * Суммирует строки заказа для расчёта пула добора.
 *
 * Формула зависит от этапа:
 *  - COLLECTION: totalOrdered = Σ qty, всё остальное 0.
 *  - REORDER: totalBase = Σ baseQuantity, supplement = Σ max(0, qty - bq).
 *  - PAYMENT+: totalBase = Σ qty COLLECTION-строк, supplement = Σ qty не-COLLECTION.
 */
export function aggregateForPool(
    stage: PurchaseFulfillmentStatus,
    lines: OrderLineVO[],
    packSize: number | null = null,
): PoolAggregation {
    let totalBaseQuantity = 0;
    let supplementClaimed = 0;
    let totalOrderedQuantity = 0;
    let totalOrderedWithPackages = 0;
    const pack = packSize ?? 0;

    if (stage === 'COLLECTION') {
        for (const line of lines) {
            if (line.status === 'CANCELLED') continue;
            totalOrderedQuantity += line.quantity;
            totalOrderedWithPackages += line.quantity + line.packageCount * pack;
        }
        return { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity, totalOrderedWithPackages };
    }

    if (stage === 'REORDER') {
        for (const line of lines) {
            if (line.status === 'CANCELLED') continue;
            const bq = line.baseQuantity ?? 0;
            totalBaseQuantity += bq;
            supplementClaimed += Math.max(0, line.quantity - bq);
            totalOrderedQuantity += line.quantity;
            totalOrderedWithPackages += line.quantity + line.packageCount * pack;
        }
        return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity, totalOrderedWithPackages };
    }

    // PAYMENT+
    for (const line of lines) {
        if (line.status === 'CANCELLED') continue;
        totalOrderedQuantity += line.quantity;
        totalOrderedWithPackages += line.quantity + line.packageCount * pack;
        if (line.createdOnStage === 'COLLECTION') totalBaseQuantity += line.quantity;
        else supplementClaimed += line.quantity;
    }
    return { totalBaseQuantity, supplementClaimed, totalOrderedQuantity, totalOrderedWithPackages };
}

// ── Result constructors ─────────────────────────────────────────────

export function ok(): MultiUpdate {
    return { updates: [], effects: [] };
}

export function err(error: OrderError): MultiUpdate {
    return { updates: [], effects: [], error };
}

export function forbidden(message: string): OrderError {
    return { code: 'forbidden', message };
}
