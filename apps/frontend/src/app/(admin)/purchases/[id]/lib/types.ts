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

/** Продукт внутри PurchaseItem */
export interface PurchaseItemProduct extends ProductLabelSource {
    id: number;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    supplierPackageAmount?: string | number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: string | number | null;
    supplierPackageTiers?: unknown;
    priceTiers?: unknown;
    pricePerUnit?: number | null;
    availableAmount?: string | number | null;
    availableUnit?: string | null;
    description?: string | null;
    unit?: UnitRef | null;
    photos?: PhotoRef[];
}

/** Строка заказа в PurchaseItem */
export interface OrderLineRef {
    id: number;
    userId: number;
    quantity: number;
    amountDue: number;
    createdAt: string;
}

/** PurchaseItem (позиция товара в закупке) */
export interface PurchaseItem {
    id: number;
    productId: number;
    purchaseId: number;
    shouldPublish: boolean;
    tgMessageId: string | null;
    tgChannelId: string | null;
    availableQty: string | number | null;
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
    paidAt: string;
    status: string;
    userComment?: string | null;
    adminNote?: string | null;
    proofData?: unknown;
    proofMimeType?: string | null;
    proofObjectKey?: string | null;
    user?: UserBrief;
    children?: { amount: unknown; promoCode: { code: string } | null }[];
}

/** Результат purchases.getById */
export interface PurchaseDetail {
    id: number;
    tag: string;
    supplier: string;
    minAmount: number | string;
    deadline: string | Date;
    status: string;
    fulfillmentStatus?: string | null;
    items: PurchaseItem[];
    payments?: PaymentRef[];
}
