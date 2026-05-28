import { z } from 'zod';

export const PACKAGE_UNITS = ['гр', 'шт', 'туба'] as const;
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

export const priceTierSchema = z.object({
    amount: z.coerce.number().positive('Укажите количество'),
    unit: z.string().min(1, 'Выберите ед.'),
    price: z.coerce.number().nonnegative('Цена не может быть отрицательной'),
});
export type PriceTierValues = z.infer<typeof priceTierSchema>;

/** Schema for creating a product */
export const productCreateSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    articleNumber: z.string().optional(),
    categoryId: z.number().nullable(),
    manufacturerId: z.number().nullable(),
    sizeId: z.number().nullable(),
    formId: z.number().nullable(),
    productLineId: z.number().nullable(),
});

export type ProductCreateFormValues = z.infer<typeof productCreateSchema>;

/** Full product fields (prices, description) — for use outside catalog sheet */
export const productSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    articleNumber: z.string().optional(),
    description: z.string().optional(),
    unitId: z.coerce.number().positive('Выберите единицу'),
    categoryId: z.number().nullable(),
    manufacturerId: z.number().nullable(),
    sizeId: z.number().nullable(),
    formId: z.number().nullable(),
    productLineId: z.number().nullable(),
    minPackageAmount: z.number().positive('Укажите фасовку').nullable(),
    minPackageUnit: z.string().nullable(),
    priceTiers: z.array(priceTierSchema).min(1, 'Укажите хотя бы одну цену'),
    supplierPackageAmount: z.number().positive().nullable(),
    supplierPackageUnit: z.string().nullable(),
    supplierPackagePrice: z.number().nonnegative().nullable(),
    availableAmount: z.number().nonnegative().nullable(),
    availableUnit: z.string().nullable(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const categorySchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    parentId: z.number().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const productAttributeSchema = z.object({
    name: z.string().trim().min(1, 'Название обязательно'),
});

export type ProductAttributeFormValues = z.infer<typeof productAttributeSchema>;

export type ProductAttributeKind = 'MANUFACTURER' | 'SIZE' | 'FORM' | 'PRODUCT_LINE';

export const PRODUCT_ATTRIBUTE_KIND_LABELS: Record<ProductAttributeKind, string> = {
    MANUFACTURER: 'Производитель',
    SIZE: 'Размер',
    FORM: 'Форма',
    PRODUCT_LINE: 'Категория',
};
