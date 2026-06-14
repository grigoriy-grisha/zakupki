import { OrderLine } from '../../../src/order';
import type { OrderLineProps, PurchaseItem } from '../../../src/order';

/** Алиас типа стадии — короче писать в тестах. */
export type Stage = PurchaseItem['fulfillmentStatus'];

/**
 * Per-stage default matrix для `makeItem`.
 *
 * Нельзя схлопывать в один defaults-объект: collection/reorder/payment/admin
 * исторически задают разные `supplierPackageAmount`, `minPackageAmount` и
 * `targetRemainder`. Унификация тут сохраняет поведение исходных тестов.
 */
const STAGE_DEFAULTS: Record<Stage, Partial<PurchaseItem>> = {
    COLLECTION: {
        supplierPackageAmount: null,
        minPackageAmount: 1,
        targetRemainder: null,
    },
    REORDER: {
        supplierPackageAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    PAYMENT: {
        supplierPackageAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    SUPPLIER_ASSEMBLY: {
        supplierPackageAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    DELIVERY: {
        supplierPackageAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    CLOSED: {
        supplierPackageAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    CANCELLED: {
        supplierPackageAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
};

/**
 * Универсальная фабрика PurchaseItem. Defaults различаются по этапу
 * (см. STAGE_DEFAULTS), но большая часть полей — общая.
 *
 * Заменяет makeCollectionItem / makeReorderItem / makePaymentItem / makeItem
 * из исходных тестов.
 */
export function makeItem(stage: Stage, overrides: Partial<PurchaseItem> = {}): PurchaseItem {
    return {
        purchaseItemId: 42,
        pricePerUnit: 100,
        priceOverride: null,
        priceTiers: null,
        packDiscountPercent: 0,
        supplierPackageUnit: null,
        supplierPackagePrice: null,
        unitCode: 'piece',
        multiplicity: 1,
        minPackageUnit: null,
        supplementStep: null,
        supplierLimit: null,
        supplierLimitUnit: null,
        fulfillmentStatus: stage,
        ...STAGE_DEFAULTS[stage],
        ...overrides,
    };
}

/**
 * Дефолтные props OrderLine для тестов.
 *
 * `createdOnStage: 'COLLECTION'` как общий дефолт. Все тесты, где важна
 * стадия создания (PAYMENT+ и т.п.), передают `createdOnStage` явно.
 */
export function makeLineProps(overrides: Partial<OrderLineProps> = {}): OrderLineProps {
    return {
        id: 1,
        purchaseItemId: 42,
        userId: 1,
        quantity: 0,
        amountDue: 0,
        packageCount: 0,
        status: 'ACTIVE',
        createdOnStage: 'COLLECTION',
        baseQuantity: null,
        basePackageCount: null,
        ...overrides,
    };
}

/**
 * Замороженная COLLECTION-строка (после COLLECTION→REORDER→PAYMENT+).
 *
 * `basePackageCount` по умолчанию = `packageCount ?? 0` — это инвариант
 * "заморозки": пакеты на COLLECTION сохраняются как `basePackageCount`.
 */
export function makeFrozenCollectionLine(overrides: Partial<OrderLineProps> = {}): OrderLine {
    const pkg = overrides.packageCount ?? 0;
    return OrderLine.create(
        makeLineProps({
            id: 1,
            quantity: 80,
            amountDue: 8000,
            baseQuantity: 80,
            basePackageCount: pkg,
            createdOnStage: 'COLLECTION',
            ...overrides,
        }),
    );
}
