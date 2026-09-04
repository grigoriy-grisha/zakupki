import type { CurrencyRate, OrderLineRowLike, PackDiscountPricingInfo, PurchaseItem } from '@zakupki/types';
import {
    buildOrderQtyOptions,
    computeAmountDueWithPackages,
    computePackagePrice,
    computeUnitPriceRubNewModel,
    countFullSupplierPacks,
    getActiveStep,
    getPackDiscountPricingInfo,
    getUnitByCode,
    isOrderingClosedStage,
    isSupplementPhase,
    isWeightUnit,
    mapToPurchaseItem,
    OrderBook,
    toOrderLinesVO,
} from '@zakupki/types';

import type { ShopPurchaseItem } from './types';

export interface ItemOrderContextInput {
    item: ShopPurchaseItem;
    currentQuantity: number;
    currentPackageCount: number;
    baseQuantity: number;
    fulfillmentStatus: string;
    deliveryPercent?: number;
    packDiscountPercent: number;
    orgFeeDefaultPercent: number;
    currencyRates: CurrencyRate[];
}

export interface ItemOrderContext {
    /** Короткое название единицы (гр, шт, ...) */
    shortName: string;
    /** Цена за единицу: новая модель (валюта × курс × оргсбор) приоритетнее старой
     * (priceOverride/pricePerUnit). 0 если обе модели не заданы. */
    price: number;
    /** Цена за единицу по новой модели, либо null если новая модель не активна.
     * Используется ProductPricePanel для выбора способа отображения цены. */
    unitPriceRub: number | null;

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
    /** Можно ли добавить упаковку. Ограничено только supplierLimit, НЕ пулом/остатком
     *  (упаковки — базовая фасовка, а не добор). Совпадает с бэком (validateSupplierLimit). */
    canAddPackage: boolean;
    packagePrice: number;
    packageTotal: number;

    // Цены
    total: number;
    fullPacks: number;
    /** Скидка за целую пачку (null — нет скидки/нет данных). */
    packDiscountInfo: PackDiscountPricingInfo | null;

    // Разрешения
    canAdd: boolean;
    canDecrease: boolean;
    hasOrder: boolean;
    /** Приём заказов закрыт (фасовка и далее). */
    orderingClosed: boolean;

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
    const {
        item,
        currentQuantity,
        currentPackageCount,
        baseQuantity,
        fulfillmentStatus,
        deliveryPercent,
        packDiscountPercent,
        orgFeeDefaultPercent,
        currencyRates,
    } = input;
    const product = item.product;
    const unit = getUnitByCode(product.unitCode);
    const shortName = unit?.shortName ?? 'ед.';
    const multiplicity = Number(product.multiplicity) || 1;

    const minPackageAmount = item.minPackageAmount != null ? Number(item.minPackageAmount) : null;
    const minPackageUnit = item.minPackageUnit ?? null;
    const packSize = item.packAmount != null ? Number(item.packAmount) : null;

    const orderQtyOptions = buildOrderQtyOptions({
        multiplicity,
        minPackageAmount,
        minPackageUnit,
        purchaseItemMinQty: item.minQty != null ? Number(item.minQty) : null,
        unitShort: shortName,
        unitCode: product.unitCode,
    });

    const activeStep = getActiveStep({
        fulfillmentStatus,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        options: orderQtyOptions,
    });

