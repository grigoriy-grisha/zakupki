import type { PurchaseFulfillmentStatus } from '@zakupki/types';

// ── Purchase ──────────────────────────────────────────────────

export interface ShopPurchaseSummary {
    id: number;
    supplier: string;
    tag: string;
    status: string;
    fulfillmentStatus?: PurchaseFulfillmentStatus | null;
    deadline: string | Date;
}

export interface ShopMyPurchaseCardProps {
    purchase: ShopPurchaseSummary;
    payment: import('../hooks/use-purchase-payment-map').PurchasePaymentInfo;
}

export interface AvailablePurchaseCardProps {
    purchase: ShopPurchaseSummary & {
        minAmount: string | number;
        items: { orderLines: { amountDue: unknown }[] }[];
    };
}

// ── Product (внутри PurchaseItem) ─────────────────────────────

export interface ShopPurchaseItemProduct {
    id: number;
    name: string;
    pricePerUnit: string | number;
    unitCode: string;
    multiplicity: string | number;
    minPackageAmount: string | number | null;
    minPackageUnit: string | null;
    supplierPackageAmount?: string | number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: string | number | null;
    photos: { id: number }[];
    priceTiers?: unknown;
}

// ── PurchaseItem (для shop) ───────────────────────────────────

export interface ShopOrderLineInItem {
    userId: number;
    quantity: string | number;
    baseQuantity: string | number | null;
    status?: string | null;
}

export interface ShopPurchaseItem {
    id: number;
    purchaseItemId?: number;
    priceOverride: string | null;
    targetRemainder: string | number | null;
    supplementStep?: string | number | null;
    supplierLimit?: string | number | null;
    supplierLimitUnit?: string | null;
    minQty: string | number | null;
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
