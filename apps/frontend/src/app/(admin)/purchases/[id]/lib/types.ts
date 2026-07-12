import type { ProductLabelSource } from '../../../products/lib';

/** Фото товара (из Prisma include) */
export interface PhotoRef {
    id: number;
    sortOrder: number;
}

/** Единица измерения товара */
export interface UnitRef {
    id: number;
    name: string;
    shortName: string;
}

/** Поставщик, привязанный к позиции закупки (опц.) */
export interface SupplierRef {
    id: number;
    name: string;
}

/** Продукт внутри PurchaseItem — теперь только каталожные данные. */
export interface PurchaseItemProduct extends ProductLabelSource {
    id: number;
    unit?: UnitRef | null;
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
    // Per-purchase конкретика (перенесена с Product):
    description?: string | null;
    pricePerUnit?: number | string | null;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    priceTiers?: unknown;
    supplierPackageAmount?: string | number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: string | number | null;
    supplierPackageTiers?: unknown;
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
    items: PurchaseItem[];
    payments?: PaymentRef[];
}
