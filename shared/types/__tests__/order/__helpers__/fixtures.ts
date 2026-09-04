import type { OrderLineProps, PurchaseItem } from '../../../src/order';
import { OrderLine } from '../../../src/order';

/** Алиас типа стадии — короче писать в тестах. */
export type Stage = PurchaseItem['fulfillmentStatus'];

/** id тестовой валюты (используется во всех тестах новой модели цен). */
export const TEST_CURRENCY_ID = 1;

/** Курс валюты по умолчанию: 1:1 (pricePerPackCurrency уже в ₽). */
export const TEST_CURRENCY_RATES = [{ currencyId: TEST_CURRENCY_ID, rateToRub: 1 }];

/** Глобальный % оргсбора по умолчанию в тестах. */
export const TEST_ORG_FEE_PERCENT = 0;

/** Базовая цена за 1ед в ₽ (unitPriceRub), которую ожидают тесты по умолчанию. */
export const DEFAULT_UNIT_PRICE_RUB = 100;

/**
 * Per-stage default matrix для `makeItem`.
 *
 * Различаются `packAmount`, `minPackageAmount` и `targetRemainder` по этапу.
 * Цена выводится так, чтобы unitPriceRub = DEFAULT_UNIT_PRICE_RUB при любом packAmount:
 * pricePerPackCurrency = unitPriceRub × packAmount (rate=1, orgFee=0).
 */
const STAGE_DEFAULTS: Record<Stage, Partial<PurchaseItem>> = {
    COLLECTION: {
        packAmount: 1,
        minPackageAmount: 1,
        targetRemainder: null,
    },
    REORDER: {
        packAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    PAYMENT: {
        packAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    SUPPLIER_ASSEMBLY: {
        packAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    DELIVERY: {
        packAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    CLOSED: {
        packAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
    CANCELLED: {
        packAmount: 10,
        minPackageAmount: 1,
        targetRemainder: 50,
    },
};

/**
 * Универсальная фабрика PurchaseItem. Defaults различаются по этапу
 * (см. STAGE_DEFAULTS), но большая часть полей — общая.
 *
 * Новая модель цен активна всегда: unitPriceRub = DEFAULT_UNIT_PRICE_RUB (100 ₽/ед).
 * Чтобы изменить цену — переопределите pricePerPackCurrency/currencyRates в overrides.
 */
export function makeItem(stage: Stage, overrides: Partial<PurchaseItem> = {}): PurchaseItem {
    const stageDefaults = STAGE_DEFAULTS[stage];
    // Сначала разрешаем packAmount с учётом overrides (важно для расчёта цены).
    const packAmount = overrides.packAmount ?? stageDefaults.packAmount ?? 1;
    // pricePerPackCurrency выводим из желаемой unitPrice, если не задано явно.
    const pricePerPackCurrency =
        overrides.pricePerPackCurrency ?? DEFAULT_UNIT_PRICE_RUB * packAmount;

    return {
        purchaseItemId: 42,
        // ── Новая модель цен (валюта + курс + оргсбор) ──
        packDiscountPercent: 0,
        packAmount,
        packUnit: null,
        currencyId: TEST_CURRENCY_ID,
        pricePerPackCurrency,
        orgFeePercentOverride: null,
        orgFeeDefaultPercent: TEST_ORG_FEE_PERCENT,
        deliveryPercentOverride: null,
        deliveryPercent: 0,
        currencyRates: TEST_CURRENCY_RATES,
        // ── Параметры фасовки ──
        unitCode: 'gram',
        multiplicity: 1,
        minPackageUnit: null,
        supplementStep: null,
        // ── Параметры закупки ──
        supplierLimit: null,
        supplierLimitUnit: null,
        supplierId: null,
        supplierName: null,
        fulfillmentStatus: stage,
        ...stageDefaults,
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
