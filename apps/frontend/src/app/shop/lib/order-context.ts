import {
    calculateOrderAmount,
    countFullSupplierPacks,
    getPackDiscountPricingInfo,
    getSupplementStep,
    getUnitByCode,
    isSupplementPhase,
    buildOrderQtyOptions,
    getOrderQuantityStep,
} from '@zakupki/types';
import { buildShopOrderQuantityContext } from './order-quantity';
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

export function buildItemOrderContext(input: ItemOrderContextInput): ItemOrderContext {
    const { item, currentQuantity, currentPackageCount, baseQuantity, fulfillmentStatus, packDiscountPercent } = input;
    const product = item.product;
    const unit = getUnitByCode(product.unitCode);
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = Number(product.multiplicity) || 1;
    const price = Number(item.priceOverride ?? product.pricePerUnit);

    // Шаги
    const minPackageAmount = product.minPackageAmount != null ? Number(product.minPackageAmount) : null;
    const minPackageUnit = product.minPackageUnit ?? null;
    const packSize = product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null;

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

    // Пул добора — расчёт по orderLines
    const activeLines = (item.orderLines ?? []).filter((line) => line.status !== 'CANCELLED');
    const supplementClaimed = activeLines.reduce(
        (acc, line) => acc + Math.max(0, Number(line.quantity ?? 0) - Number(line.baseQuantity ?? 0)),
        0,
    );
    const totalOrderedQuantity = activeLines.reduce((acc, line) => acc + Number(line.quantity ?? 0), 0);
    const totalBaseQuantity = activeLines.reduce((acc, line) => acc + Number(line.baseQuantity ?? 0), 0);

    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const qtyCtx = buildShopOrderQuantityContext({
        isSupplement,
        baseQuantity,
        currentQuantity,
        availableRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        packSize,
        sumOtherRemainders: supplementClaimed,
        totalOrderedQuantity,
        totalBaseQuantity,
        orderQtyOptions,
    });

    const availablePool = qtyCtx.availablePool;

    // Упаковка
    const hasSupplierPackage = packSize != null && packSize > 0;
    const canAddPackage = fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';
    const showPackageButtons = canAddPackage && hasSupplierPackage;
    const packagePrice =
        product.supplierPackagePrice != null && Number(product.supplierPackagePrice) > 0
            ? Number(product.supplierPackagePrice)
            : Number(product.pricePerUnit) * (packSize ?? 0);
    const packageTotal = currentPackageCount * packagePrice;

    // Цены
    const pricingOptions = {
        priceTiers: product.priceTiers,
        pricePerUnit: Number(product.pricePerUnit),
        priceOverride: item.priceOverride != null ? Number(item.priceOverride) : null,
        supplierPackageAmount: product.supplierPackageAmount,
        supplierPackageUnit: product.supplierPackageUnit,
        supplierPackagePrice: product.supplierPackagePrice,
        packDiscountPercent,
    };
    const total = calculateOrderAmount(currentQuantity, pricingOptions) + packageTotal;
    const packDiscountInfo = getPackDiscountPricingInfo(product, packDiscountPercent);
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(currentQuantity, packDiscountInfo.packSize) : 0;

    // Границы
    const maxAllowed = availablePool != null ? availablePool + baseQuantity : Number.POSITIVE_INFINITY;
    const minAllowed =
        fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER' ? baseQuantity : 0;

    // Разрешения
    const hasOrder = currentQuantity > 0 || currentPackageCount > 0;
    const poolExhausted = isSupplement && availablePool != null && availablePool <= 1e-9;
    const isSoldOut = poolExhausted && !hasOrder;
    const canAdd = currentQuantity < maxAllowed;
    const canDecrease =
        currentQuantity > 0 &&
        (fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER' || currentQuantity > baseQuantity);

    // Лейбл остатка
    const freeRemainderLabel =
        isSupplement && availablePool != null && availablePool < Number.POSITIVE_INFINITY
            ? `Можно докинуть: ${availablePool} ${shortName}`
            : null;

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
