/**
 * Чистые доменные типы заказа.
 *
 * Никаких зависимостей от Prisma, Decimal или других библиотек —
 * только plain TypeScript interfaces/types. Все числовые поля — number
 * (преобразование Decimal→number делается на границе приложения).
 */
import type { PriceTier } from '../pricing/types';
import type { PurchaseFulfillmentStatus } from '../index';

// ── Value Objects ──────────────────────────────────────────────────

/** Одна строка заказа (immutable value object). */
export interface OrderLineVO {
    id: number;
    purchaseItemId: number;
    userId: number;
    /** Количество товара (number, не Decimal). */
    quantity: number;
    /** Сумма к оплате (number, не Decimal). */
    amountDue: number;
    /** Количество целых упаковок поставщика. */
    packageCount: number;
    status: OrderLineStatus;
    /** Этап, на котором создана строка. COLLECTION — базовый заказ, иначе — добор. */
    createdOnStage: PurchaseFulfillmentStatus;
    /** Замороженный снимок quantity из COLLECTION. null — заморозки не было / supplement-строка. */
    baseQuantity: number | null;
    /** Замороженный снимок packageCount из COLLECTION. null — заморозки не было / supplement-строка. */
    basePackageCount: number | null;
}

export type OrderLineStatus = 'ACTIVE' | 'CANCELLED';

/**
 * Товар закупки — параметры, НЕ зависящие от строк заказа (прайс, фасовка, этап).
 * В ООП-модели строки живут отдельно в `OrderBook.lines`.
 *
 * Заполняется на границе приложения из Prisma-объекта (см. order-domain-mapper).
 */
export interface PurchaseItem {
    purchaseItemId: number;

    // ── Цены (per-purchase) ──
    pricePerUnit: number;
    priceOverride: number | null;
    priceTiers: PriceTier[] | null;
    /** Скидка за целые пачки (глобальная настройка). */
    packDiscountPercent: number;

    // ── Упаковка поставщика (per-purchase) ──
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;
    supplierPackageTiers: PriceTier[] | null;

    // ── Параметры фасовки (per-purchase) ──
    unitCode: string;
    multiplicity: number;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    /** Шаг +/− на этапе добора (REORDER+). null — обычная фасовка. */
    supplementStep: number | null;

    // ── Параметры закупки ──
    fulfillmentStatus: PurchaseFulfillmentStatus;
    /** Явно заданный админом остаток добора. null — авторасчёт по пачкам. */
    targetRemainder: number | null;
    /**
     * Глобальный лимит остатка у поставщика (в ед. supplierLimitUnit).
     * Суммарно все пользователи не могут заказать больше этого лимита ни на одном этапе.
     * null — без ограничений.
     */
    supplierLimit: number | null;
    supplierLimitUnit: string | null;

    // ── Поставщик (опц.) ──
    /** null — без поставщика. */
    supplierId: number | null;
    /** Денормализованное имя поставщика для UI/логов (не использовать для логики). */
    supplierName: string | null;
}

// ── Эффекты (результат операций) ───────────────────────────────────

/**
 * Инструкция для persistence-слоя: что сделать со строкой заказа.
 * Домен ВЫЧИСЛЯЕТ эффект, ApplicationService — ВЫПОЛНЯЕТ его через репозиторий.
 */
export type OrderEffect =
    | {
          type: 'upsert';
          purchaseItemId: number;
          userId: number;
          createdOnStage: PurchaseFulfillmentStatus;
          quantity: number;
          amountDue: number;
          /** undefined — оставить прежнее количество упаковок. */
          packageCount?: number;
      }
    | {
          type: 'delete';
          lineId: number;
      };

// ── Результаты операций ────────────────────────────────────────────

export interface OrderError {
    code: OrderErrorCode;
    message: string;
    /** Сколько ещё можно добавить (для pool_exceeded). */
    canAddMore?: number;
    unitShort?: string;
}

export type OrderErrorCode =
    | 'forbidden'
    | 'pool_exceeded'
    | 'limit_exceeded'
    | 'below_base'
    | 'no_package'
    | 'negative'
    | 'invalid_quantity';

// ── Пул добора ─────────────────────────────────────────────────────

/**
 * Агрегация строк заказа.
 *
 * `totalOrderedQuantity` — сырая сумма quantity (без пакетов). Используется для
 * расчёта pool добора (supplementClaimed).
 *
 * `totalOrderedWithPackages` — effective qty = qty + пакеты * packSize. Используется
 * для supplier limit: глобальный лимит у поставщика учитывает и qty, и пакеты.
 *
 * Эти два значения могут отличаться: пакеты = часть базовой фасовки (не добор),
 * но считаются как qty для лимита.
 */
export interface PoolAggregation {
    totalBaseQuantity: number;
    supplementClaimed: number;
    totalOrderedQuantity: number;
    totalOrderedWithPackages: number;
}

export interface PoolInfo {
    /** null — пул не ограничивает (COLLECTION или нет пачек/remainder). */
    pool: number | null;
    /** Сколько максимум может иметь пользователь (pool + текущее). */
    maxAllowed: number;
    /** Сколько ещё можно добавить этому пользователю. */
    canAddMore: number;
    /** Сколько все пользователи УЖЕ добрали сверх базы. */
    supplementClaimed: number;
    totalBaseQuantity: number;
    totalOrderedQuantity: number;
    /** Effective qty = qty + пакеты*packSize. Для supplier limit. */
    totalOrderedWithPackages: number;
}

// ── Агрегация ──────────────────────────────────────────────────────

/**
 * Объединённое представление строк пользователя для одного purchaseItem
 * (COLLECTION + supplement слиты воедино для отображения).
 */
export interface AggregatedOrder {
    purchaseItemId: number;
    /** Сумма quantity всех строк. */
    quantity: number;
    /** Сумма amountDue всех строк. */
    amountDue: number;
    /** Сумма packageCount всех строк (COLLECTION + REORDER-pkg). */
    packageCount: number;
    /** baseQuantity из COLLECTION-строки (замороженный снимок). */
    baseQuantity: number;
    /** basePackageCount из COLLECTION-строки (замороженный снимок). */
    basePackageCount: number;
    /** Оригинальные ID строк. */
    lineIds: number[];
}

/** Контекст для UI (кнопки, лейблы, разрешения). */
export interface OrderDisplayContext {
    shortName: string;
    price: number;
    currentQuantity: number;
    currentPackageCount: number;
    /** Текущий шаг кнопок ± (зависит от этапа и supplementStep). */
    activeStep: number;
    isSupplement: boolean;
    pool: PoolInfo | null;
    isSoldOut: boolean;
    packSize: number | null;
    showPackageButtons: boolean;
    packagePrice: number;
    packageTotal: number;
    total: number;
    fullPacks: number;
    canAdd: boolean;
    canDecrease: boolean;
    hasOrder: boolean;
    maxAllowed: number;
    minAllowed: number;
}
