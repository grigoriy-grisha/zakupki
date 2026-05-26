import type { ReactNode } from 'react';
import type { z } from 'zod';

import type { usePurchasePaymentDetail } from '../shop/hooks/use-purchase-payment-map';
import type { addPaymentSchema, newPurchaseSchema } from '../purchases/lib/schema';
import type { productSchema, categorySchema } from '../products/lib/schema';
import type { unitSchema } from '../settings/units/lib/schema';
import type { promoCodeSchema } from '../settings/promo-codes/lib/schema';

export type NewPurchaseValues = z.infer<typeof newPurchaseSchema>;
export type AddPaymentValues = z.infer<typeof addPaymentSchema>;
export type ProductFormValues = z.infer<typeof productSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type UnitFormValues = z.infer<typeof unitSchema>;
export type PromoCodeFormValues = z.infer<typeof promoCodeSchema>;


export type PurchasePaymentInfo = {
    due: number;
    paid: number;
    hasPending: boolean;
    remaining: number;
};

export type PurchasePaymentDetail = ReturnType<typeof usePurchasePaymentDetail>;

export interface ShopPurchaseSummary {
    id: number;
    supplier: string;
    tag: string;
    status: string;
    deadline: string | Date;
}

export interface ShopMyPurchaseCardProps {
    purchase: ShopPurchaseSummary;
    payment: PurchasePaymentInfo;
}

export interface AvailablePurchaseCardProps {
    purchase: ShopPurchaseSummary & {
        minAmount: string | number;
        items: { orderLines: { amountDue: unknown }[] }[];
    };
}

export interface ShopPurchaseItemProductCardProps {
    item: {
        id: number;
        priceOverride: string | null;
        availableQty: string | number | null;
        minQty: string | number | null;
        product: {
            name: string;
            pricePerUnit: string | number;
            unit: { shortName: string; multiplicity: string | number } | null;
            minPackageAmount: string | number | null;
            minPackageUnit: string | null;
            photos: { id: number }[];
        };
    };
    isOrdered: boolean;
    isSupplement: boolean;
    onSelect: (itemId: number) => void;
}

export interface QuantityModalProps {
    purchaseItemId: number;
    purchaseId: number;
    currentQuantity?: number;
    onClose: () => void;
}

export interface PaymentDialogProps {
    purchaseId: number;
    remaining: number;
    hasPending: boolean;
}

export interface OrdersSummaryCardProps {
    paymentDetail: PurchasePaymentDetail;
    paymentDialog: ReactNode;
}

export interface AdminPurchaseListCardProps {
    purchase: {
        id: number;
        tag: string;
        supplier: string;
        status: string;
        deadline: string;
        items: { orderLines: { amountDue: unknown }[] }[];
    };
}

export interface ItemsTabProps {
    purchaseId: number;
    onEditSupplement?: () => void;
}

export interface PaymentDetailDialogProps {
    payment: {
        id: number;
        userId: number;
        amount: unknown;
        status: string;
        paidAt: string;
        userComment?: string;
        adminNote?: string;
        proofData?: unknown;
        proofMimeType?: string;
        user?: { firstName: string; lastName?: string | null };
        children?: { amount: unknown; promoCode: { code: string } | null }[];
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchaseId: number;
}

export interface SupplementDialogProps {
    purchaseId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export interface ProductPickerDialogProps {
    purchaseId: number;
    existingProductIds: Set<number>;
}

export interface AddPaymentDialogProps {
    purchaseId: number;
}

export interface ParticipantsTabProps {
    purchaseId: number;
}

export interface ParticipantRowProps {
    name: string;
    username?: string;
    orders: {
        id: number;
        purchaseItemId: number;
        quantity: unknown;
        amountDue: unknown;
        purchaseItem?: {
            product?: { name?: string; unit?: { shortName: string }; pricePerUnit: unknown };
            priceOverride?: unknown;
        };
    }[];
    payments: {
        id: number;
        amount: unknown;
        paidAt: string;
        status: string;
        userComment?: string | null;
        proofData?: unknown;
        children?: { amount: unknown; promoCode: { code: string } | null }[];
    }[];
    due: number;
    paid: number;
    pending: number;
    onPaymentClick: (id: number) => void;
}

export interface CatalogProductCardProps {
    product: {
        id: number;
        name: string;
        pricePerUnit: string | number;
        unit: { shortName: string } | null;
        minPackageAmount: string | number | null;
        minPackageUnit: string | null;
        photos: { id: number }[];
    };
    onClick: () => void;
}

export interface PhotoUploaderProps {
    photoIds: number[];
    onPhotoIdsChange: (ids: number[]) => void;
    productId: number;
    onDeletePhoto: (id: number) => Promise<void>;
}

export interface ProductFormProps {
    editId: number | null;
    existing: {
        name: string;
        description: string | null;
        unitId: number;
        pricePerUnit: string | number;
        sku: string | null;
        categoryId: number | null;
        minPackageAmount: string | number | null;
        minPackageUnit: string | null;
        priceTiers: unknown;
        supplierPackageAmount: string | number | null;
        supplierPackageUnit: string | null;
        supplierPackagePrice: string | number | null;
        availableAmount: string | number | null;
        availableUnit: string | null;
        photos: { id: number }[];
    } | null | undefined;
    onSuccess: () => void;
}

export interface ProductSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editId: number | null;
}

export interface UserOrdersRowProps {
    userId: number;
    userName: string;
}

export interface UnitFormDialogProps {
    mode: 'create' | 'edit';
    unit?: { id: number; name: string; shortName: string; multiplicity: string | number };
}

export type PromoWithDates = {
    isActive: boolean;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
};

export type PromoStatus = {
    label: string;
    className: string;
};

export interface PromoCodeRowProps {
    promo: {
        id: number;
        code: string;
        label: string | null;
        type: 'PERCENT' | 'FIXED';
        value: string | number;
        purchase: unknown;
        usedCount: number;
        maxUses: number | null;
        minAmount: string | null;
        expiresAt: string | null;
        isActive: boolean;
    };
    onDelete: (promo: { id: number; code: string }) => void;
}
