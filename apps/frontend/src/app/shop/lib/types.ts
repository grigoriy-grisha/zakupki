import type { PurchaseFulfillmentStatus } from '@zakupki/types';

// ── Purchase ──────────────────────────────────────────────────

export interface ShopPurchaseSummary {
    id: number;
    tag: string;
    status: string;
    fulfillmentStatus?: PurchaseFulfillmentStatus | null;
}

export interface ShopMyPurchaseCardProps {
    purchase: ShopPurchaseSummary;
    payment: import('../hooks/use-purchase-payment-map').PurchasePaymentInfo;
}

export interface AvailablePurchaseCardProps {
    purchase: ShopPurchaseSummary & {
        items: { orderLines: { amountDue: unknown }[] }[];
    };
}

// ── Product (внутри PurchaseItem) — только каталожные данные ──

export interface ShopPurchaseItemProduct {
    id: number;
    name: string;
    unitCode: string;
    multiplicity: string | number;
    photos: { id: number }[];
}

// ── PurchaseItem (для shop) ───────────────────────────────────

export interface ShopOrderLineInItem {
    userId: number;
    quantity: string | number;
    baseQuantity: string | number | null;
    status?: string | null;
}

/** Поставщик, привязанный к позиции (опц.) */
export interface ShopSupplierRef {
    id: number;
    name: string;
}

export interface ShopPurchaseItem {
    id: number;
    purchaseItemId?: number;
    // Per-purchase конкретика:
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    supplementStep?: string | number | null;
    // Новая модель цен (валюта + курс + оргсбор):
    pricePerPackCurrency?: string | number | null;
    currencyId?: number | null;
    packAmount?: string | number | null;
    packUnit?: string | null;
    orgFeePercentOverride?: string | number | null;
    targetRemainder: string | number | null;
    supplierLimit?: string | number | null;
    supplierLimitUnit?: string | null;
    minQty: string | number | null;
    supplierId?: number | null;
    supplier?: ShopSupplierRef | null;
    product: ShopPurchaseItemProduct;
    orderLines: ShopOrderLineInItem[];
}

// ── OrderLine (из getMyOrders) ────────────────────────────────

export interface ShopOrderLine {
    id: number;
    purchaseItemId: number;
    quantity: number;
    packageCount: number;
    baseQuantity: number | null;
    amountDue: number;
    status: string | null;
    userId: number;
    purchaseItem?: {
        purchaseId: number;
        product?: {
            name?: string;
            unitCode?: string;
            photos?: { id: number }[];
        };
    };
}