    // Пул добора — через доменный aggregate OrderBook.remainder (сырой пул, без userId).
    // currentQuantity в расчёте пула не участвует (используется ниже для maxAllowed/canAddMore),
    // поэтому достаточно глобального остатка книги.
    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const purchaseItem: PurchaseItem = mapToPurchaseItem(
        {
            id: item.id,
            // Новая модель цен (валюта + курс + оргсбор):
            pricePerPackCurrency:
                item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
            currencyId: item.currencyId ?? null,
            packAmount: item.packAmount != null ? Number(item.packAmount) : null,
            packUnit: item.packUnit ?? null,
            orgFeePercentOverride:
                item.orgFeePercentOverride != null ? Number(item.orgFeePercentOverride) : null,
            deliveryPercentOverride:
                item.deliveryPercentOverride != null ? Number(item.deliveryPercentOverride) : null,
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
        { orgFeeDefaultPercent, currencyRates, deliveryPercent },
    );
    const book = OrderBook.create(purchaseItem, toOrderLinesVO((item.orderLines ?? []) as OrderLineRowLike[]));
    const availablePool = book.remainder;

    // Цена за единицу по новой модели (валюта × курс × оргсбор). null если не активна.
    const unitPriceRub = computeUnitPriceRubNewModel(purchaseItem);
    const price = unitPriceRub ?? 0;

    const poolEmptyForUser = isSupplement && availablePool != null && availablePool <= 1e-9 && currentQuantity <= 0;
    const freeRemainderLabel =
        isSupplement && availablePool != null && availablePool < Number.POSITIVE_INFINITY && !poolEmptyForUser
            ? `Можно добавить: ${availablePool} ${shortName}`
            : null;

    const isWeight = isWeightUnit(product.unitCode);
    const hasSupplierPackage = packSize != null && packSize > 0;
    const canAddPackage = fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER';
    const showPackageButtons = canAddPackage && hasSupplierPackage && isWeight;

    // Лимит на упаковки — только по supplierLimit (жёсткий лимит товара).
    // Остаток/пул добора НЕ ограничивает упаковки: упаковка = базовая фасовка,
    // а не добор. Бэкенд (ReorderStrategy.adjustPackages) проверяет только
    // validateSupplierLimit, не validateSupplementPool — здесь та же логика.
    // supplierMaxAllowed = supplierLimit − totalOrderedWithPackages + effectiveUserQty
    // (totalOrderedWithPackages уже включает effectiveUserQty, поэтому компенсируем).
    const supplierLimitNum = item.supplierLimit != null ? Number(item.supplierLimit) : null;
    let canAddMorePackages: boolean;
    if (!showPackageButtons || packSize == null) {
        canAddMorePackages = false;
    } else if (supplierLimitNum == null) {
        // Нет жёсткого лимита → упаковки без ограничений.
        canAddMorePackages = true;
    } else {
        const effectiveUserQty = currentQuantity + currentPackageCount * packSize;
        const totalOrderedWithPackages = (item.orderLines ?? [])
            .filter((l) => (l as { status?: string }).status !== 'CANCELLED')
            .reduce(
                (sum, l) =>
                    sum +
                    Number((l as { quantity?: unknown }).quantity ?? 0) +
                    Number((l as { packageCount?: unknown }).packageCount ?? 0) * packSize,
                0,
            );
        const supplierMaxAllowed = supplierLimitNum - totalOrderedWithPackages + effectiveUserQty;
        canAddMorePackages = effectiveUserQty + packSize <= supplierMaxAllowed + 1e-9;
    }
    const packagePrice = computePackagePrice(purchaseItem);
    const packageTotal = currentPackageCount * packagePrice;
    const total = computeAmountDueWithPackages(currentQuantity, currentPackageCount, purchaseItem);
    const packDiscountInfo = isWeight
        ? getPackDiscountPricingInfo(packSize, packagePrice, packDiscountPercent)
        : null;
    const effectiveQty = currentQuantity + currentPackageCount * (packSize ?? 0);
    const fullPacks = packDiscountInfo != null ? countFullSupplierPacks(effectiveQty, packDiscountInfo.packSize) : 0;

    // Границы — ЕДИНОЕ правило с бэком: maxAllowed = pool + currentQuantity
    const maxAllowed =
        availablePool != null && Number.isFinite(availablePool)
            ? availablePool + currentQuantity
            : Number.POSITIVE_INFINITY;
    const minAllowed = fulfillmentStatus !== 'COLLECTION' && fulfillmentStatus !== 'REORDER' ? baseQuantity : 0;

    // Разрешения
    const orderingClosed = isOrderingClosedStage(fulfillmentStatus);
    const hasOrder = currentQuantity > 0 || currentPackageCount > 0;
    const poolExhausted = isSupplement && availablePool != null && availablePool <= 1e-9;
    const isSoldOut = poolExhausted && !hasOrder;
    const canAdd = !orderingClosed && currentQuantity < maxAllowed;
    const canDecrease =
        currentQuantity > 0 &&
        (fulfillmentStatus === 'COLLECTION' || fulfillmentStatus === 'REORDER' || currentQuantity > baseQuantity);

    return {
        shortName,
        price,
        unitPriceRub,
        currentQuantity,
        currentPackageCount,
        activeStep,
        isSupplement,
        availablePool,
        isSoldOut,
        freeRemainderLabel,
        packSize,
        showPackageButtons,
        canAddPackage: canAddMorePackages,
        packagePrice,
        packageTotal,
        total,
        fullPacks,
        packDiscountInfo,
        canAdd,
        canDecrease,
        hasOrder,
        orderingClosed,
        maxAllowed,
        minAllowed,
    };
}
