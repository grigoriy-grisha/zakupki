/**
 * UI-контекст заказа — pure projection из (item, lines, userId).
 *
 * Выделено из OrderBook, чтобы отделить presentation от домена.
 * Не меняет состояние, не делает эффектов, не зависит от `this`.
 * Используется через `OrderBook.displayContextFor(userId)` (делегат).
 */
import {
    buildOrderQtyOptions,
    countFullSupplierPacks,
    effectiveQty,
    getActiveStep,
    isSupplementPhase,
} from '../index';
import { computeAmountDueWithPackages, computePackagePrice, computeUnitPriceRubNewModel } from './pricing';
import { getStageConfig } from './stages';
import { computePoolInfo } from './pool';
import { computeSupplierLimitInfo } from './limit';
import { aggregateForPool } from './strategies/atomic';
import { mergeLines } from './aggregation';
import { getUnitShortName } from './utils';
import { isPieceUnit } from '../units/normalize';
import type { OrderDisplayContext, OrderLineVO, PoolInfo, PurchaseItem } from './types';
import type { OrderLine } from './order-line';

export function buildDisplayContext(
    item: PurchaseItem,
    lines: readonly OrderLine[],
    userId: number,
): OrderDisplayContext {
    const cfg = getStageConfig(item.fulfillmentStatus);
    const shortName = getUnitShortName(item.unitCode);
    const multiplicity = item.multiplicity || 1;
    const packSize = item.packAmount;

    const total = mergeLines(filterUserLines(lines, userId).map((l) => l.toVO()));
    const currentQuantity = total.quantity;
    const currentPackageCount = total.packageCount;
    const frozenBase = total.baseQuantity;

    const activeStep = getActiveStep({
        fulfillmentStatus: item.fulfillmentStatus,
        supplementStep: item.supplementStep,
        options: buildOrderQtyOptions({
            multiplicity,
            minPackageAmount: item.minPackageAmount,
            minPackageUnit: item.minPackageUnit ?? null,
            purchaseItemMinQty: null,
            unitShort: shortName,
            unitCode: item.unitCode,
        }),
    });

    const poolInfo = buildPoolInfo(item, lines, userId);
    const availablePool = poolInfo.pool;
    const isSupplement = isSupplementPhase(item.fulfillmentStatus);
    const isWeight = !isPieceUnit(item.unitCode);
    const hasSupplierPackage = packSize != null && packSize > 0;
    const showPackageButtons = cfg.canAddPackages && hasSupplierPackage && isWeight;
    const unitPriceRub = computeUnitPriceRubNewModel(item);
    const price = unitPriceRub ?? 0;
    const packagePrice = computePackagePrice(item);
    const packageTotal = currentPackageCount * packagePrice;
    const amountDue = computeAmountDueWithPackages(currentQuantity, currentPackageCount, item);
    const fullPacks =
        isWeight && packSize != null
            ? countFullSupplierPacks(currentQuantity + currentPackageCount * packSize, packSize)
            : 0;

    const maxAllowed =
        availablePool != null && Number.isFinite(availablePool)
            ? availablePool + currentQuantity
            : Number.POSITIVE_INFINITY;
    const minAllowed = cfg.target === 'supplement' ? frozenBase : 0;

    const hasOrder = currentQuantity > 0 || currentPackageCount > 0;
    const poolExhausted = isSupplement && availablePool != null && availablePool <= 1e-9;
    const isSoldOut = poolExhausted && !hasOrder;
    const canAdd = cfg.canIncrease && currentQuantity < maxAllowed;
    const canDecrease = currentQuantity > 0 && (cfg.target === 'base' || currentQuantity > frozenBase);

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
        total: amountDue,
        fullPacks,
        canAdd,
        canDecrease,
        hasOrder,
        maxAllowed,
        minAllowed,
    };
}

function buildPoolInfo(item: PurchaseItem, lines: readonly OrderLine[], userId: number) {
    const cfg = getStageConfig(item.fulfillmentStatus);
    const userLines = filterUserLines(lines, userId);
    const packSize = item.packAmount;
    // currentQty юзера: qty + пакеты как qty (effective). Это то, что лимит/пул
    // должны учитывать, иначе юзер с qty=70 + pkg=1 (30г) при limit=100 пускает
    // сверх лимита.
    const baseQty = sumEffective(userLines, (l) => l.isBase, packSize);
    const suppQty = sumEffective(userLines, (l) => l.isSupplement, packSize);
    const currentQty = cfg.target === 'base' ? baseQty + suppQty : suppQty;

    // Базовый pool (targetRemainder / packs) — работает только на REORDER/PAYMENT+
    let poolInfo: PoolInfo;
    if (!cfg.poolApplies) {
        poolInfo = {
            pool: null,
            maxAllowed: Number.POSITIVE_INFINITY,
            canAddMore: Number.POSITIVE_INFINITY,
            supplementClaimed: 0,
            totalBaseQuantity: 0,
            totalOrderedQuantity: 0,
            totalOrderedWithPackages: 0,
        };
    } else {
        poolInfo = computePoolInfo({
            targetRemainder: item.targetRemainder,
            packSize,
            aggregation: aggregateForPool(item.fulfillmentStatus, activeVOs(lines), packSize),
            currentQty,
            unitCode: item.unitCode,
        });
    }

    // Supplier limit (если задан) — глобальный остаток поставщика, действует
    // на ВСЕХ этапах (включая COLLECTION). Берём минимум из pool и supplier limit.
    if (item.supplierLimit != null) {
        const aggregation = cfg.poolApplies
            ? {
                  totalBaseQuantity: poolInfo.totalBaseQuantity,
                  supplementClaimed: poolInfo.supplementClaimed,
                  totalOrderedQuantity: poolInfo.totalOrderedQuantity,
                  totalOrderedWithPackages: poolInfo.totalOrderedWithPackages,
              }
            : aggregateForPool('COLLECTION', activeVOs(lines), packSize);
        const limitInfo = computeSupplierLimitInfo({
            supplierLimit: item.supplierLimit,
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

function filterUserLines(lines: readonly OrderLine[], userId: number): readonly OrderLine[] {
    return lines.filter((l) => l.userId === userId && l.isActive);
}

function activeVOs(lines: readonly OrderLine[]): OrderLineVO[] {
    return lines.filter((l) => l.isActive).map((l) => l.toVO());
}

function sumEffective(
    lines: readonly OrderLine[],
    pred: (l: OrderLine) => boolean,
    packSize: number | null,
): number {
    let s = 0;
    for (const l of lines) {
        if (pred(l)) s += effectiveQty(l, packSize);
    }
    return s;
}
