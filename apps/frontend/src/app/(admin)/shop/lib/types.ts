export interface ShopPurchaseSummary {
    id: number;
    supplier: string;
    tag: string;
    status: string;
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
