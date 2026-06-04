import type { SupplierPackProductFields } from '@zakupki/types';

export type ProductPriceDescriptionFields = SupplierPackProductFields & {
    pricePerUnit: string | number;
    priceTiers?: unknown;
};
