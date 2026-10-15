import type { AttributeTypeMeta, ProductLabelSource } from '@/lib/product-label';

export type ExportUser = {
    firstName: string;
    lastName?: string | null;
    username?: string | null;
    phone?: string | null;
    telegramCredential?: {
        telegramId: string;
        username?: string | null;
    } | null;
    vkCredential?: {
        vkId: string;
    } | null;
};

export type ExportProduct = ProductLabelSource & {
    unitCode: string;
    multiplicity?: unknown;
};

export type ExportCurrencyRate = {
    currencyId: number;
    rateToRub: unknown;
};

export type ExportPurchaseItem = {
    id: number;
    description?: string | null;
    minPackageAmount?: unknown;
    minPackageUnit?: string | null;
    supplementStep?: unknown;
    packAmount?: unknown;
    packUnit?: string | null;
    unitCode?: string | null;
    currencyId?: number | null;
    pricePerPackCurrency?: unknown;
    orgFeePercentOverride?: unknown;
    deliveryPercentOverride?: unknown;
    publicationState: 'DRAFT' | 'PUBLISHED';
    tgMessageId?: string | null;
    targetRemainder?: unknown;
    supplierId?: number | null;
    supplier?: { id: number; name: string } | null;
    product: ExportProduct;
};

export type ExportPurchase = {
    tag: string;
    status: string;
    fulfillmentStatus?: string | null;
    deliveryPercent?: unknown;
    currencyRates?: ExportCurrencyRate[];
    items: ExportPurchaseItem[];
};

export type ExportOrderLineItem = {
    id?: number;
    packAmount?: unknown;
    packUnit?: string | null;
    unitCode?: string | null;
    product?: ExportProduct;
};

export type ExportOrder = {
    id: number;
    userId: number;
    purchaseOrderId?: number | null;
    quantity: unknown;
    amountDue: unknown;
    packageCount?: unknown;
    user?: ExportUser;
    purchaseItem?: ExportOrderLineItem;
};

export type ExportPayment = {
    id: number;
    userId: number;
    amount: unknown;
    status: string;
    submittedAt: string | Date;
    userComment?: string | null;
    adminNote?: string | null;
    user?: ExportUser;
    children?: { amount: unknown; promoCode?: { code: string } | null }[];
};

export type ExportPurchaseOrder = {
    id: number;
    userId: number;
    user?: ExportUser;
};

export type ExportPricingSettings = {
    beadPackPriceDiscountPercent: number;
    orgFeeDefaultPercent: number;
};

export type PurchaseExportData = {
    purchase: ExportPurchase;
    orders: ExportOrder[];
    payments: ExportPayment[];
    purchaseOrders?: ExportPurchaseOrder[];
    attributeTypes?: AttributeTypeMeta[];
    pricing: ExportPricingSettings;
};

export type ExportParticipant = {
    userId: number;
    purchaseOrderId: number | null;
    name: string;
    phone: string;
    tgUsername: string;
    telegramId: string;
    vkId: string;
};
