export interface DescriptionFields {
    name?: string;
    articleNumber?: string;
    brandName?: string;
    titleAttributes?: string[];
    attributeNames?: string[];
    productCharacteristics?: { name: string; value: string }[];
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    supplierLimit?: number | null;
    supplierLimitUnit?: string | null;
    supplierName?: string;
    purchaseTag?: string;
    packDiscountPercent?: number | null;
    pricePerPackCurrency?: number | null;
    currencyName?: string;
    packAmount?: number | null;
    packUnit?: string | null;
    orgFeePercent?: number | null;
    unitPriceRub?: number | null;
}
