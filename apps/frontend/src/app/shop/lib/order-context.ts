import {
    computeAmountDueWithPackages,
    computePackagePrice,
    countFullSupplierPacks,
    getPackDiscountPricingInfo,
    getSupplementStep,
    getUnitByCode,
    isSupplementPhase,
    buildOrderQtyOptions,
    getOrderQuantityStep,
    mapToPurchaseItem,
    OrderBook,
    toOrderLinesVO,
} from '@zakupki/types';
import type { PurchaseFulfillmentStatus, PurchaseItem } from '@zakupki/types';
import type { ShopPurchaseItem } from './types';

export interface ItemOrderContextInput {
    item: ShopPurchaseItem;
    currentQuantity: number;
    currentPackageCount: number;
    baseQuantity: number;
    fulfillmentStatus: string;
    packDiscountPercent: number;
}

export interface ItemOrderContext {
    /** Короткое название единицы (гр, шт, ...) */
    shortName: string;
    /** Цена за единицу (с учётом priceOverride) */
    price: number;

    // Текущее состояние (пробрасывается из input для удобства)
    currentQuantity: number;
    currentPackageCount: number;

    // Шаги
    /** Текущий шаг кнопок ± (зависит от этапа и supplementStep) */
    activeStep: number;

    // Пул добора
    isSupplement: boolean;
    availablePool: number | null;
    isSoldOut: boolean;
    freeRemainderLabel: string | null;

    // Упаковка
    packSize: number | null;
    showPackageButtons: boolean;
    packagePrice: number;
    packageTotal: number;

    // Цены
    total: number;
    fullPacks: number;

    // Разрешения
    canAdd: boolean;
    canDecrease: boolean;
    hasOrder: boolean;

    // Границы для handleAdd/handleRemove
    maxAllowed: number;
    minAllowed: number;
}

/**
 * Строит UI-контекст заказа.
 *
 * Расчёт пула делегируется в доменную стратегию (getStageStrategy + computePoolInfo) —
 * ТАКАЯ ЖЕ логика, как в OrderService на бэке. Единый источник истины.
 *
 * maxAllowed = availablePool + currentQuantity (не baseQuantity!) —
 * пользователь может иметь текущее + остаток пула. Совпадает с бэком.
 */
export function buildItemOrderContext(input: ItemOrderContextInput): ItemOrderContext {
    const { item, currentQuantity, currentPackageCount, baseQuantity, fulfillmentStatus, packDiscountPercent } = input;
    const product = item.product;
    const unit = getUnitByCode(product.unitCode);
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = Number(product.multiplicity) || 1;
    // После миграции Supplier все per-purchase поля (цена, фасовка) лежат на item.
    const price = Number(item.priceOverride ?? item.pricePerUnit ?? 0);

    const minPackageAmount = item.minPackageAmount != null ? Number(item.minPackageAmount) : null;
    const minPackageUnit = item.minPackageUnit ?? null;
    const packSize = item.supplierPackageAmount != null ? Number(item.supplierPackageAmount) : null;

    const orderQtyOptions = buildOrderQtyOptions({
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item.minQty != null ? Number(item.minQty) : null,
        unitShort: shortName,
    });

    const regularStep = getOrderQuantityStep(orderQtyOptions);
    const activeStep = getSupplementStep({
        fulfillmentStatus,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        regularStep,
    });

    // Пул добора — через доменный aggregate OrderBook.remainder (сырой пул, без userId).
    // currentQuantity в расчёте пула не участвует (используется ниже для maxAllowed/canAddMore),
    // поэтому достаточно глобального остатка книги.
    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const purchaseItem: PurchaseItem = mapToPurchaseItem(
        {
            id: item.id,
            // Per-purchase поля теперь с item напрямую:
            pricePerUnit: item.pricePerUnit ?? null,
            priceOverride: item.priceOverride,
            priceTiers: item.priceTiers,
            supplierPackageAmount: packSize,
            supplierPackageUnit: item.supplierPackageUnit ?? null,
            supplierPackagePrice: item.supplierPackagePrice ?? null,
            supplierPackageTiers: item.supplierPackageTiers,
            minPackageAmount,
            minPackageUnit: item.minPackageUnit ?? null,
            supplementStep: item.supplementStep,
            targetRemainder: item.targetRemainder,
            supplierLimit: item.supplierLimit,
            supplierLimitUnit: item.supplierLimitUnit ?? null,
            supplierId: item.supplierId ?? null,
            supplier: item.supplier ?? null,
            // Product — только каталожные данные:
            product: {
                unitCode: product.unitCode,
                multiplicity,
            },
            purchase: { fulfillmentStatus },
        },
        packDiscountPercent,
    );
    const book = OrderBook.create(purchaseItem, toOrderLinesVO((item.orderLines ?? []) as any[]));
    const availablePool = book.remainder;

    const freeRemainderLabel =
        isSupplement && availablePool != null && availablePool < Number.POSITIVE_INFINITY
            ? `Можно докинуть: ${availablePool} ${shortName}`
            : null;

    // Упаковка
    const hasSupplierPackage = packSize != null && packSize > 0;
    const canAddPackage = fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';
    const showPackageButtons = canAddPackage && hasSupplierPackage;
    // Единый источник цены с сервером: computePackagePrice/computeAmountDueWithPackages
    // берут priceOverride (как calculateOrderAmount). Раньше packagePrice считался от
    // pricePerUnit → для ценника через priceOverride упаковки были бесплатными на клиенте.
    const packagePrice = computePackagePrice(purchaseItem);
    const packageTotal = currentPackageCount * packagePrice;
    const total = computeAmountDueWithPackages(currentQuantity, currentPackageCount, purchaseItem);
    const packDiscountInfo = getPackDiscountPricingInfo(
        {
            supplierPackageAmount: packSize,
            supplierPackageUnit: item.supplierPackageUnit ?? null,
            supplierPackagePrice: item.supplierPackagePrice ?? null,
        },
        packDiscountPercent,
    );
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(currentQuantity, packDiscountInfo.packSize) : 0;

    // Границы — ЕДИНОЕ правило с бэком: maxAllowed = pool + currentQuantity
    const maxAllowed =
        availablePool != null && Number.isFinite(availablePool)
            ? availablePool + currentQuantity
            : Number.POSITIVE_INFINITY;
    const minAllowed = fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER' ? baseQuantity : 0;

    // Разрешения
    const hasOrder = currentQuantity > 0 || currentPackageCount > 0;
    const poolExhausted = isSupplement && availablePool != null && availablePool <= 1e-9;
    const isSoldOut = poolExhausted && !hasOrder;
    const canAdd = currentQuantity < maxAllowed;
    const canDecrease =
        currentQuantity > 0 &&
        (fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER' || currentQuantity > baseQuantity);

    return {
        shortName,
        price,
        currentQuantity,
        currentPackageCount,
        activeStep,
        isSupplement,
        availablePool,
        isSoldOut,
        freeRemainderLabel,
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
