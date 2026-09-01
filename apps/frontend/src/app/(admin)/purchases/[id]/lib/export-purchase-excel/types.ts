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
};

export type ExportPurchase = {
    tag: string;
    status: string;
    fulfillmentStatus?: string | null;
    items: {
        id: number;
        minPackageAmount?: unknown;
        minPackageUnit?: string | null;
        packAmount?: unknown;
        packUnit?: string | null;
        publicationState: 'DRAFT' | 'PUBLISHED';
        tgMessageId?: string | null;
        targetRemainder?: unknown;
        supplierId?: number | null;
        supplier?: { id: number; name: string } | null;
        product: ExportProduct;
        orderLines: {
            userId: number;
            quantity: unknown;
            amountDue: unknown;
            supplementRemainder?: unknown;
            supplementPacksAdded?: unknown;
            user?: ExportUser;
        }[];
    }[];
};

export type ExportOrder = {
    id: number;
    userId: number;
    purchaseOrderId?: number | null;
    quantity: unknown;
    amountDue: unknown;
    user?: ExportUser;
    purchaseItem?: {
        id?: number;
        packAmount?: unknown;
        packUnit?: string | null;
        product?: ExportProduct;
    };
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

export type PurchaseExportData = {
    purchase: ExportPurchase;
    orders: ExportOrder[];
    payments: ExportPayment[];
    attributeTypes?: AttributeTypeMeta[];
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
