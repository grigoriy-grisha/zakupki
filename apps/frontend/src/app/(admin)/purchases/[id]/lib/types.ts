import type { ProductLabelSource } from '@/lib/product-label';

/** Фото товара (из Prisma include) */
export interface PhotoRef {
    id: number;
    sortOrder: number;
}

/** Поставщик, привязанный к позиции закупки (опц.) */
export interface SupplierRef {
    id: number;
    name: string;
}

/** Валюта из справочника */
export interface CurrencyRef {
    id: number;
    name: string;
    code?: string | null;
    symbol?: string | null;
}

/** Ставка валюты в закупке */
export interface PurchaseCurrencyRateRef {
    id: number;
    purchaseId: number;
    currencyId: number;
    rateToRub: string | number;
    currency: CurrencyRef;
}

/** Продукт внутри PurchaseItem — теперь только каталожные данные. */
export interface PurchaseItemProduct extends ProductLabelSource {
    id: number;
    /** Плоский код единицы измерения (gram | piece | tube), как в схеме Product.unitCode. */
    unitCode: string;
    photos?: PhotoRef[];
}

/** Строка заказа в PurchaseItem */
export interface OrderLineRef {
    id: number;
    userId: number;
    purchaseItemId: number;
    quantity: number;
    amountDue: number;
    /** Целые упаковки поставщика (пачки). */
    packageCount?: number;
    /** Статус строки: ACTIVE | CANCELLED. */
    status?: string;
    createdAt: string;
    /** Заказ из фазы COLLECTION, зафиксирован при входе в SUPPLEMENT/REORDER. */
    baseQuantity?: number | string | null;
    /** Целые пачки, добавленные в доборе. */
    supplementPacksAdded?: number;
    /** Свободная добавка (россыпью) на доборе. */
    supplementRemainder?: number | string | null;
}

/** PurchaseItem (позиция товара в закупке). Вся per-purchase конкретика —
 *  описание, цены, фасовка — хранится здесь. */
export interface PurchaseItem {
    id: number;
    productId: number;
    purchaseId: number;
    publicationState: 'DRAFT' | 'PUBLISHED';
    tgMessageId: string | null;
    tgChannelId: string | null;
    targetRemainder: string | number | null;
    supplementStep?: string | number | null;
    /** Глобальный лимит остатка у поставщика (per-purchase). */
    supplierLimit?: string | number | null;
    supplierLimitUnit?: string | null;
    // Per-purchase конкретика:
    description?: string | null;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    // Новая модель цен (валюта + курс + оргсбор):
    packAmount?: string | number | null;
    packUnit?: string | null;
    currencyId?: number | null;
    currency?: CurrencyRef | null;
    pricePerPackCurrency?: string | number | null;
    orgFeePercentOverride?: string | number | null;
    deliveryPercentOverride?: string | number | null;
    // Операционные количества (заполняет организатор):
    orderedQty?: string | number | null;
    assembledQty?: string | number | null;
    reorderedQty?: string | number | null;
    // Комментарий организатора + скрытие товара:
    adminComment?: string | null;
    hidden?: boolean;
    // Поставщик:
    supplierId?: number | null;
    supplier?: SupplierRef | null;
    product: PurchaseItemProduct;
    orderLines: OrderLineRef[];
}

/** Краткая информация о пользователе */
export interface UserBrief {
    firstName: string;
    lastName?: string | null;
    username?: string;
}

/** Платёж внутри закупки */
export interface PaymentRef {
    id: number;
    userId: number;
    amount: unknown;
    submittedAt: string;
    status: string;
    userComment?: string | null;
    adminNote?: string | null;
    proofObjectKey?: string | null;
    user?: UserBrief;
    children?: { amount: unknown; promoCode: { code: string } | null }[];
}

/** Результат purchases.getById */
export interface PurchaseDetail {
    id: number;
    tag: string;
    status: string;
    fulfillmentStatus?: string | null;
    deliveryPercent?: string | number | null;
    items: PurchaseItem[];
    currencyRates?: PurchaseCurrencyRateRef[];
    payments?: PaymentRef[];
}
